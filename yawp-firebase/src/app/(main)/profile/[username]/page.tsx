'use client'
import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, limit, getDocs, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore'
import { safeTimeAgo } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/AuthContext'
import { Profile, Post } from '@/types'
import Avatar from '@/components/ui/Avatar'

export default function PublicProfilePage({ params }: { params: { username: string } }) {
  const { user, profile: myProfile } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)

  const username = decodeURIComponent(params.username)
  const isOwnProfile = myProfile?.username === username

  useEffect(() => {
    if (!user) return
    const load = async () => {
      setLoading(true)
      // Find profile by username
      const snap = await getDocs(query(collection(db, 'profiles'), where('username', '==', username), limit(1)))
      if (snap.empty) { setNotFound(true); setLoading(false); return }
      const profileDoc = snap.docs[0]
      const p = { id: profileDoc.id, ...profileDoc.data() } as Profile
      setProfile(p)

      // Load their posts
      const postsSnap = await getDocs(query(collection(db, 'posts'), where('userId', '==', profileDoc.id), orderBy('createdAt', 'desc'), limit(20)))
      setPosts(postsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Post)))

      // Check if I follow them
      if (!isOwnProfile) {
        const followSnap = await getDoc(doc(db, 'profiles', user.uid, 'following', profileDoc.id))
        setIsFollowing(followSnap.exists())
      }

      // Follower count (only show to profile owner)
      if (isOwnProfile) {
        const followerSnap = await getDocs(collection(db, 'profiles', profileDoc.id, 'followers'))
        setFollowerCount(followerSnap.size)
      }

      setLoading(false)
    }
    load()
  }, [user, username, isOwnProfile])

  const toggleFollow = async () => {
    if (!user || !profile || !myProfile) return
    const myFollowRef = doc(db, 'profiles', user.uid, 'following', profile.id)
    const theirFollowerRef = doc(db, 'profiles', profile.id, 'followers', user.uid)
    if (isFollowing) {
      await deleteDoc(myFollowRef)
      await deleteDoc(theirFollowerRef)
      setIsFollowing(false)
    } else {
      const now = Date.now()
      await setDoc(myFollowRef, { followedAt: now })
      await setDoc(theirFollowerRef, { followedAt: now })
      await setDoc(doc(db, 'notifications', profile.id, 'items', `follow_${user.uid}`), {
        type: 'follow',
        fromUserId: user.uid,
        fromUsername: myProfile.username,
        fromDisplayName: myProfile.displayName,
        createdAt: now,
        read: false,
      })
      setIsFollowing(true)
    }
  }

  if (loading) return (
    <div style={{ maxWidth:640, margin:'0 auto', padding:'24px 16px' }}>
      <div style={{ background:'#141414', borderRadius:16, padding:24, marginBottom:12 }}>
        <div style={{ display:'flex', gap:14, alignItems:'center' }}>
          <div style={{ width:56, height:56, borderRadius:'50%', background:'#1E1E1E' }} />
          <div style={{ flex:1 }}>
            <div style={{ height:16, background:'#1E1E1E', borderRadius:8, width:'40%', marginBottom:8 }} />
            <div style={{ height:12, background:'#1E1E1E', borderRadius:8, width:'25%' }} />
          </div>
        </div>
      </div>
    </div>
  )

  if (notFound) return (
    <div style={{ maxWidth:640, margin:'0 auto', padding:'24px 16px', textAlign:'center' }}>
      <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'#888', cursor:'pointer', fontSize:14, marginBottom:24, padding:0, display:'block' }}>← Back</button>
      <p style={{ fontSize:24, marginBottom:12 }}>⬡</p>
      <p style={{ color:'#888', fontFamily:'Georgia,serif', fontSize:16 }}>@{username} not found.</p>
    </div>
  )

  if (!profile) return null

  return (
    <div style={{ maxWidth:640, margin:'0 auto', padding:'24px 16px' }}>
      <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'#888', cursor:'pointer', fontSize:14, marginBottom:16, padding:0 }}>← Back</button>

      {/* Profile header */}
      <div style={{ background:'#141414', border:'1px solid #2A2A2A', borderRadius:16, padding:24, marginBottom:16 }}>
        <div style={{ display:'flex', gap:16, alignItems:'flex-start', marginBottom:14 }}>
          <Avatar username={profile.username} size={56} />
          <div style={{ flex:1 }}>
            <div style={{ color:'#F0F0F0', fontWeight:700, fontSize:18, marginBottom:2 }}>{profile.displayName}</div>
            <div style={{ color:'#555', fontSize:13, fontFamily:"'DM Mono',monospace" }}>@{profile.username}</div>
          </div>
          {isOwnProfile ? (
            <button onClick={() => router.push('/profile')} style={{ background:'none', border:'1px solid #2A2A2A', borderRadius:16, color:'#888', fontSize:12, padding:'5px 14px', cursor:'pointer' }}>
              Edit profile
            </button>
          ) : (
            <button onClick={toggleFollow} style={{
              background: isFollowing ? '#1A1A1A' : '#E8FF47',
              border: `1px solid ${isFollowing ? '#3A3A3A' : '#E8FF47'}`,
              borderRadius:20, color: isFollowing ? '#555' : '#0D0D0D',
              padding:'7px 18px', cursor:'pointer', fontSize:13, fontWeight:700,
              fontFamily:"'DM Mono',monospace", transition:'all 0.15s',
            }}>
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>

        {profile.bio && (
          <p style={{ color:'#888', fontSize:14, fontFamily:'Georgia,serif', lineHeight:1.6, marginBottom:14 }}>{profile.bio}</p>
        )}

        <div style={{ display:'flex', gap:24 }}>
          <div>
            <span style={{ color:'#F0F0F0', fontWeight:700, fontFamily:"'DM Mono',monospace", fontSize:18 }}>{posts.length}</span>
            <span style={{ color:'#555', fontSize:12, marginLeft:6 }}>Yawps</span>
          </div>
          {isOwnProfile && (
            <div>
              <span style={{ color:'#F0F0F0', fontWeight:700, fontFamily:"'DM Mono',monospace", fontSize:18 }}>{followerCount}</span>
              <span style={{ color:'#555', fontSize:12, marginLeft:6 }}>Followers</span>
            </div>
          )}
        </div>
      </div>

      {/* Posts */}
      <div style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace", letterSpacing:'0.1em', marginBottom:12 }}>
        YAWPS
      </div>
      {posts.length === 0 ? (
        <div style={{ textAlign:'center', color:'#555', padding:'40px 20px' }}>
          <p style={{ fontFamily:'Georgia,serif', fontSize:15, color:'#888' }}>No yawps yet.</p>
        </div>
      ) : posts.map(post => (
        <div key={post.id} onClick={() => router.push(`/post/${post.id}`)} style={{ background:'#141414', border:'1px solid #2A2A2A', borderRadius:14, padding:'14px 18px', marginBottom:10, cursor:'pointer', transition:'border-color 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.borderColor='#3A3A3A'}
          onMouseLeave={e => e.currentTarget.style.borderColor='#2A2A2A'}>
          <p style={{ color:'#F0F0F0', fontSize:14, fontFamily:'Georgia,serif', lineHeight:1.55, marginBottom:8 }}>{post.content}</p>
          {post.tags?.length > 0 && (
            <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
              {post.tags.map(tag => (
                <span key={tag} onClick={e => { e.stopPropagation(); router.push(`/tag/${encodeURIComponent(tag.replace('#',''))}`) }}
                  style={{ background:'#1E1E1E', color:'#E8FF47', fontSize:11, padding:'2px 8px', borderRadius:20, fontFamily:"'DM Mono',monospace", cursor:'pointer' }}>{tag}</span>
              ))}
            </div>
          )}
          <div style={{ display:'flex', gap:14, alignItems:'center' }}>
            <span style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace" }}>{safeTimeAgo(post.createdAt)}</span>
            <span style={{ color:'#555', fontSize:11 }}>♥ {post.heartCount}</span>
            <span style={{ color:'#555', fontSize:11 }}>◎ {post.replyCount}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
