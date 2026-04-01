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

// Extract keywords from user message for regulation matching
function extractKeywords(messages) {
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
  if (!lastUserMsg) return ''
  return lastUserMsg.content
}

// Fetch relevant regulations from Supabase
async function getRelevantRegulations(query) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return []

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Try full-text search first
  const { data: searchResults } = await supabase
    .rpc('search_regulations', { query, max_results: 5 })

  if (searchResults && searchResults.length > 0) return searchResults

  // Fallback: category-based keyword matching
  const categoryMap = {
    'eligib': 'Eligibility',
    'threshold': 'Thresholds',
    'score': 'Scoring Methodology',
    'calculat': 'Scoring Methodology',
    'submit': 'Submission Process',
    'document': 'Submission Process',
    'exempt': 'Exemptions',
    'penalt': 'Penalties',
    'made in saudi': 'Made in Saudi',
    'product': 'Made in Saudi',
    'procure': 'Procurement Rules',
    'tender': 'Procurement Rules',
    'bid': 'Procurement Rules',
    'expro': 'Procurement Rules',
    'labor': 'Scoring Methodology',
    'saudiz': 'Scoring Methodology',
    'supplier': 'Scoring Methodology',
    'training': 'Scoring Methodology',
    'depreciat': 'Scoring Methodology',
  }

  const queryLower = query.toLowerCase()
  const matchedCategories = []
  for (const [keyword, category] of Object.entries(categoryMap)) {
    if (queryLower.includes(keyword) && !matchedCategories.includes(category)) {
      matchedCategories.push(category)
    }
  }

  if (matchedCategories.length === 0) {
    // If no specific match, get a general set
    const { data } = await supabase
      .from('regulations')
      .select('*')
      .eq('is_active', true)
      .limit(3)
    return data || []
  }

  const { data } = await supabase
    .from('regulations')
    .select('*')
    .eq('is_active', true)
    .in('category', matchedCategories)
    .limit(5)

  return data || []
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
    // Fetch relevant regulations based on user's question
    const userQuery = extractKeywords(messages)
    const regulations = await getRelevantRegulations(userQuery)

    // Build enhanced system prompt with regulation context
    let enhancedSystem = system || ''

    if (regulations.length > 0) {
      enhancedSystem += '\n\n═══ OFFICIAL REGULATIONS (cite these by source, article, and document name) ═══\n\n'
      regulations.forEach((reg, i) => {
        enhancedSystem += `── REGULATION ${i + 1} ──\n`
        enhancedSystem += `Source: ${reg.source}\n`
        enhancedSystem += `Document: ${reg.document_name || reg.title}\n`
        enhancedSystem += `Category: ${reg.category}\n`
        if (reg.article_numbers) enhancedSystem += `Articles: ${reg.article_numbers}\n`
        if (reg.summary) enhancedSystem += `Summary: ${reg.summary}\n`
        enhancedSystem += `Content:\n${reg.content}\n\n`
      })
      enhancedSystem += '═══ END REGULATIONS ═══\n\n'
      enhancedSystem += 'IMPORTANT: When answering, always cite the specific regulation source, document name, and article number from the regulations above. If the answer is not covered by the regulations provided, say so and provide general guidance based on LCGPA scoring rules.'
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
        max_tokens: 1024,
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
