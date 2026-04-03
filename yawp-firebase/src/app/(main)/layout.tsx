'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { signOut } from 'firebase/auth'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { useAuth } from '@/lib/AuthContext'
import { auth, db } from '@/lib/firebase'

const TABS = [
  { href:'/feed',          label:'FEED',     icon:'⬡' },
  { href:'/circles',       label:'CIRCLES',  icon:'◎' },
  { href:'/discover',      label:'DISCOVER', icon:'◈' },
  { href:'/notifications', label:'ALERTS',   icon:'◇' },
  { href:'/messages',      label:'MSG',      icon:'✉' },
  { href:'/profile',       label:'PROFILE',  icon:'▲' },
]

function NavBar({ unreadNotifs, unreadMsgs }: { unreadNotifs: number; unreadMsgs: number }) {
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut(auth)
    router.push('/')
  }

  return (
    <>
      <header style={{
        position:'sticky', top:0, zIndex:100,
        background:'rgba(13,13,13,0.92)', backdropFilter:'blur(12px)',
        borderBottom:'1px solid #2A2A2A',
        padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between'
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ background:'#E8FF47', color:'#0D0D0D', fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:13, padding:'4px 10px', borderRadius:6 }}>YAWP</div>
          <span style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace" }}>beta</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:'#47FFB2' }} />
            <span style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace" }}>no algorithm</span>
          </div>
          <button onClick={handleSignOut} style={{ background:'none', border:'1px solid #2A2A2A', borderRadius:16, color:'#888', fontSize:12, padding:'4px 12px', cursor:'pointer', transition:'color 0.15s, border-color 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color='#F0F0F0'; e.currentTarget.style.borderColor='#3A3A3A' }}
            onMouseLeave={e => { e.currentTarget.style.color='#888'; e.currentTarget.style.borderColor='#2A2A2A' }}>
            Sign out
          </button>
        </div>
      </header>

      <nav style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:100,
        background:'rgba(13,13,13,0.97)', backdropFilter:'blur(16px)',
        borderTop:'1px solid #2A2A2A',
        display:'flex', justifyContent:'space-around',
        padding:'10px 0 max(10px,env(safe-area-inset-bottom))',
      }}>
        {TABS.map(tab => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
          const badge = tab.href === '/notifications' ? unreadNotifs : tab.href === '/messages' ? unreadMsgs : 0
          return (
            <Link key={tab.href} href={tab.href} style={{
              display:'flex', flexDirection:'column', alignItems:'center', gap:3,
              padding:'4px 8px', color: active ? '#E8FF47' : '#555',
              transition:'color 0.15s', textDecoration:'none', position:'relative'
            }}>
              <span style={{ fontSize:16, lineHeight:1 }}>{tab.icon}</span>
              <span style={{ fontSize:9, fontFamily:"'DM Mono',monospace", letterSpacing:'0.05em' }}>{tab.label}</span>
              {badge > 0 && (
                <span style={{
                  position:'absolute', top:-2, right:2,
                  background:'#FF6B6B', color:'#fff', fontSize:9,
                  fontFamily:"'DM Mono',monospace", fontWeight:700,
                  borderRadius:10, padding:'1px 5px', lineHeight:1.4,
                }}>{badge > 9 ? '9+' : badge}</span>
              )}
            </Link>
          )
        })}
      </nav>
    </>
  )
}

function DemoBanner() {
  const router = useRouter()
  return (
    <div style={{
      background:'#0D1500', borderBottom:'1px solid #2A3A00',
      padding:'9px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ background:'#E8FF47', color:'#0D0D0D', fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:4, fontFamily:"'DM Mono',monospace", flexShrink:0 }}>DEMO</span>
        <span style={{ color:'#888', fontSize:12, fontFamily:'Georgia,serif' }}>
          You&apos;re exploring a demo account. Posts you make are visible to everyone.
        </span>
      </div>
      <button onClick={() => router.push('/signup')} style={{
        background:'#E8FF47', border:'none', borderRadius:20, padding:'5px 14px',
        color:'#0D0D0D', fontWeight:700, fontSize:11, cursor:'pointer', flexShrink:0,
        fontFamily:"'DM Mono',monospace",
      }}>
        Create your account →
      </button>
    </div>
  )
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [unreadMsgs, setUnreadMsgs] = useState(0)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading])

  useEffect(() => {
    if (!user) return
    const loadBadges = async () => {
      // Unread notifications
      const notifSnap = await getDocs(
        query(collection(db, 'notifications', user.uid, 'items'), where('read', '==', false))
      )
      setUnreadNotifs(notifSnap.size)

      // Unread messages (conversations with no readAt on last message from other person)
      // Simple proxy: count conversations updated in last hour that we didn't initiate
      const convSnap = await getDocs(
        query(collection(db, 'conversations'), where('participants', 'array-contains', user.uid))
      )
      // Count conversations where lastMessageAt > last read (simplified: count all active convs for now)
      setUnreadMsgs(0) // placeholder — full read-receipt system would be needed for accuracy
    }
    loadBadges()

    // Refresh badge count every 30s
    const interval = setInterval(loadBadges, 30_000)
    return () => clearInterval(interval)
  }, [user])

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#0D0D0D', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#555', fontFamily:"'DM Mono',monospace" }}>Loading...</div>
    </div>
  )

  if (!user) return null

  const isDemo = profile?.isDemo === true

  return (
    <div style={{ minHeight:'100vh', background:'#0D0D0D' }}>
      <NavBar unreadNotifs={unreadNotifs} unreadMsgs={unreadMsgs} />
      {isDemo && <DemoBanner />}
      <main style={{ paddingBottom:80 }}>{children}</main>
    </div>
  )
}
