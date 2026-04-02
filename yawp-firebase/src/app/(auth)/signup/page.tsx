'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import Link from 'next/link'

const S: Record<string, React.CSSProperties> = {
  page: { minHeight:'100vh', background:'#0D0D0D', display:'flex', alignItems:'center', justifyContent:'center', padding:20 },
  box: { width:'100%', maxWidth:400 },
  logo: { display:'inline-block', background:'#E8FF47', color:'#0D0D0D', fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:18, padding:'5px 14px', borderRadius:8, marginBottom:12 },
  input: { width:'100%', background:'#141414', border:'1px solid #2A2A2A', borderRadius:10, padding:'12px 16px', color:'#F0F0F0', fontSize:15, outline:'none' },
  btn: { width:'100%', background:'#E8FF47', border:'none', borderRadius:10, padding:13, color:'#0D0D0D', fontWeight:700, fontSize:15, cursor:'pointer', marginTop:4 },
  error: { color:'#FF6B6B', fontSize:13 },
}

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password)
      // Create profile document in Firestore
      await setDoc(doc(db, 'profiles', user.uid), {
        username: username.toLowerCase(),
        displayName: username,
        bio: '',
        avatarUrl: null,
        isPlus: false,
        createdAt: Date.now(),
      })
      router.push('/feed')
    } catch (err: any) {
      setError(err.message.replace('Firebase: ', '').replace(/\(auth.*\)/, ''))
    }
    setLoading(false)
  }

  return (
    <div style={S.page}>
      <div style={S.box}>
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={S.logo}>YAWP</div>
          <p style={{ color:'#888', fontSize:14, fontFamily:'Georgia,serif' }}>Your voice. No algorithm. No nonsense.</p>
        </div>
        <form onSubmit={handleSignup} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <input style={S.input} type="text" placeholder="Username"
            value={username} required
            onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,''))} />
          <input style={S.input} type="email" placeholder="Email address"
            value={email} required onChange={e => setEmail(e.target.value)} />
          <input style={S.input} type="password" placeholder="Password (min 8 characters)"
            value={password} required minLength={8} onChange={e => setPassword(e.target.value)} />
          {error && <p style={S.error}>{error}</p>}
          <button type="submit" style={S.btn} disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p style={{ textAlign:'center', color:'#555', fontSize:13, marginTop:20 }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color:'#E8FF47' }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
