import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export async function signUp(email, password) {
  if (!supabase) return { data: null, error: { message: 'Supabase not configured' } }
  return await supabase.auth.signUp({ email, password })
}

export async function signIn(email, password) {
  if (!supabase) return { data: null, error: { message: 'Supabase not configured' } }
  return await supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}

export async function getSession() {
  if (!supabase) return null
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function saveCompany(userId, company) {
  if (!supabase) return { data: company, error: null }
  return await supabase
    .from('companies')
    .upsert({ user_id: userId, ...company, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select()
    .single()
}

export async function getCompany(userId) {
  if (!supabase) return { data: null, error: null }
  return await supabase
    .from('companies')
    .select('*')
    .eq('user_id', userId)
    .single()
}

export async function saveAssessment(userId, assessment) {
  if (!supabase) return { data: assessment, error: null }
  const payload = { user_id: userId, assessment_data: assessment, updated_at: new Date().toISOString() }
  if (assessment.db_id) {
    return await supabase.from('assessments').update(payload).eq('id', assessment.db_id).select().single()
  }
  return await supabase.from('assessments').insert(payload).select().single()
}

export async function getAssessments(userId) {
  if (!supabase) return { data: [], error: null }
  const { data, error } = await supabase
    .from('assessments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return { data: data || [], error }
}
