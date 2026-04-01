// /api/parse-pdf.js — Extracts text from uploaded PDF files
// Used by the admin page to parse regulation PDFs before saving

import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())

function isAdmin(email) {
  return ADMIN_EMAILS.includes(email?.toLowerCase())
}

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Verify admin access via Supabase auth
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Authentication required' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Service not configured' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user) return res.status(401).json({ error: 'Invalid session' })
  if (!isAdmin(user.email)) return res.status(403).json({ error: 'Admin access required' })

  // Parse the PDF from base64
  const { pdfBase64, fileName } = req.body || {}
  if (!pdfBase64) return res.status(400).json({ error: 'No PDF data provided' })

  try {
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
    const buffer = Buffer.from(pdfBase64, 'base64')
    const data = await pdfParse(buffer)

    return res.status(200).json({
      text: data.text,
      pages: data.numpages,
      fileName: fileName || 'unknown.pdf',
    })
  } catch (error) {
    return res.status(500).json({ error: 'Failed to parse PDF. Please ensure it is a valid PDF file.' })
  }
}
