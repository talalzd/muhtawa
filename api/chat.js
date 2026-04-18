// /api/chat.js — Vercel Serverless Function
// Proxies requests to Claude API with server-side API key.
// Requires authenticated Supabase user. Rate limited per user via Supabase.

import { createClient } from '@supabase/supabase-js'

const RATE_LIMIT = 20           // messages per window per user
const RATE_WINDOW_MS = 60 * 1000 // 1 minute

// ─── CORS ──────────────────────────────────────────────────────────────
// Restrict to ALLOWED_ORIGINS (comma-separated). If unset, echoes the
// request origin (permissive like the old behaviour) — set the env var
// in production to lock it down.
function setCORS(req, res) {
  const allowed = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const origin = req.headers.origin
  if (origin && (allowed.length === 0 || allowed.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function getUser(req, supabase) {
  try {
    const auth = req.headers.authorization
    if (!auth) return null
    const token = auth.replace('Bearer ', '')
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error) return null
    return user
  } catch {
    return null
  }
}

// Supabase-backed per-user rate limit. Fails open if the table is missing
// (auth is still the primary gate). Requires the api_rate_limits table —
// see README_security_updates.md for the migration SQL.
async function checkRateLimit(supabase, userId) {
  const now = Date.now()
  const windowStart = new Date(now - RATE_WINDOW_MS).toISOString()

  try {
    const { count, error } = await supabase
      .from('api_rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('endpoint', 'chat')
      .gte('ts', windowStart)

    if (error) {
      // Table probably missing — log and fail open so users aren't blocked
      // by a missing migration. Auth check above still applies.
      console.warn('Rate limit check failed (table missing?):', error.message)
      return true
    }

    if ((count || 0) >= RATE_LIMIT) return false

    // Record this request
    await supabase.from('api_rate_limits').insert({ user_id: userId, endpoint: 'chat' })

    // Opportunistic cleanup of entries older than 1 hour (fire and forget)
    const cleanupBefore = new Date(now - 3600000).toISOString()
    supabase.from('api_rate_limits').delete().lt('ts', cleanupBefore)
      .then(() => {}).catch(() => {})

    return true
  } catch (e) {
    console.warn('Rate limit error:', e?.message)
    return true
  }
}

async function getAllRegulations(supabase) {
  const { data, error } = await supabase
    .from('regulations')
    .select('source, title, category, document_name, article_numbers, content, summary')
    .eq('is_active', true)
    .order('source')

  if (error || !data) return []
  return data
}

export default async function handler(req, res) {
  setCORS(req, res)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = getSupabase()
  if (!supabase) return res.status(500).json({ error: 'Service not configured.' })

  // Require authenticated user
  const user = await getUser(req, supabase)
  if (!user) return res.status(401).json({ error: 'Please sign in to use the AI advisor.' })

  // Per-user rate limit
  const allowed = await checkRateLimit(supabase, user.id)
  if (!allowed) {
    return res.status(429).json({
      error: `Rate limit reached (${RATE_LIMIT} messages/minute). Please wait a moment.`,
    })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'AI service not configured.' })

  const { system, messages } = req.body || {}
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid request.' })
  }

  const totalLength = JSON.stringify(messages).length + (system || '').length
  if (totalLength > 50000) {
    return res.status(400).json({ error: 'Request too large.' })
  }

  try {
    const regulations = await getAllRegulations(supabase)

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
