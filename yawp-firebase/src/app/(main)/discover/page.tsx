'use client'
import { useState, useEffect } from 'react'
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy, limit } from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/AuthContext'
import { Profile } from '@/types'
import Avatar from '@/components/ui/Avatar'

const TAG_COLORS = ['#E8FF47','#47FFB2','#7C4DFF','#FF6B6B','#00BCD4','#FF9800','#FF4081','#69F0AE']

export default function DiscoverPage() {
  const { user, profile } = useAuth()
  const router = useRouter()
  const [people, setPeople] = useState<Profile[]>([])
  const [trending, setTrending] = useState<{ tag: string; count: number }[]>([])
  const [followed, setFollowed] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      setLoading(true)
      const snap = await getDocs(collection(db, 'profiles'))
      // Filter out the current user. For non-demo users, also filter out demo accounts
      // so they don't clutter Discover. Demo users should see other demo accounts.
      const currentProfile = snap.docs.find(d => d.id === user.uid)?.data()
      const currentIsDemo = currentProfile?.isDemo === true
      setPeople(
        snap.docs
          .filter(d => d.id !== user.uid && (currentIsDemo || !d.data().isDemo))
          .map(d => ({ id: d.id, ...d.data() } as Profile))
      )

      const followSnap = await getDocs(collection(db, 'profiles', user.uid, 'following'))
      setFollowed(new Set(followSnap.docs.map(d => d.id)))

      const postsSnap = await getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(100)))
      const tagCounts: Record<string, number> = {}
      postsSnap.docs.forEach(d => {
        const tags = d.data().tags || []
        tags.forEach((tag: string) => { tagCounts[tag] = (tagCounts[tag] ?? 0) + 1 })
      })
      setTrending(Object.entries(tagCounts).sort(([,a],[,b]) => b - a).slice(0, 6).map(([tag, count]) => ({ tag, count })))
      setLoading(false)
    }
    load()
  }, [user])

  const toggleFollow = async (targetProfile: Profile) => {
    if (!user || !profile) return
    const myFollowRef = doc(db, 'profiles', user.uid, 'following', targetProfile.id)
    const theirFollowerRef = doc(db, 'profiles', targetProfile.id, 'followers', user.uid)

    if (followed.has(targetProfile.id)) {
      await deleteDoc(myFollowRef)
      await deleteDoc(theirFollowerRef)
      setFollowed(prev => { const s = new Set(prev); s.delete(targetProfile.id); return s })
    } else {
      const now = Date.now()
      await setDoc(myFollowRef, { followedAt: now })
      await setDoc(theirFollowerRef, { followedAt: now })
      await setDoc(doc(db, 'notifications', targetProfile.id, 'items', `follow_${user.uid}`), {
        type: 'follow',
        fromUserId: user.uid,
        fromUsername: profile.username,
        fromDisplayName: profile.displayName,
        createdAt: now,
        read: false,
      })
      setFollowed(prev => new Set([...prev, targetProfile.id]))
    }
  }

  const filtered = search.length >= 2
    ? people.filter(p =>
        p.username.toLowerCase().includes(search.toLowerCase()) ||
        (p.displayName ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : people

  return (
    <div style={{ maxWidth:640, margin:'0 auto', padding:'24px 16px' }}>
      <div style={{ marginBottom:24 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search people..."
          style={{ width:'100%', background:'#141414', border:'1px solid #2A2A2A', borderRadius:20, padding:'11px 18px', color:'#F0F0F0', fontSize:14, outline:'none', transition:'border-color 0.2s' }}
          onFocus={e => (e.currentTarget.style.borderColor = '#3A3A3A')}
          onBlur={e => (e.currentTarget.style.borderColor = '#2A2A2A')}
        />
      </div>

      {!search && trending.length > 0 && (
        <div style={{ marginBottom:28 }}>
          <div style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace", letterSpacing:'0.1em', marginBottom:12 }}>TRENDING TODAY</div>
          {trending.map(({ tag, count }, i) => (
            <div
              key={tag}
              onClick={() => router.push(`/tag/${encodeURIComponent(tag.replace('#', ''))}`)}
              style={{ background:'#141414', border:'1px solid #2A2A2A', borderRadius:12, padding:'12px 16px', marginBottom:8, display:'flex', alignItems:'center', gap:12, cursor:'pointer', transition:'border-color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = TAG_COLORS[i % TAG_COLORS.length])}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#2A2A2A')}
            >
              <div style={{ width:6, height:6, borderRadius:'50%', background:TAG_COLORS[i % TAG_COLORS.length], flexShrink:0 }} />
              <span style={{ color:TAG_COLORS[i % TAG_COLORS.length], fontWeight:700, fontSize:14, fontFamily:"'DM Mono',monospace", flex:1 }}>{tag}</span>
              <span style={{ color:'#555', fontSize:12 }}>{count} yawp{count !== 1 ? 's' : ''}</span>
              <span style={{ color:'#555', fontSize:14 }}>›</span>
            </div>
          ))}
        </div>
      )}

      {!search && (
        <div style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace", letterSpacing:'0.1em', marginBottom:12 }}>
          PEOPLE ON YAWP
        </div>
      )}
      {search.length >= 2 && (
        <div style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace", letterSpacing:'0.1em', marginBottom:12 }}>
          SEARCH RESULTS
        </div>
      )}

      {loading ? (
        <div style={{ color:'#555', fontSize:13, textAlign:'center', padding:20 }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', color:'#555', padding:'40px 20px' }}>
          <p style={{ fontFamily:'Georgia,serif', fontSize:15, color:'#888', marginBottom:4 }}>
            {search.length >= 2 ? 'No one found.' : 'No other members yet.'}
          </p>
          {search.length >= 2 && <p style={{ fontSize:13 }}>Try a different search.</p>}
        </div>
      ) : filtered.map(p => (
        <div key={p.id} style={{ background:'#141414', border:'1px solid #2A2A2A', borderRadius:12, padding:'14px 16px', marginBottom:10, display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={() => router.push(`/profile/${p.username}`)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, flexShrink:0 }}>
            <Avatar username={p.username} size={40} />
          </button>
          <div style={{ flex:1, minWidth:0 }}>
            <button onClick={() => router.push(`/profile/${p.username}`)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, textAlign:'left' }}>
              <div style={{ color:'#F0F0F0', fontWeight:600, fontSize:14 }}>{p.displayName ?? p.username}</div>
              <div style={{ color:'#555', fontSize:12, fontFamily:"'DM Mono',monospace" }}>@{p.username}</div>
            </button>
            {p.bio && (
              <div style={{ color:'#888', fontSize:12, marginTop:3, fontFamily:'Georgia,serif', display:'-webkit-box', WebkitLineClamp:1, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                {p.bio}
              </div>
            )}
          </div>
          <button
            onClick={() => toggleFollow(p)}
            style={{
              background: followed.has(p.id) ? '#1A1A1A' : 'none',
              border:`1px solid ${followed.has(p.id) ? '#3A3A3A' : '#E8FF47'}`,
              borderRadius:20, color: followed.has(p.id) ? '#555' : '#E8FF47',
              padding:'6px 14px', cursor:'pointer', fontSize:12, flexShrink:0, transition:'all 0.15s',
              fontFamily:"'DM Mono',monospace", fontWeight:600,
            }}>
            {followed.has(p.id) ? 'Following' : 'Follow'}
          </button>
        </div>
      ))}
    </div>
  )
}
