'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'
import { createSocialProfile } from '@/lib/socialAuth'

const S: Record<string, React.CSSProperties> = {
  page: { minHeight:'100vh', background:'#0D0D0D', display:'flex', alignItems:'center', justifyContent:'center', padding:20 },
  box: { width:'100%', maxWidth:400 },
  logo: { display:'inline-block', background:'#E8FF47', color:'#0D0D0D', fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:18, padding:'5px 14px', borderRadius:8, marginBottom:12 },
  input: { width:'100%', background:'#141414', border:'1px solid #2A2A2A', borderRadius:10, padding:'12px 16px', color:'#F0F0F0', fontSize:15, outline:'none' },
  btn: { width:'100%', background:'#E8FF47', border:'none', borderRadius:10, padding:13, color:'#0D0D0D', fontWeight:700, fontSize:15, cursor:'pointer', marginTop:4 },
  error: { color:'#FF6B6B', fontSize:13 },
}

export default function CompleteProfilePage() {
  const { user, profile, loading, refreshProfile } = useAuth()
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
    if (!loading && user && profile) router.push('/feed')
  }, [user, profile, loading])

  useEffect(() => {
    if (user?.displayName) setDisplayName(user.displayName)
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError('')
    try {
      await createSocialProfile(user.uid, username, displayName, user.photoURL || null)
      await refreshProfile()
      router.push('/feed')
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    }
    setSaving(false)
  }

  if (loading || (!loading && profile)) return (
    <div style={{ minHeight:'100vh', background:'#0D0D0D', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#555', fontFamily:"'DM Mono',monospace", fontSize:13 }}>Loading...</div>
    </div>
  )

  return (
    <div style={S.page}>
      <div style={S.box}>
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={S.logo}>YAWP</div>
          <h2 style={{ color:'#F0F0F0', fontSize:20, fontFamily:'Georgia,serif', marginBottom:8 }}>Almost there!</h2>
          <p style={{ color:'#888', fontSize:14, fontFamily:'Georgia,serif' }}>Pick a username to complete your account.</p>
        </div>

        {user?.photoURL && (
          <div style={{ textAlign:'center', marginBottom:24 }}>
            <img
              src={user.photoURL}
              alt="avatar"
              style={{ width:64, height:64, borderRadius:'50%', border:'2px solid #2A2A2A' }}
              referrerPolicy="no-referrer"
            />
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <input
            style={S.input}
            type="text"
            placeholder="Username (letters, numbers, underscores)"
            value={username}
            required
            minLength={3}
            maxLength={20}
            onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          />
          <input
            style={S.input}
            type="text"
            placeholder="Display name"
            value={displayName}
            required
            maxLength={40}
            onChange={e => setDisplayName(e.target.value)}
          />
          {error && <p style={S.error}>{error}</p>}
          <button type="submit" style={S.btn} disabled={saving}>
            {saving ? 'Setting up...' : 'Start yawping'}
          </button>
        </form>
      </div>
    </div>
  )
}
