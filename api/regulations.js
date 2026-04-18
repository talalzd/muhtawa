// /api/regulations.js — CRUD for regulation documents
// Admin-only write, authenticated read

import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

function isAdmin(email) {
  if (!email || ADMIN_EMAILS.length === 0) return false
  return ADMIN_EMAILS.includes(email.toLowerCase())
}

// ─── CORS ──────────────────────────────────────────────────────────────
// Restrict to ALLOWED_ORIGINS (comma-separated). If unset, echoes the
// request origin — set the env var in production to lock it down.
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
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

export default async function handler(req, res) {
  setCORS(req, res)

  if (req.method === 'OPTIONS') return res.status(200).end()

  const supabase = getSupabase()
  if (!supabase) return res.status(500).json({ error: 'Database not configured' })

  const user = await getUser(req, supabase)
  if (!user) return res.status(401).json({ error: 'Please sign in again' })

  // GET — any authenticated user can read (for AI advisor context)
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('regulations')
        .select('*')
        .eq('is_active', true)
        .order('source')
        .order('category')

      if (error) return res.status(500).json({ error: 'Failed to load: ' + error.message })
      return res.status(200).json({ regulations: data || [] })
    } catch (e) {
      return res.status(500).json({ error: 'Database error' })
    }
  }

  // Write operations require admin
  if (!isAdmin(user.email)) {
    return res.status(403).json({ error: `Admin access required. Your email (${user.email}) is not in the admin list.` })
  }

  // POST — create new regulation
  if (req.method === 'POST') {
    try {
      const { source, title, category, subcategory, document_name, article_numbers, content, summary, effective_date } = req.body || {}

      if (!source || !title || !category || !content) {
        return res.status(400).json({ error: 'Source, title, category, and content are required' })
      }

      // Build clean insert object — skip empty optional fields
      const record = { source, title, category, content }
      if (subcategory) record.subcategory = subcategory
      if (document_name) record.document_name = document_name
      if (article_numbers) record.article_numbers = article_numbers
      if (summary) record.summary = summary
      if (effective_date && effective_date.length >= 8) record.effective_date = effective_date

      const { data, error } = await supabase
        .from('regulations')
        .insert(record)
        .select()
        .single()

      if (error) {
        return res.status(500).json({ error: 'Database insert failed: ' + error.message })
      }

      return res.status(201).json({ regulation: data })
    } catch (e) {
      return res.status(500).json({ error: 'Save failed: ' + (e.message || 'Unknown error') })
    }
  }

  // PUT — update regulation
  if (req.method === 'PUT') {
    try {
      const { id, ...fields } = req.body || {}
      if (!id) return res.status(400).json({ error: 'Regulation ID required' })

      // Clean empty optional fields
      const updates = {}
      for (const [k, v] of Object.entries(fields)) {
        if (k === 'effective_date' && (!v || v.length < 8)) continue
        if (v !== undefined && v !== null) updates[k] = v
      }
      updates.updated_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('regulations')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) return res.status(500).json({ error: 'Update failed: ' + error.message })
      return res.status(200).json({ regulation: data })
    } catch (e) {
      return res.status(500).json({ error: 'Update failed: ' + (e.message || 'Unknown error') })
    }
  }

  // DELETE — soft delete
  if (req.method === 'DELETE') {
    try {
      const { id } = req.body || {}
      if (!id) return res.status(400).json({ error: 'Regulation ID required' })

      const { error } = await supabase
        .from('regulations')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) return res.status(500).json({ error: 'Delete failed: ' + error.message })
      return res.status(200).json({ success: true })
    } catch (e) {
      return res.status(500).json({ error: 'Delete failed' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
