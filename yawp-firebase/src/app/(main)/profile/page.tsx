'use client'
import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, limit, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { toMs } from '@/lib/utils'
import { db, auth } from '@/lib/firebase'
import { useAuth } from '@/lib/AuthContext'
import { Post } from '@/types'
import Avatar from '@/components/ui/Avatar'
import RichText from '@/components/ui/RichText'

interface WritingStats {
  totalPosts: number
  totalWords: number
  streak: number
  firstPostDaysAgo: number | null
}

function calculateStats(posts: Post[]): WritingStats {
  if (posts.length === 0) return { totalPosts: 0, totalWords: 0, streak: 0, firstPostDaysAgo: null }

  const totalWords = posts.reduce((sum, p) => sum + p.content.trim().split(/\s+/).filter(Boolean).length, 0)

  // Unique posting days (start of day timestamps)
  const todayMs = new Date().setHours(0, 0, 0, 0)
  const days = new Set(posts.map(p => new Date(toMs(p.createdAt)).setHours(0, 0, 0, 0)))
  const sorted = Array.from(days).sort((a, b) => b - a) // newest first

  // Streak: start from today if posted today, else from yesterday
  const startDay = days.has(todayMs) ? todayMs : todayMs - 86_400_000
  let streak = 0
  let expected = startDay
  for (const day of sorted) {
    if (day === expected) { streak++; expected -= 86_400_000 }
    else if (day < expected) break
  }

  const oldest = Math.min(...posts.map(p => toMs(p.createdAt)))
  const firstPostDaysAgo = Math.floor((Date.now() - oldest) / 86_400_000)

  return { totalPosts: posts.length, totalWords, streak, firstPostDaysAgo }
}

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [saving, setSaving] = useState(false)
  const [followingCount, setFollowingCount] = useState(0)
  const [followerCount, setFollowerCount] = useState(0)
  const [stats, setStats] = useState<WritingStats>({ totalPosts: 0, totalWords: 0, streak: 0, firstPostDaysAgo: null })
  const router = useRouter()

  useEffect(() => {
    if (!user) return
    setDisplayName(profile?.displayName ?? '')
    setBio(profile?.bio ?? '')

    const load = async () => {
      // Load all posts for stats (no limit), then cap display at 20
      const allQ = query(collection(db, 'posts'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'))
      const allSnap = await getDocs(allQ)
      const allPosts = allSnap.docs.map(d => ({ id: d.id, ...d.data() } as Post))
      setPosts(allPosts.slice(0, 20))
      setStats(calculateStats(allPosts))

      const followingSnap = await getDocs(collection(db, 'profiles', user.uid, 'following'))
      setFollowingCount(followingSnap.size)

      const followerSnap = await getDocs(collection(db, 'profiles', user.uid, 'followers'))
      setFollowerCount(followerSnap.size)
    }
    load()
  }, [user, profile])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    await updateDoc(doc(db, 'profiles', user.uid), {
      displayName: displayName.trim() || profile?.username,
      bio: bio.trim(),
    })
    await refreshProfile()
    setSaving(false)
    setEditing(false)
  }

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Delete this yawp?')) return
    await deleteDoc(doc(db, 'posts', postId))
    setPosts(prev => prev.filter(p => p.id !== postId))
  }

  const handleSignOut = async () => {
    await signOut(auth)
    router.push('/')
  }

  if (!profile) return null

  return (
    <div style={{ maxWidth:640, margin:'0 auto', padding:'24px 16px' }}>
      {/* Profile card */}
      <div style={{ background:'#141414', border:'1px solid #2A2A2A', borderRadius:16, padding:24, marginBottom:16 }}>
        <div style={{ display:'flex', gap:16, alignItems:'flex-start', marginBottom:16 }}>
          <Avatar username={profile.username} size={56} />
          <div style={{ flex:1 }}>
            {editing ? (
              <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                style={{ background:'#1A1A1A', border:'1px solid #3A3A3A', borderRadius:8, padding:'6px 10px', color:'#F0F0F0', fontSize:18, fontWeight:700, outline:'none', width:'100%', marginBottom:4 }} />
            ) : (
              <div style={{ color:'#F0F0F0', fontWeight:700, fontSize:18, marginBottom:2 }}>{profile.displayName}</div>
            )}
            <div style={{ color:'#555', fontSize:13, fontFamily:"'DM Mono',monospace" }}>@{profile.username}</div>
          </div>
          {!editing ? (
            <button onClick={() => setEditing(true)} style={{ background:'none', border:'1px solid #2A2A2A', borderRadius:16, color:'#888', fontSize:12, padding:'5px 14px', cursor:'pointer' }}>Edit</button>
          ) : (
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={() => setEditing(false)} style={{ background:'none', border:'1px solid #2A2A2A', borderRadius:16, color:'#888', fontSize:12, padding:'5px 12px', cursor:'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ background:'#E8FF47', border:'none', borderRadius:16, color:'#0D0D0D', fontSize:12, fontWeight:700, padding:'5px 12px', cursor:'pointer' }}>{saving ? '...' : 'Save'}</button>
            </div>
          )}
        </div>

        {editing ? (
          <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Write a short bio..." maxLength={160} rows={3}
            style={{ width:'100%', background:'#1A1A1A', border:'1px solid #3A3A3A', borderRadius:8, padding:'8px 10px', color:'#F0F0F0', fontSize:14, outline:'none', resize:'none', fontFamily:'Georgia,serif', lineHeight:1.5, marginBottom:16 }} />
        ) : profile.bio ? (
          <p style={{ color:'#888', fontSize:14, fontFamily:'Georgia,serif', lineHeight:1.6, marginBottom:16 }}>{profile.bio}</p>
        ) : (
          <p style={{ color:'#444', fontSize:13, fontFamily:'Georgia,serif', lineHeight:1.6, marginBottom:16, fontStyle:'italic' }}>
            No bio yet.{' '}
            <span onClick={() => setEditing(true)} style={{ color:'#E8FF47', cursor:'pointer' }}>Add one →</span>
          </p>
        )}

        <div style={{ display:'flex', gap:28, marginBottom:16 }}>
          {[
            { label:'Yawps', value: stats.totalPosts },
            { label:'Following', value: followingCount },
            { label:'Followers', value: followerCount },
          ].map(s => (
            <div key={s.label}>
              <div style={{ color:'#F0F0F0', fontWeight:700, fontSize:20, fontFamily:"'DM Mono',monospace" }}>{s.value}</div>
              <div style={{ color:'#555', fontSize:11 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ background:'#0D1A0D', border:'1px solid #1A3A1A', borderRadius:10, padding:'10px 14px', display:'flex', alignItems:'flex-start', gap:10 }}>
          <span style={{ color:'#47FFB2', fontSize:15 }}>◎</span>
          <div>
            <div style={{ color:'#47FFB2', fontSize:12, fontWeight:600 }}>Follower counts are private on Yawp</div>
            <div style={{ color:'#888', fontSize:11, marginTop:2 }}>Your voice matters, not your number.</div>
          </div>
        </div>
      </div>

      {/* Writing Stats */}
      {stats.totalPosts > 0 && (
        <div style={{ background:'#141414', border:'1px solid #2A2A2A', borderRadius:16, padding:'20px 24px', marginBottom:16 }}>
          <div style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace", letterSpacing:'0.1em', marginBottom:16 }}>YOUR WRITING</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div style={{ background:'#0D0D0D', border:'1px solid #1E1E1E', borderRadius:12, padding:'14px 16px' }}>
              <div style={{ color:'#E8FF47', fontWeight:700, fontSize:24, fontFamily:"'DM Mono',monospace" }}>
                {stats.totalWords.toLocaleString()}
              </div>
              <div style={{ color:'#555', fontSize:12, marginTop:4 }}>words written</div>
            </div>
            <div style={{ background:'#0D0D0D', border:'1px solid #1E1E1E', borderRadius:12, padding:'14px 16px' }}>
              <div style={{ color:'#47FFB2', fontWeight:700, fontSize:24, fontFamily:"'DM Mono',monospace" }}>
                {stats.streak}
                <span style={{ fontSize:14, color:'#47FFB2', marginLeft:4 }}>day{stats.streak !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ color:'#555', fontSize:12, marginTop:4 }}>
                {stats.streak > 1 ? 'writing streak 🔥' : stats.streak === 1 ? 'streak — keep going' : 'current streak'}
              </div>
            </div>
          </div>
          {stats.firstPostDaysAgo !== null && stats.firstPostDaysAgo > 0 && (
            <p style={{ color:'#444', fontSize:12, fontFamily:'Georgia,serif', marginTop:14, textAlign:'center' }}>
              Writing on Yawp for {stats.firstPostDaysAgo} day{stats.firstPostDaysAgo !== 1 ? 's' : ''}.
            </p>
          )}
        </div>
      )}

      {/* Yawp+ */}
      {!profile.isPlus && (
        <div style={{ background:'linear-gradient(135deg, #141414 0%, #1A1500 100%)', border:'1px solid #2A2200', borderRadius:16, padding:'20px 24px', marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <span style={{ background:'#E8FF47', color:'#0D0D0D', fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20, fontFamily:"'DM Mono',monospace" }}>PLUS</span>
            <div style={{ color:'#F0F0F0', fontWeight:700, fontSize:15 }}>Yawp+</div>
          </div>
          <p style={{ color:'#888', fontSize:13, fontFamily:'Georgia,serif', lineHeight:1.6, marginBottom:14 }}>
            Support an ad-free internet. Get early access to new features. Keep the lights on.
          </p>
          <button style={{ background:'#E8FF47', border:'none', borderRadius:20, padding:'9px 20px', color:'#0D0D0D', fontWeight:700, fontSize:13, cursor:'pointer' }}>
            Join Yawp+ — $5/mo
          </button>
        </div>
      )}

      {/* Posts */}
      <div style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace", letterSpacing:'0.1em', marginBottom:16 }}>YOUR YAWPS</div>
      {posts.length === 0 ? (
        <div style={{ textAlign:'center', color:'#555', padding:'40px 20px' }}>
          <p style={{ fontSize:28, marginBottom:12 }}>⬡</p>
          <p style={{ fontFamily:'Georgia,serif', fontSize:15, color:'#888', marginBottom:8 }}>You haven&apos;t yawped yet.</p>
          <button onClick={() => router.push('/feed')} style={{ background:'#E8FF47', border:'none', borderRadius:20, padding:'9px 20px', color:'#0D0D0D', fontWeight:700, fontSize:13, cursor:'pointer' }}>
            Go say something →
          </button>
        </div>
      ) : posts.map(post => (
        <div key={post.id}
          onClick={() => router.push(`/post/${post.id}`)}
          style={{ background:'#141414', border:'1px solid #2A2A2A', borderRadius:14, padding:'14px 18px', marginBottom:10, position:'relative', cursor:'pointer', transition:'border-color 0.2s' }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#3A3A3A'
            const btn = e.currentTarget.querySelector<HTMLButtonElement>('.del-btn')
            if (btn) btn.style.opacity = '1'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = '#2A2A2A'
            const btn = e.currentTarget.querySelector<HTMLButtonElement>('.del-btn')
            if (btn) btn.style.opacity = '0'
          }}>
          <RichText content={post.content} style={{ color:'#F0F0F0', fontSize:14, fontFamily:'Georgia,serif', lineHeight:1.55, display:'block', marginBottom:8 }} />
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <span style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace" }}>{formatDistanceToNow(new Date(toMs(post.createdAt)), { addSuffix:true })}</span>
            <span style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace" }}>♥ {post.heartCount}</span>
            <span style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace" }}>◎ {post.replyCount}</span>
            {post.editedAt && <span style={{ color:'#444', fontSize:10, fontFamily:"'DM Mono',monospace" }}>edited</span>}
          </div>
          <button className="del-btn" onClick={e => { e.stopPropagation(); handleDeletePost(post.id) }}
            style={{ position:'absolute', top:12, right:12, background:'none', border:'none', color:'#FF6B6B', cursor:'pointer', fontSize:14, opacity:0, transition:'opacity 0.15s', padding:'2px 6px' }}>
            ✕
          </button>
        </div>
      ))}

      <button onClick={handleSignOut} style={{ width:'100%', background:'none', border:'1px solid #2A2A2A', borderRadius:20, padding:12, color:'#555', cursor:'pointer', fontSize:14, marginTop:16, transition:'color 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#F0F0F0')}
        onMouseLeave={e => (e.currentTarget.style.color = '#555')}>
        Sign out
      </button>
    </div>
  )
}
