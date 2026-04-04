// /api/chat.js — Vercel Serverless Function
// Proxies requests to Claude API with server-side API key
// Pulls relevant regulations from Supabase for RAG context

import { createClient } from '@supabase/supabase-js'

const rateLimits = new Map()
const RATE_LIMIT = 20
const RATE_WINDOW = 60 * 1000

function checkRateLimit(ip) {
  const now = Date.now()
  const entry = rateLimits.get(ip)
  if (!entry || now - entry.start > RATE_WINDOW) {
    rateLimits.set(ip, { start: now, count: 1 })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

// Fetch ALL regulations — with only 5-15 documents, load everything
// Claude can read through all of them and find the right answer
async function getAllRegulations() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return []

  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data, error } = await supabase
    .from('regulations')
    .select('source, title, category, document_name, article_numbers, content, summary')
    .eq('is_active', true)
    .order('source')

  if (error || !data) return []
  return data
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown'
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'AI service not configured.' })
  }

  const { system, messages } = req.body || {}
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid request.' })
  }

  const totalLength = JSON.stringify(messages).length + (system || '').length
  if (totalLength > 50000) {
    return res.status(400).json({ error: 'Request too large.' })
  }

  try {
    // Load ALL regulations — only 5-15 docs, Claude reads through all of them
    const regulations = await getAllRegulations()

    // Build enhanced system prompt with full regulation context
    let enhancedSystem = system || ''

    if (regulations.length > 0) {
      enhancedSystem += '\n\n═══ OFFICIAL REGULATIONS DATABASE ═══\nYou have access to ALL of the following regulations. Search through ALL of them to find the answer.\nAlways cite the specific source, document name, and article number when answering.\n\n'
      regulations.forEach((reg, i) => {
        enhancedSystem += `── REGULATION ${i + 1}: ${reg.title} ──\n`
        enhancedSystem += `Source: ${reg.source}\n`
        enhancedSystem += `Document: ${reg.document_name || reg.title}\n`
        enhancedSystem += `Category: ${reg.category}\n`
        if (reg.article_numbers) enhancedSystem += `Articles: ${reg.article_numbers}\n`
        if (reg.summary) enhancedSystem += `Summary: ${reg.summary}\n`
        enhancedSystem += `Full Content:\n${reg.content}\n\n`
      })
      enhancedSystem += '═══ END OF REGULATIONS DATABASE ═══\n\n'
      enhancedSystem += 'CRITICAL INSTRUCTIONS:\n'
      enhancedSystem += '- You MUST search through ALL regulations above before saying you do not have access to something.\n'
      enhancedSystem += '- Always cite: Source (LCGPA/EXPRO), Document Name, and Article Number.\n'
      enhancedSystem += '- If the answer spans multiple regulations, cite all relevant ones.\n'
      enhancedSystem += '- Only say "not available in my knowledge base" if you have genuinely searched all regulations above and the topic is not covered.\n'
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: enhancedSystem,
        messages: messages.slice(-10),
      }),
    })

    if (!response.ok) {
      const status = response.status
      if (status === 429) return res.status(429).json({ error: 'AI service is busy. Please try again.' })
      if (status === 401) return res.status(500).json({ error: 'AI service configuration error.' })
      if (status >= 500) return res.status(502).json({ error: 'AI service temporarily unavailable.' })
      return res.status(502).json({ error: 'Unable to reach AI service.' })
    }

    const data = await response.json()
    const text = (data.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('')

    return res.status(200).json({
      text,
      regulationsUsed: regulations.map(r => ({ source: r.source, title: r.title, category: r.category })),
    })

  } catch (error) {
    if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'AI service timed out.' })
    }
    return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
