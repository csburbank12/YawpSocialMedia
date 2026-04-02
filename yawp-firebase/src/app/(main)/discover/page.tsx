'use client'
import { useState, useEffect } from 'react'
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy, limit, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/AuthContext'
import { Profile, Post } from '@/types'
import Avatar from '@/components/ui/Avatar'

const TAG_COLORS = ['#E8FF47','#47FFB2','#7C4DFF','#FF6B6B','#00BCD4','#FF9800','#FF4081','#69F0AE']

export default function DiscoverPage() {
  const { user } = useAuth()
  const [people, setPeople] = useState<Profile[]>([])
  const [trending, setTrending] = useState<{ tag: string; count: number }[]>([])
  const [followed, setFollowed] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!user) return
    const load = async () => {
      // Get all profiles except current user
      const snap = await getDocs(collection(db, 'profiles'))
      setPeople(snap.docs.filter(d => d.id !== user.uid).map(d => ({ id: d.id, ...d.data() } as Profile)))

      // Get following
      const followSnap = await getDocs(collection(db, 'profiles', user.uid, 'following'))
      setFollowed(new Set(followSnap.docs.map(d => d.id)))

      // Get trending tags from recent posts
      const postsSnap = await getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(100)))
      const tagCounts: Record<string, number> = {}
      postsSnap.docs.forEach(d => {
        const tags = d.data().tags || []
        tags.forEach((tag: string) => { tagCounts[tag] = (tagCounts[tag] ?? 0) + 1 })
      })
      setTrending(Object.entries(tagCounts).sort(([,a],[,b]) => b - a).slice(0, 6).map(([tag, count]) => ({ tag, count })))
    }
    load()
  }, [user])

  const toggleFollow = async (profileId: string) => {
    if (!user) return
    const ref = doc(db, 'profiles', user.uid, 'following', profileId)
    if (followed.has(profileId)) {
      await deleteDoc(ref)
      setFollowed(prev => { const s = new Set(prev); s.delete(profileId); return s })
    } else {
      await setDoc(ref, { followedAt: Date.now() })
      setFollowed(prev => new Set([...prev, profileId]))
    }
  }

  const filtered = search.length >= 2
    ? people.filter(p => p.username.toLowerCase().includes(search.toLowerCase()) || (p.displayName ?? '').toLowerCase().includes(search.toLowerCase()))
    : people

  return (
    <div style={{ maxWidth:640, margin:'0 auto', padding:'24px 16px' }}>
      <div style={{ marginBottom:24 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people..."
          style={{ width:'100%', background:'#141414', border:'1px solid #2A2A2A', borderRadius:20, padding:'11px 18px', color:'#F0F0F0', fontSize:14, outline:'none' }} />
      </div>

      {!search && trending.length > 0 && (
        <div style={{ marginBottom:28 }}>
          <div style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace", letterSpacing:'0.1em', marginBottom:12 }}>TRENDING TODAY</div>
          {trending.map(({ tag, count }, i) => (
            <div key={tag} style={{ background:'#141414', border:'1px solid #2A2A2A', borderRadius:12, padding:'12px 16px', marginBottom:8, display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:TAG_COLORS[i % TAG_COLORS.length] }} />
              <span style={{ color:TAG_COLORS[i % TAG_COLORS.length], fontWeight:700, fontSize:14, fontFamily:"'DM Mono',monospace", flex:1 }}>{tag}</span>
              <span style={{ color:'#555', fontSize:12 }}>{count} yawps</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace", letterSpacing:'0.1em', marginBottom:12 }}>
        {search.length >= 2 ? 'SEARCH RESULTS' : 'PEOPLE ON YAWP'}
      </div>

      {filtered.length === 0 ? (
        <p style={{ color:'#555', fontSize:13, textAlign:'center', padding:20 }}>No users found.</p>
      ) : filtered.map(p => (
        <div key={p.id} style={{ background:'#141414', border:'1px solid #2A2A2A', borderRadius:12, padding:'14px 16px', marginBottom:10, display:'flex', alignItems:'center', gap:12 }}>
          <Avatar username={p.username} size={40} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ color:'#F0F0F0', fontWeight:600, fontSize:14 }}>{p.displayName ?? p.username}</div>
            <div style={{ color:'#555', fontSize:12, fontFamily:"'DM Mono',monospace" }}>@{p.username}</div>
            {p.bio && <div style={{ color:'#888', fontSize:12, marginTop:2, fontFamily:'Georgia,serif', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.bio}</div>}
          </div>
          <button onClick={() => toggleFollow(p.id)} style={{
            background: followed.has(p.id) ? '#1A1A1A' : 'none',
            border:`1px solid ${followed.has(p.id) ? '#3A3A3A' : '#2A2A2A'}`,
            borderRadius:20, color: followed.has(p.id) ? '#888' : '#F0F0F0',
            padding:'6px 14px', cursor:'pointer', fontSize:12, flexShrink:0, transition:'all 0.15s'
          }}>
            {followed.has(p.id) ? 'Following' : 'Follow'}
          </button>
        </div>
      ))}
    </div>
  )
}
