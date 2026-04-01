// /api/parse-pdf.js — Extract text from PDF page images using Claude Vision
// Handles scanned documents, Arabic text, tables, and complex layouts
// Receives pre-rendered page images from the client

import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())

export const config = {
  api: { bodyParser: { sizeLimit: '25mb' } }
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

  const { pageImages, fileName, totalPages } = req.body || {}

  if (!pageImages || !Array.isArray(pageImages) || pageImages.length === 0) {
    return res.status(400).json({ error: 'No page images provided' })
  }

  try {
    // Process pages in batches of 5 (Claude handles up to 20 images per message)
    const batchSize = 5
    let fullText = ''

    for (let i = 0; i < pageImages.length; i += batchSize) {
      const batch = pageImages.slice(i, i + batchSize)
      const startPage = i + 1
      const endPage = i + batch.length

      // Build content array with all page images in this batch
      const content = []
      batch.forEach((img, idx) => {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: img,
          },
        })
      })

      content.push({
        type: 'text',
        text: `Extract ALL text from these ${batch.length} page(s) (pages ${startPage}-${endPage} of ${totalPages || 'unknown'}) of a Saudi government regulation document.

Rules:
- Extract every single word from every page. Do not skip anything.
- Preserve document structure: headings, article numbers, section numbers, numbered lists
- Keep article numbers exactly as written (المادة الأولى، المادة الثانية، Article 1, etc.)
- If text is in Arabic, keep it in Arabic exactly as written
- If there are tables, extract them as structured text with clear column separation
- Include all footnotes, headers, and marginal text
- Separate each page with "--- Page ${startPage + batch.indexOf('PLACEHOLDER')} ---" (use actual page numbers)
- Do NOT summarize or skip any content
- Do NOT add your own commentary

Output the complete extracted text only.`,
      })

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 16000,
          messages: [{ role: 'user', content }],
        }),
      })

      if (!response.ok) {
        const status = response.status
        if (status === 429) {
          // Wait and retry once
          await new Promise(r => setTimeout(r, 5000))
          continue
        }
        return res.status(500).json({ 
          error: `Failed to read pages ${startPage}-${endPage}. Please try again.`,
          pagesProcessed: i,
          partialText: fullText 
        })
      }

      const data = await response.json()
      const batchText = (data.content || [])
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n')

      fullText += batchText + '\n\n'
    }

    if (!fullText || fullText.trim().length < 20) {
      return res.status(400).json({ error: 'Could not extract text from this document.' })
    }

    return res.status(200).json({
      text: fullText.trim(),
      fileName: fileName || 'unknown.pdf',
      pages: totalPages || pageImages.length,
    })

  } catch (error) {
    return res.status(500).json({ error: 'Failed to process document. Please try again.' })
  }
}
