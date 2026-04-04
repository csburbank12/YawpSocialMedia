'use client'
import { useState, useEffect } from 'react'
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/AuthContext'
import { Profile } from '@/types'
import Avatar from '@/components/ui/Avatar'
import { useToast } from '@/components/ui/Toast'
import { useRouter } from 'next/navigation'

const TAG_COLORS = ['#E8FF47','#47FFB2','#7C4DFF','#FF6B6B','#00BCD4','#FF9800','#FF4081','#69F0AE']

function DiscoverSkeleton() {
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ height: 12, width: 120, marginBottom: 16 }} className="skeleton" />
        {[1, 2, 3].map(i => (
          <div key={i} style={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 12, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%' }} className="skeleton" />
            <div style={{ height: 14, width: 100, flex: 1 }} className="skeleton" />
            <div style={{ height: 12, width: 50 }} className="skeleton" />
          </div>
        ))}
      </div>
      <div style={{ height: 12, width: 100, marginBottom: 16 }} className="skeleton" />
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 12, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%' }} className="skeleton" />
          <div style={{ flex: 1 }}>
            <div style={{ height: 14, width: 120, marginBottom: 6 }} className="skeleton" />
            <div style={{ height: 12, width: 80 }} className="skeleton" />
          </div>
          <div style={{ height: 30, width: 70, borderRadius: 20 }} className="skeleton" />
        </div>
      ))}
    </div>
  )
}

export default function DiscoverPage() {
  const { user, profile } = useAuth()
  const [people, setPeople] = useState<Profile[]>([])
  const [trending, setTrending] = useState<{ tag: string; count: number }[]>([])
  const [followed, setFollowed] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    if (!user) return
    const load = async () => {
      setLoading(true)
      try {
        const snap = await getDocs(collection(db, 'profiles'))
        setPeople(snap.docs.filter(d => d.id !== user.uid).map(d => ({ id: d.id, ...d.data() } as Profile)))

        const followSnap = await getDocs(collection(db, 'profiles', user.uid, 'following'))
        setFollowed(new Set(followSnap.docs.map(d => d.id)))

        const postsSnap = await getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(100)))
        const tagCounts: Record<string, number> = {}
        postsSnap.docs.forEach(d => {
          const tags = d.data().tags || []
          tags.forEach((tag: string) => { tagCounts[tag] = (tagCounts[tag] ?? 0) + 1 })
        })
        setTrending(Object.entries(tagCounts).sort(([,a],[,b]) => b - a).slice(0, 6).map(([tag, count]) => ({ tag, count })))
      } catch {
        toast('Failed to load. Pull to refresh.', 'error')
      }
      setLoading(false)
    }
    load()
  }, [user])

  const toggleFollow = async (targetProfile: Profile) => {
    if (!user || !profile) return
    const myFollowRef = doc(db, 'profiles', user.uid, 'following', targetProfile.id)
    const theirFollowerRef = doc(db, 'profiles', targetProfile.id, 'followers', user.uid)

    try {
      if (followed.has(targetProfile.id)) {
        await deleteDoc(myFollowRef)
        await deleteDoc(theirFollowerRef)
        setFollowed(prev => { const s = new Set(prev); s.delete(targetProfile.id); return s })
        toast('Unfollowed')
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
        toast(`Following @${targetProfile.username}`)
      }
    } catch {
      toast('Action failed. Try again.', 'error')
    }
  }

  const filtered = search.length >= 2
    ? people.filter(p =>
        p.username.toLowerCase().includes(search.toLowerCase()) ||
        (p.displayName ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : people

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search people..."
          style={{ width: '100%', background: '#141414', border: '1px solid #2A2A2A', borderRadius: 20, padding: '11px 18px', color: '#F0F0F0', fontSize: 14, outline: 'none' }}
        />
      </div>

      {loading ? <DiscoverSkeleton /> : (
        <>
          {!search && trending.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ color: '#555', fontSize: 11, fontFamily: "'DM Mono',monospace", letterSpacing: '0.1em', marginBottom: 12 }}>TRENDING TODAY</div>
              {trending.map(({ tag, count }, i) => (
                <div key={tag} onClick={() => router.push(`/tag/${encodeURIComponent(tag.replace('#', ''))}`)}
                  className="animate-fade-in-up"
                  style={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 12, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'border-color 0.2s', animationDelay: `${i * 0.05}s` }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = TAG_COLORS[i % TAG_COLORS.length]}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#2A2A2A'}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: TAG_COLORS[i % TAG_COLORS.length], flexShrink: 0 }} />
                  <span style={{ color: TAG_COLORS[i % TAG_COLORS.length], fontWeight: 700, fontSize: 14, fontFamily: "'DM Mono',monospace", flex: 1 }}>{tag}</span>
                  <span style={{ color: '#555', fontSize: 12 }}>{count} yawps</span>
                  <span style={{ color: '#555', fontSize: 14 }}>›</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ color: '#555', fontSize: 11, fontFamily: "'DM Mono',monospace", letterSpacing: '0.1em', marginBottom: 12 }}>
            {search.length >= 2 ? 'SEARCH RESULTS' : 'PEOPLE ON YAWP'}
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#555', padding: '40px 20px' }}>
              <p style={{ fontFamily: 'Georgia,serif', fontSize: 15, color: '#888', marginBottom: 4 }}>No one found.</p>
              {search.length >= 2 && <p style={{ fontSize: 13 }}>Try a different search.</p>}
            </div>
          ) : filtered.map((p, i) => (
            <div key={p.id} className="animate-fade-in-up"
              style={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 12, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, animationDelay: `${i * 0.04}s` }}>
              <button onClick={() => router.push(`/profile/${p.username}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <Avatar username={p.username} size={40} />
              </button>
              <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => router.push(`/profile/${p.username}`)}>
                <div style={{ color: '#F0F0F0', fontWeight: 600, fontSize: 14 }}>{p.displayName ?? p.username}</div>
                <div style={{ color: '#555', fontSize: 12, fontFamily: "'DM Mono',monospace" }}>@{p.username}</div>
                {p.bio && <div style={{ color: '#888', fontSize: 12, marginTop: 2, fontFamily: 'Georgia,serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.bio}</div>}
              </div>
              <button
                onClick={() => toggleFollow(p)}
                style={{
                  background: followed.has(p.id) ? '#1A1A1A' : 'none',
                  border: `1px solid ${followed.has(p.id) ? '#3A3A3A' : '#E8FF47'}`,
                  borderRadius: 20, color: followed.has(p.id) ? '#555' : '#E8FF47',
                  padding: '6px 14px', cursor: 'pointer', fontSize: 12, flexShrink: 0, transition: 'all 0.15s',
                  fontFamily: "'DM Mono',monospace", fontWeight: 600,
                }}>
                {followed.has(p.id) ? 'Following' : 'Follow'}
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
