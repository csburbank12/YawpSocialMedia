'use client'
import { useState } from 'react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import Link from 'next/link'

const S: Record<string, React.CSSProperties> = {
  page: { minHeight:'100vh', background:'#0D0D0D', display:'flex', alignItems:'center', justifyContent:'center', padding:20 },
  box: { width:'100%', maxWidth:400 },
  logo: { display:'inline-block', background:'#E8FF47', color:'#0D0D0D', fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:18, padding:'5px 14px', borderRadius:8, marginBottom:12 },
  input: { width:'100%', background:'#141414', border:'1px solid #2A2A2A', borderRadius:10, padding:'12px 16px', color:'#F0F0F0', fontSize:15, outline:'none' },
  btn: { width:'100%', background:'#E8FF47', border:'none', borderRadius:10, padding:13, color:'#0D0D0D', fontWeight:700, fontSize:15, cursor:'pointer', marginTop:4 },
  error: { color:'#FF6B6B', fontSize:13 },
  success: { color:'#47FFB2', fontSize:14, fontFamily:'Georgia,serif', lineHeight:1.6, textAlign:'center' as const },
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await sendPasswordResetEmail(auth, email)
      setSent(true)
    } catch (err: any) {
      setError(err.message.replace('Firebase: ', '').replace(/\(auth.*\)/, '').trim())
    }
    setLoading(false)
  }

  return (
    <div style={S.page}>
      <div style={S.box}>
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={S.logo}>YAWP</div>
          <p style={{ color:'#888', fontSize:14, fontFamily:'Georgia,serif' }}>Reset your password.</p>
        </div>

        {sent ? (
          <div style={{ background:'#0D1A0D', border:'1px solid #1A3A1A', borderRadius:14, padding:'28px 24px', textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:16 }}>✉</div>
            <p style={S.success}>
              Check your inbox. We&apos;ve sent a reset link to <strong style={{ color:'#E8FF47' }}>{email}</strong>.
            </p>
            <p style={{ color:'#555', fontSize:12, fontFamily:"'DM Mono',monospace", marginTop:12 }}>
              Didn&apos;t get it? Check your spam folder.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <input style={S.input} type="email" placeholder="Your email address"
              value={email} required onChange={e => setEmail(e.target.value)} autoFocus />
            {error && <p style={S.error}>{error}</p>}
            <button type="submit" style={S.btn} disabled={loading}>
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}

        <p style={{ textAlign:'center', color:'#555', fontSize:13, marginTop:24 }}>
          <Link href="/login" style={{ color:'#E8FF47' }}>← Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
