// /api/chat.js — Vercel Serverless Function
// Proxies requests to Claude API with server-side API key
// The ANTHROPIC_API_KEY is stored in Vercel environment variables, never exposed to the browser

// Simple in-memory rate limiter (resets per cold start, ~5min window)
const rateLimits = new Map()
const RATE_LIMIT = 20 // requests per window
const RATE_WINDOW = 60 * 1000 // 1 minute

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

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Rate limiting
  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown'
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' })
  }

  // Validate API key exists
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'AI service not configured. Please contact support.' })
  }

  // Validate request body
  const { system, messages } = req.body || {}
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid request. Messages are required.' })
  }

  // Validate message sizes to prevent abuse
  const totalLength = JSON.stringify(messages).length + (system || '').length
  if (totalLength > 50000) {
    return res.status(400).json({ error: 'Request too large. Please shorten your message.' })
  }

  try {
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
        system: system || '',
        messages: messages.slice(-10), // Only send last 10 messages to control token usage
      }),
    })

    if (!response.ok) {
      const status = response.status
      if (status === 429) return res.status(429).json({ error: 'AI service is busy. Please try again in a moment.' })
      if (status === 401) return res.status(500).json({ error: 'AI service configuration error.' })
      if (status >= 500) return res.status(502).json({ error: 'AI service temporarily unavailable.' })
      return res.status(502).json({ error: 'Unable to reach AI service.' })
    }

    const data = await response.json()

    // Extract text content only — don't pass raw API response to client
    const text = (data.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('')

    return res.status(200).json({ text })

  } catch (error) {
    // Never expose internal error details
    if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'AI service timed out. Please try again.' })
    }
    return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
