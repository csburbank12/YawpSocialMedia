'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/AuthContext'
import { launchDemo } from '@/lib/demoSeed'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoStatus, setDemoStatus] = useState('')
  const [demoError, setDemoError] = useState('')

  const tryDemo = async () => {
    setDemoLoading(true)
    setDemoError('')
    setDemoStatus('Checking demo account…')
    try {
      await launchDemo()
      setDemoStatus('Ready!')
      router.push('/feed')
    } catch {
      setDemoError('Demo unavailable. Please try again shortly.')
      setDemoLoading(false)
      setDemoStatus('')
    }
  }

  useEffect(() => {
    if (!loading && user) router.push('/feed')
  }, [user, loading])

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#0D0D0D', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#555', fontFamily:"'DM Mono',monospace", fontSize:13 }}>Loading...</div>
    </div>
  )

  return (
    <div style={{
      minHeight:'100vh', background:'#0D0D0D',
      display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      padding:24, textAlign:'center'
    }}>
      <div style={{
        display:'inline-block', background:'#E8FF47', color:'#0D0D0D',
        fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:28,
        padding:'8px 20px', borderRadius:10, marginBottom:24
      }}>YAWP</div>

      <h1 style={{
        fontSize:'clamp(28px,5vw,48px)', fontWeight:700, lineHeight:1.2,
        maxWidth:600, marginBottom:16, color:'#F0F0F0'
      }}>
        Sound your barbaric yawp.
      </h1>

      <p style={{
        color:'#888', fontSize:18, maxWidth:480,
        lineHeight:1.6, marginBottom:40, fontFamily:'Georgia,serif'
      }}>
        A text-first, chronological, algorithm-free social network.
        No ads. No outrage machine. Just people saying something worth saying.
      </p>

      <div style={{ display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center' }}>
        <Link href="/signup" style={{
          background:'#E8FF47', color:'#0D0D0D', fontWeight:700,
          padding:'13px 28px', borderRadius:24, fontSize:15
        }}>Join Yawp</Link>
        <Link href="/login" style={{
          background:'none', color:'#F0F0F0', fontWeight:600,
          padding:'13px 28px', borderRadius:24, fontSize:15,
          border:'1px solid #2A2A2A'
        }}>Sign in</Link>
      </div>

      <div style={{ marginTop:32, textAlign:'center' }}>
        <div style={{ color:'#333', fontSize:12, fontFamily:"'DM Mono',monospace", marginBottom:14, letterSpacing:'0.08em' }}>— or —</div>
        <button
          onClick={tryDemo}
          disabled={demoLoading}
          style={{
            background:'none', border:'1px solid #2A2A2A', borderRadius:24,
            padding:'11px 26px', color: demoLoading ? '#555' : '#888',
            fontSize:14, cursor: demoLoading ? 'default' : 'pointer',
            fontFamily:"'DM Mono',monospace", transition:'color 0.2s, border-color 0.2s'
          }}
          onMouseEnter={e => { if (!demoLoading) { (e.currentTarget as HTMLButtonElement).style.borderColor='#E8FF47'; (e.currentTarget as HTMLButtonElement).style.color='#E8FF47' }}}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor='#2A2A2A'; (e.currentTarget as HTMLButtonElement).style.color='#888' }}
        >
          {demoLoading ? (demoStatus || 'Setting up demo…') : 'Try a demo account →'}
        </button>
        <p style={{ color:'#444', fontSize:12, marginTop:8, fontFamily:'Georgia,serif' }}>
          No sign-up needed. Explore Yawp as a real user.
        </p>
        {demoError && <p style={{ color:'#FF6B6B', fontSize:12, marginTop:6 }}>{demoError}</p>}
      </div>

      <div style={{
        display:'flex', gap:32, marginTop:64, flexWrap:'wrap', justifyContent:'center',
        color:'#555', fontSize:13, fontFamily:"'DM Mono',monospace"
      }}>
        <span>No algorithm</span>
        <span>No ads</span>
        <span>No follower counts</span>
        <span>Chronological always</span>
      </div>
    </div>
  )
}
