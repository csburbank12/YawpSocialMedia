'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth, googleProvider, githubProvider } from '@/lib/firebase'
import { signInWithSocial } from '@/lib/socialAuth'
import { launchDemo } from '@/lib/demoSeed'
import Link from 'next/link'

const S: Record<string, React.CSSProperties> = {
  page: { minHeight:'100vh', background:'#0D0D0D', display:'flex', alignItems:'center', justifyContent:'center', padding:20 },
  box: { width:'100%', maxWidth:400 },
  logo: { display:'inline-block', background:'#E8FF47', color:'#0D0D0D', fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:18, padding:'5px 14px', borderRadius:8, marginBottom:12 },
  input: { width:'100%', background:'#141414', border:'1px solid #2A2A2A', borderRadius:10, padding:'12px 16px', color:'#F0F0F0', fontSize:15, outline:'none' },
  btn: { width:'100%', background:'#E8FF47', border:'none', borderRadius:10, padding:13, color:'#0D0D0D', fontWeight:700, fontSize:15, cursor:'pointer', marginTop:4 },
  socialBtn: { width:'100%', background:'#141414', border:'1px solid #2A2A2A', borderRadius:10, padding:13, color:'#F0F0F0', fontWeight:600, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, transition:'border-color 0.2s' },
  error: { color:'#FF6B6B', fontSize:13 },
  divider: { display:'flex', alignItems:'center', gap:10, margin:'20px 0' },
  dividerLine: { flex:1, height:1, background:'#1E1E1E' },
  dividerText: { color:'#555', fontSize:12, fontFamily:"'DM Mono',monospace" },
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState('')
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoStatus, setDemoStatus] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await signInWithEmailAndPassword(auth, email, password)
      router.push('/feed')
    } catch (err: any) {
      setError('Invalid email or password. Please try again.')
    }
    setLoading(false)
  }

  const handleSocial = async (provider: typeof googleProvider | typeof githubProvider, name: string) => {
    setSocialLoading(name)
    setError('')
    try {
      const { isNewUser } = await signInWithSocial(provider)
      router.push(isNewUser ? '/complete-profile' : '/feed')
    } catch (err: any) {
      const msg = err.message || ''
      if (msg.includes('popup-closed-by-user')) {
        // User closed the popup — not an error
      } else if (msg.includes('account-exists-with-different-credential')) {
        setError('An account already exists with this email. Try signing in with a different method.')
      } else {
        setError(msg.replace('Firebase: ', '').replace(/\(auth.*\)/, ''))
      }
    }
    setSocialLoading('')
  }

  const tryDemo = async () => {
    setDemoLoading(true)
    setDemoStatus('Setting up demo…')
    try {
      await launchDemo()
      router.push('/feed')
    } catch (err: any) {
      setDemoStatus(err?.message || err?.code || 'Demo unavailable — try again shortly.')
      setDemoLoading(false)
    }
  }

  return (
    <div style={S.page}>
      <div style={S.box}>
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={S.logo}>YAWP</div>
          <p style={{ color:'#888', fontSize:14, fontFamily:'Georgia,serif' }}>Welcome back.</p>
        </div>

        {/* Social login buttons */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <button
            style={S.socialBtn}
            disabled={!!socialLoading}
            onClick={() => handleSocial(googleProvider, 'google')}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#E8FF47' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2A2A2A' }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            {socialLoading === 'google' ? 'Connecting...' : 'Continue with Google'}
          </button>
          <button
            style={S.socialBtn}
            disabled={!!socialLoading}
            onClick={() => handleSocial(githubProvider, 'github')}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#E8FF47' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2A2A2A' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#F0F0F0"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
            {socialLoading === 'github' ? 'Connecting...' : 'Continue with GitHub'}
          </button>
        </div>

        <div style={S.divider}>
          <div style={S.dividerLine} />
          <span style={S.dividerText}>or sign in with email</span>
          <div style={S.dividerLine} />
        </div>

        <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <input style={S.input} type="email" placeholder="Email address"
            value={email} required onChange={e => setEmail(e.target.value)} />
          <input style={S.input} type="password" placeholder="Password"
            value={password} required onChange={e => setPassword(e.target.value)} />
          {error && <p style={S.error}>{error}</p>}
          <button type="submit" style={S.btn} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div style={S.divider}>
          <div style={S.dividerLine} />
          <span style={S.dividerText}>or</span>
          <div style={S.dividerLine} />
        </div>

        <button onClick={tryDemo} disabled={demoLoading} style={{ width:'100%', background:'#141414', border:'1px solid #3A3A3A', borderRadius:10, padding:13, color: demoLoading ? '#666' : '#AAA', fontWeight:600, fontSize:14, cursor: demoLoading ? 'default' : 'pointer', fontFamily:"'DM Mono',monospace", transition:'all 0.2s' }}
          onMouseEnter={e => { if (!demoLoading) { const b = e.currentTarget; b.style.borderColor='#E8FF47'; b.style.color='#E8FF47' }}}
          onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor='#3A3A3A'; b.style.color='#AAA' }}>
          {demoLoading ? demoStatus : '▶ Try a demo account — no sign-up needed'}
        </button>

        <p style={{ textAlign:'center', color:'#555', fontSize:13, marginTop:20 }}>
          New to Yawp?{' '}
          <Link href="/signup" style={{ color:'#E8FF47' }}>Create an account</Link>
        </p>
      </div>
    </div>
  )
}
