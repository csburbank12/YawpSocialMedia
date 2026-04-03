'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore'
import { useAuth } from '@/lib/AuthContext'
import { launchDemo } from '@/lib/demoSeed'
import { db } from '@/lib/firebase'

const FEATURES = [
  { icon: '⟳', title: 'Chronological always', body: 'No ranking. No sorting by engagement. Posts in the order they were written.' },
  { icon: '◈', title: 'Zero algorithm', body: 'Nothing curates your feed but time. What you see is what people actually said, when they said it.' },
  { icon: '✦', title: 'No ads. Ever.', body: 'Supported by the people who use it — not by companies who want to influence them.' },
  { icon: '◎', title: 'Circles', body: 'Intimate group spaces built around what you care about. Not hashtags. Not public forums. Circles.' },
  { icon: '—', title: 'Private follower counts', body: "Your follower count is visible only to you. Your voice isn't a number." },
  { icon: 'T', title: 'Text-first design', body: 'No images to scroll past. No autoplay video. No infinite carousels. Just words — and the people who mean them.' },
]

const COMPARE = [
  { feature: 'Chronological feed',      yawp: true,  twitter: false, threads: false, masto: true  },
  { feature: 'No advertising',          yawp: true,  twitter: false, threads: false, masto: true  },
  { feature: 'No recommendation engine',yawp: true,  twitter: false, threads: false, masto: false },
  { feature: 'Private follower counts', yawp: true,  twitter: false, threads: false, masto: false },
  { feature: 'Group circles',           yawp: true,  twitter: false, threads: false, masto: false },
  { feature: 'Text-first UX',           yawp: true,  twitter: false, threads: false, masto: true  },
]

function useTypewriter(text: string, speed = 38) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (displayed.length < text.length) {
      const t = setTimeout(() => setDisplayed(text.slice(0, displayed.length + 1)), speed)
      return () => clearTimeout(t)
    } else {
      setDone(true)
    }
  }, [displayed, text, speed])
  return { displayed, done }
}

function useStats() {
  const [stats, setStats] = useState({ writers: 0, posts: 0, circles: 0 })
  useEffect(() => {
    const load = async () => {
      try {
        const yesterday = Date.now() - 86_400_000
        const [profilesSnap, postsSnap, circlesSnap] = await Promise.all([
          getDocs(collection(db, 'profiles')),
          getDocs(query(collection(db, 'posts'), where('createdAt', '>', yesterday))),
          getDocs(collection(db, 'circles')),
        ])
        setStats({ writers: profilesSnap.size, posts: postsSnap.size, circles: circlesSnap.size })
      } catch {}
    }
    load()
  }, [])
  return stats
}

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoStatus, setDemoStatus] = useState('')
  const [demoError, setDemoError] = useState('')
  const { displayed, done } = useTypewriter('Sound your barbaric yawp.')
  const stats = useStats()

  useEffect(() => {
    if (!loading && user) router.push('/feed')
  }, [user, loading])

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

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#0D0D0D', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#555', fontFamily:"'DM Mono',monospace", fontSize:13 }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ background:'#0D0D0D', color:'#F0F0F0', minHeight:'100vh' }}>

      {/* ── Top nav ── */}
      <header style={{ position:'sticky', top:0, zIndex:50, background:'rgba(13,13,13,0.9)', backdropFilter:'blur(12px)', borderBottom:'1px solid #1A1A1A', padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ background:'#E8FF47', color:'#0D0D0D', fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:15, padding:'5px 12px', borderRadius:7 }}>YAWP</div>
        <div style={{ display:'flex', gap:10 }}>
          <Link href="/login" style={{ background:'none', border:'1px solid #2A2A2A', borderRadius:20, padding:'7px 18px', color:'#888', fontSize:13, cursor:'pointer' }}>Sign in</Link>
          <Link href="/signup" style={{ background:'#E8FF47', border:'none', borderRadius:20, padding:'7px 18px', color:'#0D0D0D', fontWeight:700, fontSize:13, cursor:'pointer' }}>Join Yawp</Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{ maxWidth:720, margin:'0 auto', padding:'96px 24px 80px', textAlign:'center' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#141414', border:'1px solid #2A2A2A', borderRadius:20, padding:'6px 14px', marginBottom:32, fontSize:12, color:'#888', fontFamily:"'DM Mono',monospace" }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:'#47FFB2', display:'inline-block' }} />
          No algorithm. No ads. No nonsense.
        </div>

        <h1 style={{ fontSize:'clamp(36px,6vw,64px)', fontWeight:700, lineHeight:1.1, marginBottom:24, fontFamily:'Georgia,serif', letterSpacing:'-0.02em', minHeight:'1.1em' }}>
          {displayed}
          {!done && <span style={{ opacity: 0.6, animation:'blink 1s step-end infinite' }}>|</span>}
        </h1>

        <p style={{ color:'#888', fontSize:'clamp(16px,2vw,20px)', maxWidth:520, margin:'0 auto 48px', lineHeight:1.7, fontFamily:'Georgia,serif' }}>
          A social network built for humans. Text-first. Chronological always. Free of the machine that turned the internet into a performance.
        </p>

        <div style={{ display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center', marginBottom:24 }}>
          <Link href="/signup" style={{ background:'#E8FF47', color:'#0D0D0D', fontWeight:700, padding:'14px 32px', borderRadius:28, fontSize:16, display:'inline-block' }}>
            Join Yawp — it&apos;s free
          </Link>
          <Link href="/login" style={{ background:'none', color:'#F0F0F0', fontWeight:600, padding:'14px 32px', borderRadius:28, fontSize:16, border:'1px solid #2A2A2A', display:'inline-block' }}>
            Sign in
          </Link>
        </div>

        <div style={{ marginTop:8 }}>
          <div style={{ color:'#555', fontSize:12, fontFamily:"'DM Mono',monospace", marginBottom:14, letterSpacing:'0.08em' }}>— or —</div>
          <button onClick={tryDemo} disabled={demoLoading} style={{ background:'#141414', border:'1px solid #3A3A3A', borderRadius:24, padding:'12px 28px', color: demoLoading ? '#666' : '#AAA', fontSize:14, cursor: demoLoading ? 'default' : 'pointer', fontFamily:"'DM Mono',monospace", transition:'color 0.2s, border-color 0.2s, background 0.2s' }}
            onMouseEnter={e => { if (!demoLoading) { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor='#E8FF47'; b.style.color='#E8FF47'; b.style.background='#0D1500' }}}
            onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor='#3A3A3A'; b.style.color='#AAA'; b.style.background='#141414' }}>
            {demoLoading ? (demoStatus || 'Setting up demo…') : '▶ Try a demo account — no sign-up needed'}
          </button>
          {demoError && <p style={{ color:'#FF6B6B', fontSize:12, marginTop:8 }}>{demoError}</p>}
        </div>
      </section>

      {/* ── Live stats ── */}
      {(stats.writers > 0 || stats.posts > 0) && (
        <section style={{ borderTop:'1px solid #1A1A1A', borderBottom:'1px solid #1A1A1A', padding:'28px 24px' }}>
          <div style={{ maxWidth:600, margin:'0 auto', display:'flex', justifyContent:'center', gap:'clamp(32px,8vw,80px)', flexWrap:'wrap' }}>
            {[
              { value: stats.writers, label: 'writers' },
              { value: stats.posts,   label: 'yawps today' },
              { value: stats.circles, label: 'circles' },
            ].filter(s => s.value > 0).map(s => (
              <div key={s.label} style={{ textAlign:'center' }}>
                <div style={{ color:'#E8FF47', fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:'clamp(28px,5vw,40px)' }}>{s.value}</div>
                <div style={{ color:'#555', fontSize:12, fontFamily:"'DM Mono',monospace", marginTop:4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Feature bento ── */}
      <section style={{ maxWidth:900, margin:'0 auto', padding:'80px 24px' }}>
        <p style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace", letterSpacing:'0.12em', textAlign:'center', marginBottom:40 }}>WHAT MAKES IT DIFFERENT</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:16 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ background:'#141414', border:'1px solid #2A2A2A', borderRadius:16, padding:'24px 22px' }}>
              <div style={{ width:38, height:38, borderRadius:10, background:'#E8FF4715', border:'1px solid #E8FF4730', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Mono',monospace", fontWeight:700, color:'#E8FF47', fontSize:16, marginBottom:16 }}>{f.icon}</div>
              <div style={{ color:'#F0F0F0', fontWeight:700, fontSize:14, marginBottom:8 }}>{f.title}</div>
              <div style={{ color:'#666', fontSize:13, fontFamily:'Georgia,serif', lineHeight:1.7 }}>{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Manifesto ── */}
      <section style={{ background:'#141414', borderTop:'1px solid #1A1A1A', borderBottom:'1px solid #1A1A1A', padding:'80px 24px' }}>
        <div style={{ maxWidth:620, margin:'0 auto', textAlign:'center' }}>
          <p style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace", letterSpacing:'0.12em', marginBottom:32 }}>WHY WE BUILT THIS</p>
          <p style={{ fontFamily:'Georgia,serif', fontSize:'clamp(20px,3vw,28px)', lineHeight:1.7, color:'#F0F0F0', marginBottom:28, fontStyle:'italic' }}>
            &quot;The timeline used to feel like a conversation. Then it started feeling like a performance. Then it started feeling like a trap.&quot;
          </p>
          <p style={{ color:'#888', fontSize:16, fontFamily:'Georgia,serif', lineHeight:1.8, marginBottom:16 }}>
            We built Yawp because we missed the internet that felt like discovery. The one where you said something and someone thought about it before responding.
          </p>
          <p style={{ color:'#888', fontSize:16, fontFamily:'Georgia,serif', lineHeight:1.8 }}>
            The algorithm didn&apos;t make us worse. It made us forget we were better. Yawp is the reminder.
          </p>
        </div>
      </section>

      {/* ── Comparison ── */}
      <section style={{ maxWidth:800, margin:'0 auto', padding:'80px 24px' }}>
        <p style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace", letterSpacing:'0.12em', textAlign:'center', marginBottom:40 }}>YAWP VS THE REST</p>
        <div style={{ background:'#141414', border:'1px solid #2A2A2A', borderRadius:16, overflow:'hidden' }}>
          {/* Header */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 80px 80px 80px', padding:'14px 20px', borderBottom:'1px solid #2A2A2A', gap:8 }}>
            <div style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace" }} />
            {['YAWP','X','THREADS','MASTODON'].map(h => (
              <div key={h} style={{ color: h === 'YAWP' ? '#E8FF47' : '#555', fontSize:10, fontFamily:"'DM Mono',monospace", textAlign:'center', fontWeight: h === 'YAWP' ? 700 : 400 }}>{h}</div>
            ))}
          </div>
          {COMPARE.map((row, i) => (
            <div key={row.feature} style={{ display:'grid', gridTemplateColumns:'1fr 80px 80px 80px 80px', padding:'13px 20px', borderBottom: i < COMPARE.length - 1 ? '1px solid #1A1A1A' : 'none', alignItems:'center', gap:8 }}>
              <div style={{ color:'#888', fontSize:13, fontFamily:'Georgia,serif' }}>{row.feature}</div>
              {[row.yawp, row.twitter, row.threads, row.masto].map((v, j) => (
                <div key={j} style={{ textAlign:'center', color: v ? (j === 0 ? '#47FFB2' : '#555') : '#3A3A3A', fontSize:16 }}>
                  {v ? '✓' : '✗'}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{ borderTop:'1px solid #1A1A1A', padding:'80px 24px', textAlign:'center' }}>
        <div style={{ maxWidth:480, margin:'0 auto' }}>
          <div style={{ background:'#E8FF47', color:'#0D0D0D', fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:20, padding:'8px 18px', borderRadius:8, display:'inline-block', marginBottom:24 }}>YAWP</div>
          <h2 style={{ fontSize:'clamp(24px,4vw,36px)', fontWeight:700, fontFamily:'Georgia,serif', marginBottom:16, lineHeight:1.3 }}>Ready to say something?</h2>
          <p style={{ color:'#888', fontSize:16, fontFamily:'Georgia,serif', lineHeight:1.7, marginBottom:40 }}>
            No algorithm will decide if you&apos;re worth hearing. No ad will interrupt you. Just your words, and the people who want to read them.
          </p>
          <Link href="/signup" style={{ background:'#E8FF47', color:'#0D0D0D', fontWeight:700, padding:'15px 40px', borderRadius:30, fontSize:16, display:'inline-block' }}>
            Create your account →
          </Link>
          <p style={{ color:'#333', fontSize:12, marginTop:16, fontFamily:"'DM Mono',monospace" }}>Free forever. No credit card required.</p>
        </div>
      </section>

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }
      `}</style>
    </div>
  )
}
