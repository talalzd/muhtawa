// /api/parse-pdf.js — Extract text from PDFs using Claude Vision
// Handles scanned documents, Arabic text, and complex layouts
// Uses Claude's document understanding capabilities

import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())

export const config = {
  api: { bodyParser: { sizeLimit: '15mb' } }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Verify admin
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Authentication required' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user || !ADMIN_EMAILS.includes(user.email?.toLowerCase())) {
      return res.status(403).json({ error: 'Admin access required' })
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'AI service not configured' })

  const { pdfBase64, fileName } = req.body || {}
  if (!pdfBase64) return res.status(400).json({ error: 'No PDF data provided' })

  // Check size (base64 is ~33% larger than binary)
  if (pdfBase64.length > 20 * 1024 * 1024) {
    return res.status(400).json({ error: 'File too large. Maximum 15MB.' })
  }

  try {
    // Send PDF directly to Claude as a document
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdfBase64,
                },
              },
              {
                type: 'text',
                text: `Extract ALL text from this PDF document. This is a Saudi government regulation document that may contain Arabic and English text.

Rules:
- Extract every word of text from every page
- Preserve the document structure (headings, articles, sections, numbered lists)
- Keep article numbers and section numbers intact (e.g., "Article 11", "Section 3.2")
- If text is in Arabic, keep it in Arabic
- If there are tables, preserve them in a readable format
- Separate pages with a line break
- Do NOT summarize — extract the complete text as-is
- Do NOT add commentary or analysis

Output the full extracted text only.`,
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const status = response.status
      if (status === 429) return res.status(429).json({ error: 'AI service busy. Try again in a moment.' })
      return res.status(500).json({ error: 'Failed to process PDF. Please try again.' })
    }

    const data = await response.json()
    const text = (data.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n')

    if (!text || text.trim().length < 10) {
      return res.status(400).json({ error: 'Could not extract text from this PDF.' })
    }

    return res.status(200).json({
      text: text.trim(),
      fileName: fileName || 'unknown.pdf',
      method: 'claude-vision',
    })

  } catch (error) {
    return res.status(500).json({ error: 'Failed to process PDF. Please try again.' })
  }
}
