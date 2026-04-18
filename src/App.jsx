import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, signUp, signIn, signOut, getSession, saveCompany, getCompany, saveAssessment, getAssessments, submitFeedback } from './lib/supabase.js'
import { SECTORS, PRODUCT_CATEGORIES, LC_THRESHOLD, ASSET_TYPES, TEMPLATE_VERSION } from './lib/sectors.js'
import { computeScore, getRecommendations, fmt, pct, TOOLTIPS } from './lib/scoring.js'
import { exportAssessmentPDF } from './lib/pdf.js'

// ─── THEME ─────────────────────────────────────────────────────────────
const T = {
  bg: '#0a0f1a', bgCard: '#111827', bgHover: '#1a2234', bgInput: '#0d1321',
  border: '#1e293b', text: '#e2e8f0', muted: '#64748b', dim: '#475569',
  accent: '#10b981', accentDim: '#059669', glow: 'rgba(16,185,129,0.15)',
  danger: '#ef4444', dangerDim: '#991b1b', warning: '#f59e0b', success: '#10b981',
}
const inputStyle = { width: '100%', padding: '11px 14px', background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.03em' }
const btnP = { padding: '12px 28px', background: `linear-gradient(135deg, ${T.accent}, ${T.accentDim})`, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }

// Admin check — set your email in Vercel env var ADMIN_EMAILS
const ADMIN_EMAIL_LIST = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())
function isAdminUser(email) {
  if (!email) return false
  // Fallback: if env var not set, check common admin patterns
  if (ADMIN_EMAIL_LIST.length > 0 && ADMIN_EMAIL_LIST[0] !== '') return ADMIN_EMAIL_LIST.includes(email.toLowerCase())
  return false
}

// ─── Shared auth header helper ─────────────────────────────────────────
async function getAuthHeader() {
  if (!supabase) return {}
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  } catch {
    return {}
  }
}

// ─── #10: SANITIZE ERROR MESSAGES ──────────────────────────────────────
function sanitizeError(msg) {
  if (!msg) return 'Something went wrong. Please try again.'
  const raw = typeof msg === 'string' ? msg : msg.message || ''
  if (/postgres|sql|connection|port|ECONNREFUSED|socket|timeout|500/i.test(raw)) return 'Service temporarily unavailable. Please try again in a moment.'
  if (/invalid.*email|email.*invalid/i.test(raw)) return 'Please enter a valid email address.'
  if (/password.*short|password.*weak|at least/i.test(raw)) return 'Password must be at least 6 characters.'
  if (/already.*registered|already.*exists|duplicate/i.test(raw)) return 'An account with this email already exists. Try signing in.'
  if (/invalid.*credentials|invalid.*password|wrong.*password/i.test(raw)) return 'Invalid email or password.'
  if (/rate.*limit|too.*many/i.test(raw)) return 'Too many attempts. Please wait a moment before trying again.'
  if (/not.*found|no.*user/i.test(raw)) return 'Account not found. Please check your email or sign up.'
  if (/network|fetch|cors/i.test(raw)) return 'Network error. Please check your connection.'
  if (raw.length > 100) return 'Something went wrong. Please try again.'
  return raw
}

// ─── #9: RATE LIMITER (client-side UX only) ────────────────────────────
function useRateLimit(maxCalls, windowMs) {
  const calls = useRef([])
  return useCallback(() => {
    const now = Date.now()
    calls.current = calls.current.filter(t => now - t < windowMs)
    if (calls.current.length >= maxCalls) return false
    calls.current.push(now)
    return true
  }, [maxCalls, windowMs])
}

// ─── #5: PASSWORD VALIDATION ───────────────────────────────────────────
function validateAuth(email, password, isSignUp) {
  if (!email || !email.includes('@') || !email.includes('.')) return 'Please enter a valid email address.'
  if (!password || password.length < 6) return 'Password must be at least 6 characters.'
  if (isSignUp && password.length < 8) return 'Password must be at least 8 characters for new accounts.'
  return null
}

const TEAM_QUESTIONS = [
  { key: 'hasRDTeam', label: 'Research & Innovation team in KSA?' },
  { key: 'hasClientResearchTeam', label: 'Client needs research team in KSA?' },
  { key: 'hasDesignTeam', label: 'Product design team in KSA?' },
  { key: 'hasDevTeam', label: 'Development/manufacturing team in KSA?' },
  { key: 'hasTestingTeam', label: 'Testing team in KSA?' },
  { key: 'hasManagementTeam', label: 'Product management/deployment team in KSA?' },
  { key: 'hasMaintenanceTeam', label: 'Maintenance/support team in KSA?' },
  { key: 'usesLocalAssets', label: 'Uses local assets for manufacturing/hosting?' },
]

function emptyAssessment() {
  return { id: Date.now(), date: new Date().toISOString(), labor: { saudiComp: 0, foreignComp: 0 }, suppliers: [], training: 0, supplierDev: 0, rdExpense: 0, totalRevenue: 0, assets: [], totalGSExpense: 0, otherCosts: 0, inventoryMovement: 0 }
}

// ─── #13: RESPONSIVE HOOK ──────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return mobile
}

// ═══ APP ═══
export default function App() {
  const [view, setView] = useState('landing')
  const [user, setUser] = useState(null)
  const [company, setCompany] = useState(null)
  const [assessments, setAssessments] = useState([])
  const [curA, setCurA] = useState(null)
  const [sbOpen, setSbOpen] = useState(window.innerWidth > 768)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const mobile = useIsMobile()

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  useEffect(() => {
    (async () => {
      try {
        const session = await getSession()
        if (session?.user) {
          setUser(session.user)
          // #3: graceful failure on data load
          try { const { data: c } = await getCompany(session.user.id); if (c) setCompany(c) } catch {}
          try { const { data: list } = await getAssessments(session.user.id); if (list) setAssessments(list.map(r => ({ ...r.assessment_data, db_id: r.id }))) } catch {}
          setView('dashboard')
        }
      } catch {}
      setLoading(false)
    })()
  }, [])

  // #13: close sidebar on mobile when navigating
  useEffect(() => { if (mobile) setSbOpen(false) }, [view, mobile])

  async function handleAuth(email, password, isNew) {
    if (!supabase) { setUser({ id: 'demo', email }); setView('dashboard'); return { error: null } }
    try {
      const { data, error } = isNew ? await signUp(email, password) : await signIn(email, password)
      if (error) return { error: { message: sanitizeError(error.message) } }
      if (data?.user) {
        setUser(data.user)
        try { const { data: c } = await getCompany(data.user.id); if (c) setCompany(c) } catch {}
        try { const { data: list } = await getAssessments(data.user.id); if (list) setAssessments(list.map(r => ({ ...r.assessment_data, db_id: r.id }))) } catch {}
        setView('dashboard')
      }
      return { error: null }
    } catch (e) {
      return { error: { message: sanitizeError(e) } }
    }
  }

  async function handleSaveCompany(d) {
    try { if (user?.id && supabase) await saveCompany(user.id, d) } catch {}
    setCompany(d); setView('dashboard'); showToast('Company saved')
  }

  async function handleSaveAssessment(a) {
    try {
      if (user?.id && supabase) {
        const { data } = await saveAssessment(user.id, a)
        if (data?.id) a.db_id = data.id
      }
    } catch {}
    setAssessments(prev => {
      const idx = prev.findIndex(x => x.id === a.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = a; return n }
      return [...prev, a]
    })
    setCurA(a)
  }

  // #4: loading state for PDF export
  function handleExport(a) {
    showToast('Generating PDF...', 'success')
    try { exportAssessmentPDF(a, company); showToast('PDF downloaded') } catch { showToast('PDF generation failed', 'error') }
  }

  async function handleLogout() { await signOut(); setUser(null); setCompany(null); setAssessments([]); setCurA(null); setView('landing') }

  if (loading) return <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}><div style={{ width: 48, height: 48, background: `linear-gradient(135deg, ${T.accent}, ${T.accentDim})`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 24, color: '#fff' }}>م</div><div style={{ color: T.muted }}>Loading...</div></div>
  if (view === 'landing') return <Landing onStart={() => setView('login')} />
  if (view === 'login') return <Auth onAuth={handleAuth} onBack={() => setView('landing')} />
  if (view === 'company-setup') return <CompanySetup onSave={handleSaveCompany} existing={company} mobile={mobile} />

  const sidebarWidth = mobile ? 0 : (sbOpen ? 260 : 64)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.bg, color: T.text }}>
      {/* #13: mobile hamburger */}
      {mobile && <div onClick={() => setSbOpen(!sbOpen)} style={{ position: 'fixed', top: 12, left: 12, zIndex: 200, width: 40, height: 40, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20 }}>☰</div>}
      {(!mobile || sbOpen) && <><Sidebar view={view} setView={setView} user={user} open={mobile ? true : sbOpen} toggle={() => setSbOpen(!sbOpen)} onLogout={handleLogout} mobile={mobile} />{mobile && sbOpen && <div onClick={() => setSbOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }} />}</>}
      <main style={{ flex: 1, marginLeft: sidebarWidth, transition: 'margin-left 0.3s ease', padding: mobile ? '60px 16px 16px' : '32px 40px' }}>
        {view === 'dashboard' && <Dashboard company={company} assessments={assessments} onNew={() => { setCurA(emptyAssessment()); setView('calculator') }} onSetup={() => setView('company-setup')} onView={a => { setCurA(a); setView('calculator') }} onAdvisor={() => setView('advisor')} onExport={handleExport} mobile={mobile} />}
        {view === 'calculator' && <Calculator assessment={curA || emptyAssessment()} onSave={handleSaveAssessment} company={company} onExport={handleExport} mobile={mobile} />}
        {view === 'made-in-saudi' && <MadeInSaudi mobile={mobile} />}
        {view === 'advisor' && <Advisor company={company} currentAssessment={curA} mobile={mobile} />}
        {view === 'admin' && isAdminUser(user?.email) && <RegulationsAdmin user={user} mobile={mobile} />}
        {/* #14: Feedback mechanism */}
        <Feedback user={user} currentView={view} />
      </main>
      {toast && <div className="fade-in" style={{ position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', background: toast.type === 'error' ? T.danger : T.accent, color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', maxWidth: mobile ? 'calc(100vw - 48px)' : 400 }}>{toast.msg}</div>}
    </div>
  )
}

// ═══ #14: FEEDBACK WIDGET ═══
function Feedback({ user, currentView }) {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')
  const handleSend = async () => {
    if (!msg.trim() || sending) return
    setSending(true)
    try { await submitFeedback(user?.id, user?.email, msg.trim(), currentView) } catch {}
    setSent(true); setMsg(''); setSending(false)
    setTimeout(() => { setOpen(false); setSent(false) }, 2500)
  }
  return (
    <>
      <div onClick={() => setOpen(!open)} style={{ position: 'fixed', bottom: 24, left: 24, width: 44, height: 44, borderRadius: '50%', background: T.bgCard, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20, zIndex: 50, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }} title="Send feedback">💬</div>
      {open && <div className="fade-in" style={{ position: 'fixed', bottom: 80, left: 24, width: 300, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, zIndex: 50, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        <h4 style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>Send Feedback</h4>
        <p style={{ fontSize: 12, color: T.muted, marginBottom: 12 }}>Report a bug or suggest an improvement.</p>
        {sent ? <div style={{ color: T.accent, fontSize: 14, fontWeight: 600, padding: '20px 0', textAlign: 'center' }}>Thank you for your feedback!</div> : <>
          <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={3} placeholder="What's on your mind?" style={{ ...inputStyle, resize: 'vertical', marginBottom: 8 }} />
          <button onClick={handleSend} disabled={sending} style={{ ...btnP, width: '100%', padding: '8px 16px', fontSize: 13, opacity: sending ? 0.7 : 1 }}>{sending ? 'Sending...' : 'Send'}</button>
        </>}
      </div>}
    </>
  )
}

// ═══ LANDING ═══
function Landing({ onStart }) {
  const mobile = useIsMobile()
  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(160deg, ${T.bg} 0%, #0d1f2d 50%, #0a1a15 100%)`, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 20%, rgba(16,185,129,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(16,185,129,0.05) 0%, transparent 50%)' }} />
      <nav style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: mobile ? '16px 20px' : '24px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, background: `linear-gradient(135deg, ${T.accent}, ${T.accentDim})`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, color: '#fff' }}>م</div>
          <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: T.text }}>Muhtawa</span>
        </div>
        <button onClick={onStart} style={{ padding: '10px 28px', background: 'transparent', border: `1px solid ${T.accent}`, borderRadius: 8, color: T.accent, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Sign In</button>
      </nav>
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 900, margin: '0 auto', padding: mobile ? '60px 20px 40px' : '100px 48px 80px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', padding: '6px 16px', background: T.glow, borderRadius: 20, fontSize: 13, fontWeight: 600, color: T.accent, marginBottom: 24, border: '1px solid rgba(16,185,129,0.2)' }}>LCGPA Compliance Made Simple</div>
        <h1 style={{ fontSize: mobile ? 32 : 56, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.03em', color: T.text, marginBottom: 24 }}>Know your Local Content score<br /><span style={{ color: T.accent }}>before you bid.</span></h1>
        <p style={{ fontSize: mobile ? 16 : 19, color: T.muted, lineHeight: 1.7, maxWidth: 620, margin: '0 auto 48px' }}>Calculate your LCGPA score, check Made in Saudi eligibility, and get AI-powered recommendations to hit the 40% threshold.</p>
        <button onClick={onStart} style={{ ...btnP, padding: '14px 40px', fontSize: 16, boxShadow: '0 4px 24px rgba(16,185,129,0.3)' }}>Start Free Assessment</button>
      </div>
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 1000, margin: '0 auto', padding: mobile ? '0 20px 60px' : '0 48px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3, 1fr)', gap: mobile ? 16 : 24 }}>
          {[{ icon: '📊', title: 'LC Score Calculator', desc: 'Full LCGPA scoring across Labor, Goods & Services, Capacity Building, and Depreciation with all 39 sector categories.' }, { icon: '🏭', title: 'Made in Saudi Check', desc: 'Assess your product against Made in Saudi requirements. Identify gaps in local teams, R&D, and manufacturing.' }, { icon: '🤖', title: 'AI Compliance Advisor', desc: 'Ask questions, get prescriptive recommendations, and understand exactly what to do to increase your score.' }].map((f, i) => (
            <div key={i} style={{ background: `${T.bgCard}cc`, backdropFilter: 'blur(12px)', border: `1px solid ${T.border}`, borderRadius: 16, padding: mobile ? 24 : 32 }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
      <footer style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: 32, borderTop: `1px solid ${T.border}` }}><p style={{ fontSize: 13, color: T.dim }}>Built by Talal Al Zayed. Data sourced from LCGPA and EXPRO.</p></footer>
    </div>
  )
}

// ═══ AUTH (#5: reviewed, #9: rate limited, #10: sanitized) ═══
function Auth({ onAuth, onBack }) {
  const [isNew, setIsNew] = useState(false)
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const checkRate = useRateLimit(5, 60000) // #9: 5 attempts per minute

  const go = async () => {
    if (busy) return
    // #9: rate limit check
    if (!checkRate()) { setErr('Too many attempts. Please wait a moment.'); return }
    // #5: validate before sending
    const valErr = validateAuth(email, pw, isNew)
    if (valErr) { setErr(valErr); return }
    setBusy(true); setErr('')
    const { error } = await onAuth(email, pw, isNew)
    if (error) setErr(error.message)
    setBusy(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div className="fade-in" style={{ width: '100%', maxWidth: 420, padding: '32px 28px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: T.muted, fontSize: 14, cursor: 'pointer', marginBottom: 24, padding: 0 }}>← Back</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{ width: 32, height: 32, background: `linear-gradient(135deg, ${T.accent}, ${T.accentDim})`, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: '#fff' }}>م</div>
          <span style={{ fontSize: 20, fontWeight: 700, color: T.text }}>Muhtawa</span>
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: T.text, marginBottom: 8 }}>{isNew ? 'Create your account' : 'Welcome back'}</h2>
        <p style={{ fontSize: 14, color: T.muted, marginBottom: 28 }}>{isNew ? 'Start your local content assessment' : 'Sign in to continue'}</p>
        {err && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: T.danger, fontSize: 13, marginBottom: 16 }}>{err}</div>}
        {!supabase && <div style={{ padding: '10px 14px', background: T.glow, border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, color: T.accent, fontSize: 13, marginBottom: 16 }}>Demo mode — enter any email and password to explore.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div><label style={labelStyle}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" style={inputStyle} onKeyDown={e => e.key === 'Enter' && go()} autoComplete="email" /></div>
          <div><label style={labelStyle}>Password</label><input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder={isNew ? 'Min 8 characters' : '••••••••'} style={inputStyle} onKeyDown={e => e.key === 'Enter' && go()} autoComplete={isNew ? 'new-password' : 'current-password'} /></div>
          <button onClick={go} disabled={busy} style={{ ...btnP, width: '100%', opacity: busy ? 0.7 : 1, cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'Please wait...' : isNew ? 'Create Account' : 'Sign In'}</button>
        </div>
        <p style={{ textAlign: 'center', fontSize: 14, color: T.muted, marginTop: 24 }}>{isNew ? 'Already have an account?' : "Don't have an account?"} <span onClick={() => { setIsNew(!isNew); setErr('') }} style={{ color: T.accent, cursor: 'pointer', fontWeight: 600 }}>{isNew ? 'Sign in' : 'Sign up'}</span></p>
      </div>
    </div>
  )
}

// ═══ SIDEBAR (#13: mobile overlay) ═══
function Sidebar({ view, setView, user, open, toggle, onLogout, mobile }) {
  const items = [{ id: 'dashboard', icon: '◻', label: 'Dashboard' }, { id: 'calculator', icon: '⊞', label: 'LC Calculator' }, { id: 'made-in-saudi', icon: '⬡', label: 'Made in Saudi' }, { id: 'advisor', icon: '◎', label: 'AI Advisor' }, { id: 'admin', icon: '⛭', label: 'Regulations', admin: true }]
  const name = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'
  const nav = id => { setView(id); if (mobile) toggle() }
  return (
    <aside style={{ position: 'fixed', left: 0, top: 0, bottom: 0, width: mobile ? 260 : (open ? 260 : 64), background: T.bgCard, borderRight: `1px solid ${T.border}`, transition: 'width 0.3s ease', zIndex: mobile ? 150 : 100, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${T.border}` }}>
        <div onClick={toggle} style={{ width: 32, height: 32, background: `linear-gradient(135deg, ${T.accent}, ${T.accentDim})`, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: '#fff', cursor: 'pointer', flexShrink: 0 }}>م</div>
        {(open || mobile) && <span style={{ fontSize: 18, fontWeight: 700, whiteSpace: 'nowrap', color: T.text }}>Muhtawa</span>}
      </div>
      <nav style={{ flex: 1, padding: '16px 8px' }}>
        {items.filter(it => !it.admin || isAdminUser(user?.email)).map(it => (
          <div key={it.id} onClick={() => nav(it.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', marginBottom: 4, borderRadius: 8, cursor: 'pointer', background: view === it.id ? T.glow : 'transparent', color: view === it.id ? T.accent : T.muted, transition: 'all 0.2s' }}
            onMouseEnter={e => { if (view !== it.id) e.currentTarget.style.background = T.bgHover }} onMouseLeave={e => { if (view !== it.id) e.currentTarget.style.background = 'transparent' }}>
            <span style={{ fontSize: 18, flexShrink: 0, width: 24, textAlign: 'center' }}>{it.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>{it.label}</span>
          </div>
        ))}
      </nav>
      <div style={{ padding: '16px 16px 20px', borderTop: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 2 }}>{name}</div>
        <div style={{ fontSize: 12, color: T.dim, marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
        <button onClick={onLogout} style={{ width: '100%', padding: 7, background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 6, color: T.muted, fontSize: 12, cursor: 'pointer' }}>Sign out</button>
      </div>
    </aside>
  )
}

// ═══ DASHBOARD ═══
function Dashboard({ company, assessments, onNew, onSetup, onView, onAdvisor, onExport, mobile }) {
  const latest = assessments[assessments.length - 1]
  const ls = latest ? computeScore(latest) : null
  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}><h1 style={{ fontSize: mobile ? 22 : 28, fontWeight: 800, letterSpacing: '-0.02em', color: T.text, marginBottom: 4 }}>Dashboard</h1><p style={{ fontSize: 14, color: T.muted }}>{company ? `${company.name}` : 'Set up your company to get started'}</p></div>
      {!company && <div style={{ background: T.glow, border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: mobile ? 16 : 24, marginBottom: 24, display: 'flex', flexDirection: mobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: mobile ? 'flex-start' : 'center', gap: 12 }}><div><h3 style={{ fontSize: 16, fontWeight: 700, color: T.accent, marginBottom: 4 }}>Complete your setup</h3><p style={{ fontSize: 14, color: T.muted }}>Add company info to unlock full scoring.</p></div><button onClick={onSetup} style={btnP}>Set Up Company</button></div>}
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <SC label="LC Score" value={ls ? pct(ls.totalScore) : '—'} sub={ls ? (ls.meetsThreshold ? 'Above' : `${pct(ls.gap)} below`) : 'N/A'} color={ls ? (ls.meetsThreshold ? T.success : T.danger) : T.dim} />
        <SC label="Assessments" value={assessments.length} sub="Total" color={T.accent} />
        <SC label="Threshold" value={pct(LC_THRESHOLD)} sub="Minimum" color={T.warning} />
        <SC label="Sectors" value="39" sub="Categories" color={T.accent} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '2fr 1fr', gap: 24 }}>
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, padding: mobile ? 16 : 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}><h2 style={{ fontSize: 18, fontWeight: 700, color: T.text }}>Assessments</h2><button onClick={onNew} style={{ ...btnP, padding: '8px 16px', fontSize: 13 }}>+ New</button></div>
          {assessments.length === 0 ? <div style={{ textAlign: 'center', padding: '48px 0', color: T.dim }}><p style={{ fontSize: 15, marginBottom: 8 }}>No assessments yet</p></div> : assessments.slice().reverse().map(a => { const s = computeScore(a); return (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 10, marginBottom: 6, border: `1px solid ${T.border}`, cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.borderColor = T.accentDim; e.currentTarget.style.background = T.bgHover }} onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = 'transparent' }}>
              <div onClick={() => onView(a)} style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{new Date(a.date).toLocaleDateString('en-SA', { month: 'short', day: 'numeric', year: 'numeric' })}</div><div style={{ fontSize: 12, color: T.dim }}>LC: {pct(s.totalScore)}</div></div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><button onClick={e => { e.stopPropagation(); onExport(a) }} style={{ padding: '4px 8px', background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 6, color: T.muted, fontSize: 11, cursor: 'pointer' }}>PDF</button><div style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: s.meetsThreshold ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: s.meetsThreshold ? T.success : T.danger }}>{s.meetsThreshold ? 'PASS' : 'BELOW'}</div></div>
            </div>) })}
        </div>
        <div style={{ display: 'flex', flexDirection: mobile ? 'row' : 'column', gap: 16, flexWrap: 'wrap' }}>
          <QA icon="◎" title="AI Advisor" desc="Ask compliance questions." onClick={onAdvisor} />
          <QA icon="⚙" title="Company" desc={company?.name || 'Set up'} onClick={onSetup} />
        </div>
      </div>
    </div>
  )
}
function SC({ label, value, sub, color }) { return <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: '16px 14px' }}><div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div><div style={{ fontSize: 24, fontWeight: 800, color, letterSpacing: '-0.02em', marginBottom: 2 }}>{value}</div><div style={{ fontSize: 11, color: T.dim }}>{sub}</div></div> }
function QA({ icon, title, desc, onClick }) { return <div onClick={onClick} style={{ flex: 1, minWidth: 120, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, cursor: 'pointer', transition: 'border-color 0.3s' }} onMouseEnter={e => e.currentTarget.style.borderColor = T.accentDim} onMouseLeave={e => e.currentTarget.style.borderColor = T.border}><div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div><h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>{title}</h3><p style={{ fontSize: 12, color: T.muted }}>{desc}</p></div> }

// ═══ COMPANY SETUP ═══
function CompanySetup({ onSave, existing, mobile }) {
  const [f, setF] = useState(existing || { name: '', sector: '', crNumber: '', address: '', contactName: '', contactEmail: '', description: '' })
  const [saving, setSaving] = useState(false)
  const s = (k, v) => setF(p => ({ ...p, [k]: v }))
  const save = async () => { if (!f.name) return; setSaving(true); await onSave(f); setSaving(false) }
  return (
    <div className="fade-in" style={{ maxWidth: 640, margin: '0 auto', padding: mobile ? '16px 0' : '40px 0' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, marginBottom: 4 }}>Company Profile</h1>
      <p style={{ fontSize: 14, color: T.muted, marginBottom: 24 }}>Used across all assessments.</p>
      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, padding: mobile ? 20 : 32 }}>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: mobile ? 'auto' : '1 / -1' }}><label style={labelStyle}>Company Name</label><input value={f.name} onChange={e => s('name', e.target.value)} placeholder="Acme Corp" style={inputStyle} /></div>
          <div><label style={labelStyle}>Primary Sector</label><select value={f.sector} onChange={e => s('sector', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}><option value="">Select sector</option>{SECTORS.filter(x => x.origin === 'Local' && x.score > 0).map(x => <option key={x.id} value={x.name}>{x.name} ({pct(x.score)})</option>)}</select></div>
          <div><label style={labelStyle}>CR Number</label><input value={f.crNumber} onChange={e => s('crNumber', e.target.value)} placeholder="CR Number" style={inputStyle} /></div>
          <div style={{ gridColumn: mobile ? 'auto' : '1 / -1' }}><label style={labelStyle}>Address</label><input value={f.address} onChange={e => s('address', e.target.value)} placeholder="Riyadh, Saudi Arabia" style={inputStyle} /></div>
          <div><label style={labelStyle}>Contact Name</label><input value={f.contactName} onChange={e => s('contactName', e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Contact Email</label><input value={f.contactEmail} onChange={e => s('contactEmail', e.target.value)} type="email" style={inputStyle} /></div>
          <div style={{ gridColumn: mobile ? 'auto' : '1 / -1' }}><label style={labelStyle}>Description</label><textarea value={f.description} onChange={e => s('description', e.target.value)} rows={3} placeholder="Brief description..." style={{ ...inputStyle, resize: 'vertical' }} /></div>
        </div>
        <button onClick={save} disabled={saving} style={{ ...btnP, marginTop: 24, opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving...' : 'Save Profile'}</button>
      </div>
    </div>
  )
}

// ═══ CALCULATOR ═══
function Calculator({ assessment, onSave, company, onExport, mobile }) {
  const [a, setA] = useState(assessment)
  const [tab, setTab] = useState('labor')
  const score = computeScore(a)
  const recs = getRecommendations(score, a)
  const timer = useRef(null)

  const upd = (path, val) => { setA(prev => { const n = JSON.parse(JSON.stringify(prev)); const p = path.split('.'); let o = n; for (let i = 0; i < p.length - 1; i++) o = o[p[i]]; o[p[p.length - 1]] = val; return n }) }
  useEffect(() => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => onSave(a), 1500); return () => clearTimeout(timer.current) }, [a])

  const addSup = () => upd('suppliers', [...a.suppliers, { name: '', sectorId: 1, sectorScore: SECTORS[0].score, auditedScore: 0, expense: 0, origin: 'Local' }])
  const updSup = (i, k, v) => { const ns = [...a.suppliers]; ns[i] = { ...ns[i], [k]: v }; if (k === 'sectorId') { const sec = SECTORS.find(x => x.id === v); if (sec) ns[i].sectorScore = sec.score }; upd('suppliers', ns) }
  const rmSup = i => upd('suppliers', a.suppliers.filter((_, j) => j !== i))
  const addAsset = () => upd('assets', [...a.assets, { name: '', assetType: 'MACHINERY', amount: 0, producedInKSA: true }])
  const updAsset = (i, k, v) => { const na = [...a.assets]; na[i] = { ...na[i], [k]: v }; upd('assets', na) }
  const rmAsset = i => upd('assets', a.assets.filter((_, j) => j !== i))

  const tabs = [{ id: 'labor', label: mobile ? 'Labor' : 'Labor', icon: '👥' }, { id: 'goods', label: mobile ? 'G&S' : 'Goods & Services', icon: '📦' }, { id: 'capacity', label: mobile ? 'Capacity' : 'Capacity Building', icon: '🎓' }, { id: 'depreciation', label: mobile ? 'Depr.' : 'Depreciation', icon: '🏗' }, { id: 'summary', label: 'Summary', icon: '📋' }]

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div><h1 style={{ fontSize: mobile ? 22 : 28, fontWeight: 800, letterSpacing: '-0.02em', color: T.text, marginBottom: 4 }}>LC Score Calculator</h1><p style={{ fontSize: 13, color: T.muted }}>LCGPA Template {TEMPLATE_VERSION} — Auto-saves</p></div>
        <button onClick={() => onExport(a)} style={{ ...btnP, padding: '8px 16px', fontSize: 13 }}>↓ PDF</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
        <SP label="Total LC" value={pct(score.totalScore)} highlight color={score.meetsThreshold ? T.success : T.danger} />
        <SP label="Labor" value={`${fmt(score.laborLC)}`} sub={pct(score.laborPct)} />
        {!mobile && <SP label="G&S" value={`${fmt(score.gsLC)}`} sub={pct(score.gsPct)} />}
        {!mobile && <SP label="Capacity" value={`${fmt(score.capacityLC)}`} sub={pct(score.capacityPct)} />}
        <SP label={mobile ? 'Cost' : 'Depr.'} value={mobile ? `${fmt(score.totalCost)}` : `${fmt(score.depLC)}`} sub={mobile ? 'Total' : pct(score.depPct)} />
      </div>
      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: mobile ? 12 : 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ fontSize: 12, fontWeight: 600, color: T.muted }}>Progress to 40%</span><span style={{ fontSize: 12, fontWeight: 700, color: score.meetsThreshold ? T.success : T.danger }}>{pct(score.totalScore)}</span></div>
        <div style={{ height: 10, background: T.bgInput, borderRadius: 5, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(score.totalScore / LC_THRESHOLD * 100, 100)}%`, background: score.meetsThreshold ? `linear-gradient(90deg, ${T.accent}, ${T.accentDim})` : `linear-gradient(90deg, ${T.danger}, ${T.dangerDim})`, borderRadius: 5, transition: 'width 0.5s ease' }} /></div>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: T.bgCard, borderRadius: 10, padding: 4, border: `1px solid ${T.border}`, overflowX: 'auto' }}>
        {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: mobile ? 'none' : 1, padding: mobile ? '8px 12px' : '10px 12px', background: tab === t.id ? T.glow : 'transparent', border: tab === t.id ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent', borderRadius: 8, color: tab === t.id ? T.accent : T.muted, fontSize: mobile ? 12 : 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>{!mobile && <span>{t.icon}</span>} {t.label}</button>)}
      </div>
      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, padding: mobile ? 16 : 28 }}>
        {tab === 'labor' && <><SH title="Section 3: Labor" desc="Saudi at 100%, foreign at 53.4%." /><div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 16 }}><div><label style={labelStyle}>Saudi Compensation (SAR)<Tip tipKey="saudiComp" /></label><input type="number" value={a.labor.saudiComp || ''} onChange={e => upd('labor.saudiComp', Number(e.target.value))} placeholder="0" style={inputStyle} /><div style={{ fontSize: 12, color: T.accent, marginTop: 4 }}>100% → SAR {fmt(a.labor.saudiComp || 0)}</div></div><div><label style={labelStyle}>Foreign Compensation (SAR)<Tip tipKey="foreignComp" /></label><input type="number" value={a.labor.foreignComp || ''} onChange={e => upd('labor.foreignComp', Number(e.target.value))} placeholder="0" style={inputStyle} /><div style={{ fontSize: 12, color: T.dim, marginTop: 4 }}>53.4% → SAR {fmt((a.labor.foreignComp || 0) * 0.534)}</div></div></div><TB label="Total Labor LC" value={`SAR ${fmt(score.laborLC)}`} /></>}
        {tab === 'goods' && <><SH title="Section 4: Goods & Services" desc="Enter total G&S expense, then list top suppliers (≥70% of spend or top 40)." /><div style={{ marginBottom: 16 }}><label style={labelStyle}>Total G&S Expense (SAR)<Tip tipKey="totalGSExpense" /></label><input type="number" value={a.totalGSExpense || ''} onChange={e => upd('totalGSExpense', Number(e.target.value))} placeholder="0" style={inputStyle} />{score.declaredTotalGS > 0 && score.listedSupplierExpense > 0 && <div style={{ fontSize: 12, color: (score.listedSupplierExpense / score.declaredTotalGS) >= 0.7 ? T.accent : T.warning, marginTop: 4 }}>Supplier coverage: {pct(score.listedSupplierExpense / score.declaredTotalGS)}{score.remainingGS > 0 && ` • Remaining SAR ${fmt(score.remainingGS)} scored at weighted avg ${pct(score.weightedAvgLC)}`}</div>}</div>{a.suppliers.map((sup, i) => <div key={i} style={{ padding: mobile ? 12 : 16, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 12, position: 'relative' }}><button onClick={() => rmSup(i)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: T.danger, cursor: 'pointer', fontSize: 16, padding: 4 }}>✕</button><div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '2fr 1fr 2fr 1fr', gap: 12, alignItems: 'end' }}><div><label style={labelStyle}>Supplier<Tip tipKey="supplierName" /></label><input value={sup.name} onChange={e => updSup(i, 'name', e.target.value)} placeholder="Name" style={inputStyle} /></div><div><label style={labelStyle}>Origin</label><select value={sup.origin} onChange={e => updSup(i, 'origin', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}><option value="Local">Local</option><option value="Foreign">Foreign</option></select></div><div><label style={labelStyle}>Sector<Tip tipKey="supplierSector" /></label><select value={sup.sectorId} onChange={e => updSup(i, 'sectorId', Number(e.target.value))} style={{ ...inputStyle, cursor: 'pointer', fontSize: 12 }}>{SECTORS.map(sec => <option key={sec.id} value={sec.id}>{sec.name} ({pct(sec.score)})</option>)}</select></div><div><label style={labelStyle}>Expense (SAR)<Tip tipKey="supplierExpense" /></label><input type="number" value={sup.expense || ''} onChange={e => updSup(i, 'expense', Number(e.target.value))} placeholder="0" style={inputStyle} /></div></div><div style={{ fontSize: 12, color: T.accent, marginTop: 8 }}>LC: SAR {fmt((sup.expense || 0) * (sup.auditedScore > 0 ? sup.auditedScore : (sup.sectorScore || 0)))}</div></div>)}<button onClick={addSup} style={{ padding: '10px 20px', background: 'transparent', border: `1px dashed ${T.border}`, borderRadius: 8, color: T.muted, fontSize: 13, cursor: 'pointer', width: '100%' }}>+ Add Supplier</button><div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 16, marginTop: 16 }}><div><label style={labelStyle}>Other Costs (SAR)<Tip tipKey="otherCosts" /></label><input type="number" value={a.otherCosts || ''} onChange={e => upd('otherCosts', Number(e.target.value))} placeholder="0" style={inputStyle} /></div><div><label style={labelStyle}>Inventory Movement<Tip tipKey="inventoryMovement" /></label><input type="number" value={a.inventoryMovement || ''} onChange={e => upd('inventoryMovement', Number(e.target.value))} placeholder="0" style={inputStyle} /></div></div><TB label="Total G&S LC" value={`SAR ${fmt(score.gsLC)}`} /></>}
        {tab === 'capacity' && <><SH title="Section 6: Capacity Building" desc="Training, supplier dev, R&D — all at 100% LC. R&D also earns up to 10% bonus." /><div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 16 }}><div><label style={labelStyle}>Saudi Training (SAR)<Tip tipKey="training" /></label><input type="number" value={a.training || ''} onChange={e => upd('training', Number(e.target.value))} placeholder="0" style={inputStyle} /></div><div><label style={labelStyle}>Supplier Development (SAR)<Tip tipKey="supplierDev" /></label><input type="number" value={a.supplierDev || ''} onChange={e => upd('supplierDev', Number(e.target.value))} placeholder="0" style={inputStyle} /></div><div><label style={labelStyle}>R&D in KSA (SAR)<Tip tipKey="rdExpense" /></label><input type="number" value={a.rdExpense || ''} onChange={e => upd('rdExpense', Number(e.target.value))} placeholder="0" style={inputStyle} /></div><div><label style={labelStyle}>Total Revenue (SAR)<Tip tipKey="totalRevenue" /></label><input type="number" value={a.totalRevenue || ''} onChange={e => upd('totalRevenue', Number(e.target.value))} placeholder="0" style={inputStyle} /><div style={{ fontSize: 12, color: score.rdIncentive > 0 ? T.accent : T.dim, marginTop: 4 }}>R&D Incentive: {pct(score.rdIncentive)} (added to final score)</div></div></div><TB label="Total Capacity LC" value={`SAR ${fmt(score.capacityLC)}`} /></>}
        {tab === 'depreciation' && <><SH title="Section 7: Depreciation & Amortization" desc="KSA-produced 100%, foreign 30%. Buildings & Land Improvements in KSA always 100%." />{a.assets.map((ast, i) => { const typeDef = ASSET_TYPES.find(t => t.id === ast.assetType); const isBuilding = !!(typeDef && typeDef.alwaysLocal); const factor = isBuilding ? 1 : (ast.producedInKSA ? 1 : 0.3); return (<div key={i} style={{ padding: mobile ? 12 : 16, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 12, position: 'relative' }}><button onClick={() => rmAsset(i)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: T.danger, cursor: 'pointer', fontSize: 16, padding: 4 }}>✕</button><div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '2fr 2fr 1fr 1fr', gap: 12, alignItems: 'end' }}><div><label style={labelStyle}>Description<Tip tipKey="assetName" /></label><input value={ast.name} onChange={e => updAsset(i, 'name', e.target.value)} placeholder="e.g., Headquarters building" style={inputStyle} /></div><div><label style={labelStyle}>Asset Class<Tip tipKey="assetType" /></label><select value={ast.assetType || 'MACHINERY'} onChange={e => updAsset(i, 'assetType', e.target.value)} style={{ ...inputStyle, cursor: 'pointer', fontSize: 12 }}>{ASSET_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div><div><label style={labelStyle}>Amount (SAR)<Tip tipKey="assetAmount" /></label><input type="number" value={ast.amount || ''} onChange={e => updAsset(i, 'amount', Number(e.target.value))} placeholder="0" style={inputStyle} /></div><div><label style={labelStyle}>Made in KSA?<Tip tipKey="assetKSA" /></label><select value={isBuilding ? 'yes' : (ast.producedInKSA ? 'yes' : 'no')} onChange={e => updAsset(i, 'producedInKSA', e.target.value === 'yes')} disabled={isBuilding} style={{ ...inputStyle, cursor: isBuilding ? 'not-allowed' : 'pointer', opacity: isBuilding ? 0.6 : 1 }}><option value="yes">Yes (100%)</option><option value="no">No (30%)</option></select></div></div><div style={{ fontSize: 12, color: T.accent, marginTop: 8 }}>LC: SAR {fmt((ast.amount || 0) * factor)}{isBuilding && ' • Building in KSA: always 100%'}</div></div>)})}<button onClick={addAsset} style={{ padding: '10px 20px', background: 'transparent', border: `1px dashed ${T.border}`, borderRadius: 8, color: T.muted, fontSize: 13, cursor: 'pointer', width: '100%' }}>+ Add Asset</button><TB label="Total Depreciation LC" value={`SAR ${fmt(score.depLC)}`} /></>}
        {tab === 'summary' && <><SH title="Summary & Recommendations" desc="Full breakdown." /><div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 20 }}>{[{ l: 'Labor', v: score.laborLC, t: score.laborTotal }, { l: 'G&S', v: score.gsLC, t: score.gsTotal }, { l: 'Capacity', v: score.capacityLC, t: 0 }, { l: 'Depreciation', v: score.depLC, t: score.depTotal }].map((x, i) => <div key={i} style={{ padding: 14, background: T.bgInput, borderRadius: 10, border: `1px solid ${T.border}` }}><div style={{ fontSize: 12, color: T.muted, fontWeight: 600, marginBottom: 4 }}>{x.l}</div><div style={{ fontSize: 18, fontWeight: 800, color: T.accent }}>SAR {fmt(x.v)}</div>{x.t > 0 && <div style={{ fontSize: 11, color: T.dim }}>of SAR {fmt(x.t)}</div>}</div>)}</div><h4 style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 12 }}>Recommendations</h4>{recs.map((r, i) => { const c = { critical: T.danger, warning: T.warning, info: '#3b82f6', success: T.success }; return <div key={i} style={{ padding: '12px 14px', borderRadius: 10, marginBottom: 8, border: `1px solid ${c[r.type]}33`, background: `${c[r.type]}0a` }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}><div style={{ fontSize: 13, fontWeight: 700, color: c[r.type] }}>{r.title}</div>{r.ref && <div style={{ fontSize: 10, color: T.dim, fontStyle: 'italic' }}>{r.ref}</div>}</div><div style={{ fontSize: 13, color: T.text, lineHeight: 1.6 }}>{r.text}</div></div> })}</>}
      </div>
    </div>
  )
}
function SH({ title, desc }) { return <><h3 style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 4 }}>{title}</h3><p style={{ fontSize: 13, color: T.muted, marginBottom: 20 }}>{desc}</p></> }
function TB({ label, value }) { return <div style={{ marginTop: 16, padding: 14, background: T.bgInput, borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{label}</span><span style={{ fontSize: 14, fontWeight: 700, color: T.accent }}>{value}</span></div> }
function SP({ label, value, sub, highlight, color }) { return <div style={{ background: highlight ? (color === T.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)') : T.bgCard, border: `1px solid ${highlight ? color : T.border}`, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}><div style={{ fontSize: 10, fontWeight: 600, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{label}</div><div style={{ fontSize: highlight ? 20 : 14, fontWeight: 800, color: highlight ? color : T.text }}>{value}</div>{sub && <div style={{ fontSize: 10, color: T.dim, marginTop: 2 }}>{sub}</div>}</div> }

// Tooltip component for LCGPA field references
function Tip({ tipKey }) {
  const [show, setShow] = useState(false)
  const tip = TOOLTIPS[tipKey]
  if (!tip) return null
  return (
    <span style={{ position: 'relative', display: 'inline-block', marginLeft: 6, cursor: 'help' }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} onClick={() => setShow(!show)}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: T.glow, border: `1px solid rgba(16,185,129,0.3)`, color: T.accent, fontSize: 10, fontWeight: 700 }}>?</span>
      {show && <div style={{ position: 'absolute', bottom: 24, left: -8, width: 280, padding: 14, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 100, fontSize: 12, lineHeight: 1.5 }}>
        <div style={{ fontWeight: 700, color: T.text, marginBottom: 4 }}>{tip.label}</div>
        <div style={{ color: T.muted, marginBottom: 6 }}>{tip.help}</div>
        {tip.factor && <div style={{ color: T.accent, fontWeight: 600, marginBottom: 4 }}>{tip.factor}</div>}
        <div style={{ fontSize: 10, color: T.dim, fontStyle: 'italic' }}>Ref: {tip.ref}</div>
      </div>}
    </span>
  )
}

// ═══ MADE IN SAUDI ═══
function MadeInSaudi({ mobile }) {
  const [step, setStep] = useState(0)
  const [f, setF] = useState({ companyNameEn: '', companyNameAr: '', saudiOwnership: 0, foreignOwnership: 0, govOwnership: 0, productCategory: '', productSubCategory: '', revenueModel: '', businessModel: '', hasRDTeam: null, hasClientResearchTeam: null, hasDesignTeam: null, hasDevTeam: null, hasTestingTeam: null, hasManagementTeam: null, hasMaintenanceTeam: null, usesLocalAssets: null })
  const s = (k, v) => setF(p => ({ ...p, [k]: v }))
  const yc = TEAM_QUESTIONS.filter(q => f[q.key] === true).length
  const rs = yc / TEAM_QUESTIONS.length
  const steps = ['Company', 'Product', 'Presence', 'Results']

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: mobile ? 22 : 28, fontWeight: 800, letterSpacing: '-0.02em', color: T.text, marginBottom: 4 }}>Made in Saudi</h1>
      <p style={{ fontSize: 14, color: T.muted, marginBottom: 24 }}>LCGPA Products Registration Form</p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>{steps.map((st, i) => <div key={i} onClick={() => setStep(i)} style={{ flex: 1, padding: mobile ? '8px 4px' : '10px 16px', background: step === i ? T.glow : T.bgCard, border: `1px solid ${step === i ? 'rgba(16,185,129,0.3)' : T.border}`, borderRadius: 8, textAlign: 'center', fontSize: mobile ? 11 : 13, fontWeight: 600, color: step === i ? T.accent : T.muted, cursor: 'pointer' }}>{i + 1}. {st}</div>)}</div>
      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, padding: mobile ? 16 : 28 }}>
        {step === 0 && <><SH title="Company Information" desc="Ownership details." /><div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 16 }}><div><label style={labelStyle}>Name (English)</label><input value={f.companyNameEn} onChange={e => s('companyNameEn', e.target.value)} style={inputStyle} /></div><div><label style={labelStyle}>Name (Arabic)</label><input value={f.companyNameAr} onChange={e => s('companyNameAr', e.target.value)} style={inputStyle} dir="rtl" /></div><div><label style={labelStyle}>Saudi Ownership %</label><input type="number" value={f.saudiOwnership || ''} onChange={e => s('saudiOwnership', Number(e.target.value))} style={inputStyle} /></div><div><label style={labelStyle}>Foreign Ownership %</label><input type="number" value={f.foreignOwnership || ''} onChange={e => s('foreignOwnership', Number(e.target.value))} style={inputStyle} /></div><div><label style={labelStyle}>Government Ownership %</label><input type="number" value={f.govOwnership || ''} onChange={e => s('govOwnership', Number(e.target.value))} style={inputStyle} /></div></div></>}
        {step === 1 && <><SH title="Product Classification" desc="Category and business model." /><div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 16 }}><div><label style={labelStyle}>Category</label><select value={f.productCategory} onChange={e => { s('productCategory', e.target.value); s('productSubCategory', '') }} style={{ ...inputStyle, cursor: 'pointer' }}><option value="">Select</option>{PRODUCT_CATEGORIES.map(c => <option key={c.main} value={c.main}>{c.main} ({c.mainAr})</option>)}</select></div><div><label style={labelStyle}>Sub-Category</label><select value={f.productSubCategory} onChange={e => s('productSubCategory', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}><option value="">Select</option>{(PRODUCT_CATEGORIES.find(c => c.main === f.productCategory)?.subs || []).map(x => <option key={x}>{x}</option>)}</select></div><div><label style={labelStyle}>Revenue Model</label><select value={f.revenueModel} onChange={e => s('revenueModel', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}><option value="">Select</option>{['SaaS/Usage Based', 'Subscription', 'Transactional/Commission', 'Marketplace', 'Advertising'].map(m => <option key={m}>{m}</option>)}</select></div><div><label style={labelStyle}>Business Model</label><select value={f.businessModel} onChange={e => s('businessModel', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}><option value="">Select</option>{['B2B', 'B2C', 'B2G', 'C2C', 'C2B'].map(m => <option key={m}>{m}</option>)}</select></div></div></>}
        {step === 2 && <><SH title="Local Presence" desc="KSA-based teams." /><div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 10 }}>{TEAM_QUESTIONS.map(q => <div key={q.key} style={{ padding: 14, border: `1px solid ${f[q.key] === true ? 'rgba(16,185,129,0.3)' : f[q.key] === false ? 'rgba(239,68,68,0.2)' : T.border}`, borderRadius: 10, background: f[q.key] === true ? 'rgba(16,185,129,0.05)' : 'transparent' }}><div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 10 }}>{q.label}</div><div style={{ display: 'flex', gap: 8 }}><button onClick={() => s(q.key, true)} style={{ flex: 1, padding: 8, borderRadius: 6, border: `1px solid ${f[q.key] === true ? T.accent : T.border}`, background: f[q.key] === true ? T.glow : 'transparent', color: f[q.key] === true ? T.accent : T.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Yes</button><button onClick={() => s(q.key, false)} style={{ flex: 1, padding: 8, borderRadius: 6, border: `1px solid ${f[q.key] === false ? T.danger : T.border}`, background: f[q.key] === false ? 'rgba(239,68,68,0.1)' : 'transparent', color: f[q.key] === false ? T.danger : T.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>No</button></div></div>)}</div></>}
        {step === 3 && <><SH title="Results" desc="Readiness and gaps." /><div style={{ textAlign: 'center', padding: '24px 0' }}><div style={{ width: 100, height: 100, borderRadius: '50%', border: `4px solid ${rs >= 0.6 ? T.success : rs >= 0.3 ? T.warning : T.danger}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', flexDirection: 'column' }}><div style={{ fontSize: 24, fontWeight: 800, color: rs >= 0.6 ? T.success : rs >= 0.3 ? T.warning : T.danger }}>{Math.round(rs * 100)}%</div><div style={{ fontSize: 10, color: T.muted }}>Ready</div></div><div style={{ fontSize: 15, fontWeight: 700, color: rs >= 0.6 ? T.success : rs >= 0.3 ? T.warning : T.danger }}>{rs >= 0.6 ? 'Strong Candidate' : rs >= 0.3 ? 'Needs Improvement' : 'Significant Gaps'}</div></div>{TEAM_QUESTIONS.filter(q => f[q.key] === false).map(q => <div key={q.key} style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><span style={{ color: T.danger }}>✕</span><span style={{ color: T.text }}>{q.label.replace('?', '')}</span></div>)}{TEAM_QUESTIONS.filter(q => f[q.key] === true).map(q => <div key={q.key} style={{ padding: '10px 12px', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 8, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><span style={{ color: T.success }}>✓</span><span style={{ color: T.text }}>{q.label.replace('?', '')}</span></div>)}</>}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} style={{ padding: '10px 20px', background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 8, color: step === 0 ? T.dim : T.muted, fontSize: 13, fontWeight: 600, cursor: step === 0 ? 'default' : 'pointer' }}>← Prev</button>
          <button onClick={() => setStep(Math.min(3, step + 1))} disabled={step === 3} style={{ ...btnP, padding: '10px 20px', fontSize: 13, opacity: step === 3 ? 0.4 : 1, cursor: step === 3 ? 'default' : 'pointer' }}>Next →</button>
        </div>
      </div>
    </div>
  )
}

// ═══ AI ADVISOR (#3: API failure, #9: rate limited, auth required) ═══
function Advisor({ company, currentAssessment, mobile }) {
  const [msgs, setMsgs] = useState([{ role: 'assistant', content: "I'm your Local Content compliance advisor. I can help you understand LCGPA requirements and recommend actions to improve your score.\n\nTry asking:\n• \"What do I need to reach 40%?\"\n• \"How is labor scored?\"\n• \"What sectors have highest LC?\"\n• \"Do subcontractors need to comply?\"" }])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)
  const score = currentAssessment ? computeScore(currentAssessment) : null
  const checkRate = useRateLimit(10, 60000) // #9: 10 messages per minute (client-side UX)

  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [msgs])

  const ctx = () => {
    let c = `You are Muhtawa AI Compliance Advisor, expert on Saudi LCGPA requirements (Template ${TEMPLATE_VERSION}).\n\nKEY RULES (V2):\n- Min LC score for govt procurement: 40%\n- Final LC % = min(100%, (TotalLC / TotalCost) + R&D Incentive)\n- Labor: Saudi 100%, foreign 53.4%\n- G&S: 38 sectors with predefined scores; weighted-avg applies to inventory and remaining G&S\n- Capacity (Section 6): Training + supplier dev + R&D all at 100% (R&D also earns up to 10% bonus at 2% of revenue)\n- Depreciation (Section 7): KSA 100%, foreign 30%. Buildings & Land Improvements in KSA always 100%.\n\nSECTORS:\n${SECTORS.map(s => `${s.name}: ${pct(s.score)}`).join('\n')}\n`
    if (company) c += `\nCOMPANY: ${company.name}, Sector: ${company.sector}`
    if (score) c += `\nSCORE: ${pct(score.totalScore)} (ratio ${pct(score.rawLcRatio)} + R&D ${pct(score.rdIncentive)}) | Labor: SAR ${fmt(score.laborLC)}/${fmt(score.laborTotal)} | G&S: SAR ${fmt(score.gsLC)}/${fmt(score.gsTotal)} | Capacity: SAR ${fmt(score.capacityLC)} | Dep: SAR ${fmt(score.depLC)}/${fmt(score.depTotal)} | Total: SAR ${fmt(score.totalLC)}/${fmt(score.totalCost)}`
    c += '\n\nReference LCGPA V2 sections. Give prescriptive recommendations with numbers. Be direct.'
    return c
  }

  const send = async () => {
    if (!input.trim() || busy) return
    // #9: rate limit
    if (!checkRate()) { setMsgs(p => [...p, { role: 'assistant', content: 'Please wait a moment before sending another message.' }]); return }
    const um = { role: 'user', content: input.trim() }
    setMsgs(p => [...p, um]); setInput(''); setBusy(true)
    try {
      // #3: timeout and graceful failure
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000) // 30s timeout
      // Include auth token — chat endpoint now requires authenticated user
      const authHeader = await getAuthHeader()
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ system: ctx(), messages: [...msgs.filter((_, i) => i > 0), um].map(m => ({ role: m.role, content: m.content })) }),
        signal: controller.signal
      })
      clearTimeout(timeout)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      const text = data.text || 'I could not process that. Please try rephrasing.'
      setMsgs(p => [...p, { role: 'assistant', content: text }])
    } catch (e) {
      // #3 & #10: graceful failure with safe error message
      const raw = e?.message || ''
      let msg
      if (e.name === 'AbortError') {
        msg = 'Request timed out. The AI service may be busy. Please try again.'
      } else if (/sign in|401/i.test(raw)) {
        msg = 'Your session has expired. Please sign out and sign back in.'
      } else if (/rate limit|429/i.test(raw)) {
        msg = 'You are sending messages too fast. Please wait a moment.'
      } else {
        msg = 'Unable to reach the AI service. Please check your connection and try again.'
      }
      setMsgs(p => [...p, { role: 'assistant', content: msg }])
    }
    setBusy(false)
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
      <div style={{ marginBottom: 12 }}><h1 style={{ fontSize: mobile ? 22 : 28, fontWeight: 800, letterSpacing: '-0.02em', color: T.text, marginBottom: 4 }}>AI Advisor</h1><p style={{ fontSize: 13, color: T.muted }}>Ask about LCGPA requirements.</p></div>
      {score && <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}><div style={{ padding: '6px 12px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }}><span style={{ color: T.muted }}>Score: </span><span style={{ fontWeight: 700, color: score.meetsThreshold ? T.success : T.danger }}>{pct(score.totalScore)}</span></div><div style={{ padding: '6px 12px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }}><span style={{ color: T.muted }}>Gap: </span><span style={{ fontWeight: 700, color: score.meetsThreshold ? T.success : T.danger }}>{score.meetsThreshold ? 'None' : pct(score.gap)}</span></div></div>}
      <div ref={ref} style={{ flex: 1, overflowY: 'auto', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: '16px 16px 0 0', padding: mobile ? 12 : 24 }}>
        {msgs.map((m, i) => <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}><div style={{ maxWidth: mobile ? '90%' : '75%', padding: '10px 14px', borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px', background: m.role === 'user' ? `linear-gradient(135deg, ${T.accent}, ${T.accentDim})` : T.bgInput, color: m.role === 'user' ? '#fff' : T.text, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.content}</div></div>)}
        {busy && <div style={{ display: 'flex', gap: 6, padding: '12px 16px' }}>{[0, 1, 2].map(i => <div key={i} className="loading-dot" style={{ width: 8, height: 8, borderRadius: 4, background: T.accent, animationDelay: `${i * 0.2}s` }} />)}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, background: T.bgCard, border: `1px solid ${T.border}`, borderTop: 'none', borderRadius: '0 0 16px 16px', padding: mobile ? 10 : 16 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Ask about compliance..." style={{ flex: 1, padding: '10px 14px', background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 14, outline: 'none' }} />
        <button onClick={send} disabled={busy || !input.trim()} style={{ ...btnP, padding: '10px 20px', opacity: input.trim() ? 1 : 0.4 }}>Send</button>
      </div>
    </div>
  )
}

// ═══ REGULATIONS ADMIN ═══
// PDF upload has been removed. To add a regulation, paste the text into
// the Content field (use Gemini or similar to extract text from PDFs).
const REG_CATEGORIES = ['Eligibility', 'Scoring Methodology', 'Submission Process', 'Thresholds', 'Exemptions', 'Penalties', 'Made in Saudi', 'Procurement Rules', 'General', 'Other']

function RegulationsAdmin({ user, mobile }) {
  const [regs, setRegs] = useState([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('list') // list, add, edit
  const [editReg, setEditReg] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [form, setForm] = useState({ source: 'LCGPA', title: '', category: 'General', subcategory: '', document_name: '', article_numbers: '', content: '', summary: '', effective_date: '' })

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }
  const s = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // Load regulations
  useEffect(() => {
    (async () => {
      try {
        const headers = await getAuthHeader()
        const res = await fetch('/api/regulations', { headers })
        if (res.ok) {
          const data = await res.json()
          setRegs(data.regulations || [])
        }
      } catch {}
      setLoading(false)
    })()
  }, [])

  // Save regulation
  const handleSave = async () => {
    if (!form.title || !form.content || !form.category) { showToast('Title, category, and content are required'); return }
    setSaving(true)
    try {
      const headers = await getAuthHeader()
      const method = editReg ? 'PUT' : 'POST'
      const body = editReg ? { id: editReg.id, ...form } : form

      const res = await fetch('/api/regulations', {
        method,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const data = await res.json()
        if (editReg) {
          setRegs(prev => prev.map(r => r.id === editReg.id ? data.regulation : r))
        } else {
          setRegs(prev => [...prev, data.regulation])
        }
        showToast(editReg ? 'Regulation updated' : 'Regulation saved')
        resetForm()
      } else {
        let errMsg = `Save failed (${res.status})`
        try { const err = await res.json(); errMsg = err.error || errMsg } catch {}
        showToast(errMsg)
      }
    } catch (e) {
      showToast('Failed to save: ' + (e.message || 'Unknown error'))
    }
    setSaving(false)
  }

  // Delete regulation
  const handleDelete = async (id) => {
    if (!confirm('Remove this regulation?')) return
    try {
      const headers = await getAuthHeader()
      await fetch('/api/regulations', {
        method: 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setRegs(prev => prev.filter(r => r.id !== id))
      showToast('Regulation removed')
    } catch { showToast('Failed to delete') }
  }

  const resetForm = () => {
    setForm({ source: 'LCGPA', title: '', category: 'General', subcategory: '', document_name: '', article_numbers: '', content: '', summary: '', effective_date: '' })
    setEditReg(null)
    setMode('list')
  }

  const startEdit = (reg) => {
    setForm({
      source: reg.source, title: reg.title, category: reg.category,
      subcategory: reg.subcategory || '', document_name: reg.document_name || '',
      article_numbers: reg.article_numbers || '', content: reg.content,
      summary: reg.summary || '', effective_date: reg.effective_date || '',
    })
    setEditReg(reg)
    setMode('edit')
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: T.muted }}>Loading regulations...</div>

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: mobile ? 22 : 28, fontWeight: 800, letterSpacing: '-0.02em', color: T.text, marginBottom: 4 }}>Regulations Knowledge Base</h1>
          <p style={{ fontSize: 13, color: T.muted }}>{regs.length} regulations loaded. Paste LCGPA/EXPRO regulation text to power the AI advisor.</p>
        </div>
        {mode === 'list' && <button onClick={() => setMode('add')} style={{ ...btnP, padding: '10px 20px', fontSize: 13 }}>+ Add Regulation</button>}
      </div>

      {toast && <div className="fade-in" style={{ padding: '10px 16px', background: /fail|error|required/i.test(toast) ? 'rgba(239,68,68,0.15)' : T.glow, border: `1px solid ${/fail|error|required/i.test(toast) ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`, borderRadius: 8, color: /fail|error|required/i.test(toast) ? T.danger : T.accent, fontSize: 13, marginBottom: 16 }}>{toast}</div>}

      {/* ADD / EDIT FORM */}
      {(mode === 'add' || mode === 'edit') && (
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, padding: mobile ? 16 : 28, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{editReg ? 'Edit Regulation' : 'Add New Regulation'}</h3>
            <button onClick={resetForm} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 14 }}>← Back to list</button>
          </div>

          {/* Help text — replaces the removed PDF upload UI */}
          <div style={{ padding: 14, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 20, background: T.bgInput }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 4 }}>How to add a regulation</div>
            <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6 }}>Paste the regulation text into the <b>Content</b> field below. For PDFs (especially scanned or Arabic documents), extract the text using Gemini or another tool first, then paste the clean text here.</div>
          </div>

          {/* Form fields */}
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Source</label>
              <input list="source-list" value={form.source} onChange={e => s('source', e.target.value)} placeholder="e.g., LCGPA, EXPRO, MISA, MOF" style={inputStyle} />
              <datalist id="source-list">
                {[...new Set(['LCGPA', 'EXPRO', 'MISA', 'MOF', 'SDAIA', 'MCI', ...regs.map(r => r.source)])].map(src => <option key={src} value={src} />)}
              </datalist>
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <select value={form.category} onChange={e => s('category', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {REG_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Title</label>
              <input value={form.title} onChange={e => s('title', e.target.value)} placeholder="e.g., Executive Regulations — Eligibility Criteria" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Document Name</label>
              <input value={form.document_name} onChange={e => s('document_name', e.target.value)} placeholder="e.g., LCGPA Executive Regulations 2024" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Article Numbers</label>
              <input value={form.article_numbers} onChange={e => s('article_numbers', e.target.value)} placeholder="e.g., Articles 11-15" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Effective Date</label>
              <input type="date" value={form.effective_date} onChange={e => s('effective_date', e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Summary (brief description for search matching)</label>
            <textarea value={form.summary} onChange={e => s('summary', e.target.value)} rows={2} placeholder="One-line summary of what this regulation covers..." style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Content</label>
              <span style={{ fontSize: 11, color: T.dim }}>{form.content.length.toLocaleString()} chars</span>
            </div>
            <textarea value={form.content} onChange={e => s('content', e.target.value)} rows={16} placeholder="Paste regulation text here..." style={{ ...inputStyle, resize: 'vertical', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, lineHeight: 1.6 }} />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleSave} disabled={saving} style={{ ...btnP, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving...' : editReg ? 'Update Regulation' : 'Save Regulation'}
            </button>
            <button onClick={resetForm} style={{ padding: '12px 24px', background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 8, color: T.muted, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* REGULATIONS LIST */}
      {mode === 'list' && (
        <div>
          {regs.length === 0 ? (
            <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
              <p style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 8 }}>No regulations uploaded yet</p>
              <p style={{ fontSize: 13, color: T.muted, marginBottom: 20 }}>Paste LCGPA and EXPRO regulation text to give the AI Advisor authoritative knowledge.</p>
              <button onClick={() => setMode('add')} style={{ ...btnP, padding: '10px 24px', fontSize: 13 }}>Add First Regulation</button>
            </div>
          ) : (
            <>
              {[...new Set(regs.map(r => r.source))].sort().map(source => {
                const sourceRegs = regs.filter(r => r.source === source)
                if (sourceRegs.length === 0) return null
                return (
                  <div key={source} style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: T.accent, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{source} — {sourceRegs.length} regulation{sourceRegs.length !== 1 ? 's' : ''}</h3>
                    {sourceRegs.map(reg => (
                      <div key={reg.id} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: mobile ? 14 : 20, marginBottom: 8, transition: 'border-color 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = T.accentDim}
                        onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>{reg.title}</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                              <span style={{ padding: '2px 8px', background: T.glow, borderRadius: 4, fontSize: 11, fontWeight: 600, color: T.accent }}>{reg.category}</span>
                              {reg.article_numbers && <span style={{ padding: '2px 8px', background: `${T.warning}15`, borderRadius: 4, fontSize: 11, fontWeight: 600, color: T.warning }}>{reg.article_numbers}</span>}
                              {reg.document_name && <span style={{ fontSize: 11, color: T.dim }}>{reg.document_name}</span>}
                            </div>
                            {reg.summary && <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>{reg.summary}</div>}
                            <div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>{reg.content.length.toLocaleString()} chars</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button onClick={() => startEdit(reg)} style={{ padding: '6px 12px', background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 6, color: T.muted, fontSize: 12, cursor: 'pointer' }}>Edit</button>
                            <button onClick={() => handleDelete(reg.id)} style={{ padding: '6px 12px', background: 'transparent', border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 6, color: T.danger, fontSize: 12, cursor: 'pointer' }}>Remove</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}
