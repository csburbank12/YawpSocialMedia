'use client'
import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, limit, getDocs, doc, updateDoc } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { db, auth } from '@/lib/firebase'
import { useAuth } from '@/lib/AuthContext'
import { Post } from '@/types'
import Avatar from '@/components/ui/Avatar'

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!user) return
    setDisplayName(profile?.displayName ?? '')
    setBio(profile?.bio ?? '')
    const load = async () => {
      const q = query(collection(db, 'posts'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(20))
      const snap = await getDocs(q)
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Post)))
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
        ) : null}

        <div style={{ display:'flex', gap:28, marginBottom:16 }}>
          {[{ label:'Yawps', value: posts.length }, { label:'Following', value:0 }, { label:'Followers', value:'—' }].map(s => (
            <div key={s.label}>
              <div style={{ color:'#F0F0F0', fontWeight:700, fontSize:20, fontFamily:"'DM Mono',monospace" }}>{s.value}</div>
              <div style={{ color:'#555', fontSize:11 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ background:'#E8FF4711', border:'1px solid #E8FF4733', borderRadius:10, padding:'10px 14px', display:'flex', alignItems:'flex-start', gap:10 }}>
          <span style={{ color:'#E8FF47', fontSize:15 }}>◎</span>
          <div>
            <div style={{ color:'#E8FF47', fontSize:12, fontWeight:600 }}>Follower counts are private on Yawp</div>
            <div style={{ color:'#888', fontSize:11, marginTop:2 }}>Your voice matters, not your number.</div>
          </div>
        </div>
      </div>

      {/* Yawp+ */}
      {!profile.isPlus && (
        <div style={{ background:'#141414', border:'1px solid #2A2A2A', borderRadius:16, padding:'20px 24px', marginBottom:24 }}>
          <div style={{ color:'#F0F0F0', fontWeight:700, fontSize:15, marginBottom:6 }}>Yawp+</div>
          <p style={{ color:'#888', fontSize:13, fontFamily:'Georgia,serif', lineHeight:1.6, marginBottom:14 }}>Support an ad-free internet. $5/mo.</p>
          <button style={{ background:'#E8FF47', border:'none', borderRadius:20, padding:'9px 20px', color:'#0D0D0D', fontWeight:700, fontSize:13, cursor:'pointer' }}>Join Yawp+ — $5/mo</button>
        </div>
      )}

      {/* Posts */}
      <div style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace", letterSpacing:'0.1em', marginBottom:16 }}>YOUR YAWPS</div>
      {posts.length === 0 ? (
        <div style={{ textAlign:'center', color:'#555', padding:'40px 20px' }}>
          <p style={{ fontFamily:'Georgia,serif', fontSize:15, color:'#888' }}>You haven't yawped yet. Go say something.</p>
        </div>
      ) : posts.map(post => (
        <div key={post.id} style={{ background:'#141414', border:'1px solid #2A2A2A', borderRadius:14, padding:'14px 18px', marginBottom:10 }}>
          <p style={{ color:'#F0F0F0', fontSize:14, fontFamily:'Georgia,serif', lineHeight:1.55, marginBottom:6 }}>{post.content}</p>
          <span style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace" }}>{formatDistanceToNow(new Date(post.createdAt), { addSuffix:true })}</span>
        </div>
      ))}

      <button onClick={handleSignOut} style={{ width:'100%', background:'none', border:'1px solid #2A2A2A', borderRadius:20, padding:12, color:'#888', cursor:'pointer', fontSize:14, marginTop:16 }}>
        Sign out
      </button>
    </div>
  )
}
