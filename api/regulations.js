// /api/regulations.js — CRUD for regulation documents
// Admin-only: checks user email against ADMIN_EMAILS env var

import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())

function isAdmin(email) {
  return ADMIN_EMAILS.includes(email?.toLowerCase())
}

async function getUser(req) {
  const authHeader = req.headers.authorization
  if (!authHeader) return null

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return null

  const supabase = createClient(supabaseUrl, supabaseKey)
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

function getSupabase() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return null
  return createClient(supabaseUrl, supabaseKey)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const user = await getUser(req)
  if (!user) return res.status(401).json({ error: 'Authentication required' })

  const supabase = getSupabase()
  if (!supabase) return res.status(500).json({ error: 'Service not configured' })

  // GET — list all regulations (any authenticated user, for AI context)
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('regulations')
      .select('*')
      .eq('is_active', true)
      .order('source', { ascending: true })
      .order('category', { ascending: true })

    if (error) return res.status(500).json({ error: 'Failed to load regulations' })
    return res.status(200).json({ regulations: data })
  }

  // All write operations require admin
  if (!isAdmin(user.email)) {
    return res.status(403).json({ error: 'Admin access required' })
  }

  // POST — create new regulation
  if (req.method === 'POST') {
    const { source, title, category, subcategory, document_name, article_numbers, content, summary, effective_date } = req.body

    if (!source || !title || !category || !content) {
      return res.status(400).json({ error: 'Source, title, category, and content are required' })
    }

    const { data, error } = await supabase
      .from('regulations')
      .insert({
        source, title, category, subcategory, document_name,
        article_numbers, content, summary, effective_date,
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: 'Failed to save regulation' })
    return res.status(201).json({ regulation: data })
  }

  // PUT — update regulation
  if (req.method === 'PUT') {
    const { id, ...updates } = req.body
    if (!id) return res.status(400).json({ error: 'Regulation ID required' })

    updates.updated_at = new Date().toISOString()
    const { data, error } = await supabase
      .from('regulations')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: 'Failed to update regulation' })
    return res.status(200).json({ regulation: data })
  }

  // DELETE — soft delete (set is_active = false)
  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'Regulation ID required' })

    const { error } = await supabase
      .from('regulations')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return res.status(500).json({ error: 'Failed to delete regulation' })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
