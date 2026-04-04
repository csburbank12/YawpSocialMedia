'use client'
import { useState, useEffect } from 'react'
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, doc, setDoc, deleteDoc, getDoc, increment, updateDoc
} from 'firebase/firestore'
import { formatDistanceToNow } from 'date-fns'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/AuthContext'
import { Post } from '@/types'
import Avatar from '@/components/ui/Avatar'
import { useRouter } from 'next/navigation'

export default function FeedPage() {
  const { user, profile } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [focused, setFocused] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50))
    const unsub = onSnapshot(q, async (snap) => {
      const postsData: Post[] = []
      for (const d of snap.docs) {
        const data = d.data()
        const [profileSnap, heartSnap, echoSnap, bookmarkSnap] = await Promise.all([
          getDoc(doc(db, 'profiles', data.userId)),
          getDoc(doc(db, 'posts', d.id, 'hearts', user.uid)),
          getDoc(doc(db, 'posts', d.id, 'echoes', user.uid)),
          getDoc(doc(db, 'bookmarks', user.uid, 'posts', d.id)),
        ])
        postsData.push({
          id: d.id, ...data,
          profile: profileSnap.exists() ? { id: profileSnap.id, ...profileSnap.data() } as any : null,
          hearted: heartSnap.exists(),
          echoed: echoSnap.exists(),
          bookmarked: bookmarkSnap.exists(),
        } as Post)
      }
      setPosts(postsData)
    })
    return unsub
  }, [user])

  const handlePost = async () => {
    if (!content.trim() || posting || !user || !profile) return
    setPosting(true)
    const tags = Array.from(new Set((content.match(/#\w+/g) || []).map(t => t.toLowerCase())))
    await addDoc(collection(db, 'posts'), {
      userId: user.uid, content: content.trim(), tags,
      heartCount: 0, echoCount: 0, replyCount: 0, createdAt: Date.now(),
    })
    setContent('')
    setPosting(false)
  }

  const toggleHeart = async (post: Post) => {
    if (!user) return
    const heartRef = doc(db, 'posts', post.id, 'hearts', user.uid)
    const postRef = doc(db, 'posts', post.id)
    if (post.hearted) {
      await deleteDoc(heartRef)
      await updateDoc(postRef, { heartCount: increment(-1) })
    } else {
      await setDoc(heartRef, { userId: user.uid, createdAt: Date.now() })
      await updateDoc(postRef, { heartCount: increment(1) })
      if (post.userId !== user.uid && profile) {
        await setDoc(doc(db, 'notifications', post.userId, 'items', `heart_${post.id}_${user.uid}`), {
          type: 'heart', fromUserId: user.uid, fromUsername: profile.username,
          fromDisplayName: profile.displayName, postId: post.id,
          postContent: post.content.slice(0, 80), createdAt: Date.now(), read: false,
        })
      }
    }
  }

  const toggleEcho = async (post: Post) => {
    if (!user) return
    const echoRef = doc(db, 'posts', post.id, 'echoes', user.uid)
    const postRef = doc(db, 'posts', post.id)
    if (post.echoed) {
      await deleteDoc(echoRef)
      await updateDoc(postRef, { echoCount: increment(-1) })
    } else {
      await setDoc(echoRef, { userId: user.uid, createdAt: Date.now() })
      await updateDoc(postRef, { echoCount: increment(1) })
    }
  }

  const toggleBookmark = async (post: Post) => {
    if (!user) return
    const ref = doc(db, 'bookmarks', user.uid, 'posts', post.id)
    if (post.bookmarked) {
      await deleteDoc(ref)
    } else {
      await setDoc(ref, { postId: post.id, savedAt: Date.now() })
    }
  }

  const deletePost = async (postId: string) => {
    if (!confirm('Delete this yawp?')) return
    await deleteDoc(doc(db, 'posts', postId))
  }

  const remaining = 280 - content.length
  const hasPosted = posts.some(p => p.userId === user?.uid)

  return (
    <div style={{ maxWidth:640, margin:'0 auto', padding:'24px 16px' }}>
      {/* Demo welcome — shown to demo users who haven't posted yet */}
      {profile?.isDemo && !hasPosted && posts.length > 0 && (
        <div style={{ background:'linear-gradient(135deg, #0D1500 0%, #0D1A0D 100%)', border:'1px solid #2A3A00', borderRadius:14, padding:'16px 20px', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <span style={{ background:'#E8FF47', color:'#0D0D0D', fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:20, fontFamily:"'DM Mono',monospace" }}>DEMO</span>
            <span style={{ color:'#E8FF47', fontWeight:700, fontSize:14 }}>Welcome to Yawp</span>
          </div>
          <p style={{ color:'#AAA', fontSize:13, fontFamily:'Georgia,serif', lineHeight:1.6, margin:'0 0 12px' }}>
            You&apos;re Alex Rivera. Heart posts, reply to threads, explore{' '}
            <span onClick={() => router.push('/circles')} style={{ color:'#47FFB2', cursor:'pointer' }}>Circles</span>,{' '}
            <span onClick={() => router.push('/messages')} style={{ color:'#47FFB2', cursor:'pointer' }}>Messages</span>, and{' '}
            <span onClick={() => router.push('/notifications')} style={{ color:'#47FFB2', cursor:'pointer' }}>Notifications</span>.
            Or sound your own yawp below.
          </p>
          <button onClick={() => router.push('/signup')} style={{ background:'#E8FF47', border:'none', borderRadius:20, padding:'7px 16px', color:'#0D0D0D', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:"'DM Mono',monospace" }}>
            Create your real account →
          </button>
        </div>
      )}

      {/* First-time welcome for new (non-demo) users */}
      {!profile?.isDemo && !hasPosted && posts.length > 0 && profile && !profile.bio && (
        <div style={{ background:'#0D1A0D', border:'1px solid #1A3A1A', borderRadius:14, padding:'14px 18px', marginBottom:16, display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ color:'#47FFB2', fontSize:18, flexShrink:0 }}>⬡</span>
          <div style={{ flex:1 }}>
            <div style={{ color:'#47FFB2', fontWeight:600, fontSize:13, marginBottom:2 }}>Welcome to Yawp.</div>
            <div style={{ color:'#888', fontSize:12, fontFamily:'Georgia,serif' }}>
              Sound your first yawp below — or{' '}
              <span onClick={() => router.push('/profile')} style={{ color:'#E8FF47', cursor:'pointer' }}>fill in your profile first</span>.
            </div>
          </div>
        </div>
      )}

      {/* Composer */}
      <div style={{ background:'#141414', border:`1px solid ${focused ? '#3A3A3A' : '#2A2A2A'}`, borderRadius:16, padding:'16px 20px', marginBottom:20, transition:'border-color 0.2s' }}>
        <textarea value={content} onChange={e => setContent(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          placeholder="What's your yawp today?" maxLength={280} rows={focused || content ? 3 : 1}
          style={{ width:'100%', background:'none', border:'none', outline:'none', color:'#F0F0F0', fontSize:15, resize:'none', fontFamily:'Georgia,serif', lineHeight:1.6 }} />
        {(focused || content) && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12, paddingTop:12, borderTop:'1px solid #2A2A2A' }}>
            <span style={{ color: remaining < 20 ? '#FF6B6B' : remaining < 40 ? '#FF8C47' : '#555', fontSize:12, fontFamily:"'DM Mono',monospace" }}>{remaining}</span>
            <button onClick={handlePost} disabled={!content.trim() || posting} style={{ background: content.trim() ? '#E8FF47' : '#2A2A2A', border:'none', borderRadius:20, padding:'7px 18px', color: content.trim() ? '#0D0D0D' : '#555', fontWeight:700, fontSize:13, cursor: content.trim() ? 'pointer' : 'default', transition:'all 0.15s' }}>
              {posting ? '...' : 'Yawp'}
            </button>
          </div>
        )}
      </div>

      {/* Feed */}
      {posts.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 20px', color:'#555' }}>
          <p style={{ fontSize:28, marginBottom:12 }}>⬡</p>
          <p style={{ fontFamily:'Georgia,serif', fontSize:16, marginBottom:8, color:'#888' }}>The feed is quiet.</p>
          <p style={{ fontSize:13 }}>Be the first to yawp.</p>
        </div>
      ) : posts.map(post => (
        <PostCard key={post.id} post={post} currentUserId={user?.uid ?? ''}
          onHeart={toggleHeart} onEcho={toggleEcho}
          onBookmark={toggleBookmark} onDelete={deletePost}
          onOpenThread={() => router.push(`/post/${post.id}`)}
          onOpenProfile={username => router.push(`/profile/${username}`)}
          onOpenTag={tag => router.push(`/tag/${encodeURIComponent(tag.replace('#',''))}`)}
        />
      ))}
    </div>
  )
}

function PostCard({ post, currentUserId, onHeart, onEcho, onBookmark, onDelete, onOpenThread, onOpenProfile, onOpenTag }: {
  post: Post; currentUserId: string
  onHeart: (p: Post) => void; onEcho: (p: Post) => void
  onBookmark: (p: Post) => void; onDelete: (id: string) => void
  onOpenThread: () => void
  onOpenProfile: (username: string) => void
  onOpenTag: (tag: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const username = post.profile?.username ?? 'unknown'
  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })
  const isOwner = post.userId === currentUserId

  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background:'#141414', border:`1px solid ${hovered ? '#3A3A3A' : '#2A2A2A'}`, borderRadius:16, padding:'18px 20px', marginBottom:12, transition:'border-color 0.2s', position:'relative' }}>
      <div style={{ display:'flex', gap:12 }}>
        {/* Avatar → public profile */}
        <button onClick={() => onOpenProfile(username)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, flexShrink:0 }}>
          <Avatar username={username} />
        </button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' }}>
            <button onClick={() => onOpenProfile(username)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'#F0F0F0', fontWeight:700, fontSize:14 }}>{post.profile?.displayName ?? username}</button>
            <button onClick={() => onOpenProfile(username)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'#555', fontSize:12, fontFamily:"'DM Mono',monospace" }}>@{username}</button>
            <span style={{ color:'#555', fontSize:12, marginLeft:'auto' }}>{timeAgo}</span>
          </div>
          <p onClick={onOpenThread} style={{ color:'#F0F0F0', fontSize:15, lineHeight:1.6, margin:'0 0 12px', fontFamily:'Georgia,serif', wordBreak:'break-word', cursor:'pointer' }}>{post.content}</p>
          {post.tags?.length > 0 && (
            <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
              {post.tags.map(tag => (
                <span key={tag} onClick={() => onOpenTag(tag)}
                  style={{ background:'#1E1E1E', color:'#E8FF47', fontSize:11, padding:'2px 8px', borderRadius:20, fontFamily:"'DM Mono',monospace", cursor:'pointer' }}>{tag}</span>
              ))}
            </div>
          )}
          <div style={{ display:'flex', gap:20, alignItems:'center' }}>
            <button onClick={() => onHeart(post)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:5, color: post.hearted ? '#FF6B6B' : '#555', fontSize:13, transition:'color 0.15s' }}>
              <span style={{ fontSize:16 }}>{post.hearted ? '♥' : '♡'}</span>
              <span style={{ fontFamily:"'DM Mono',monospace" }}>{post.heartCount}</span>
            </button>
            <button onClick={onOpenThread} style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:5, color:'#555', fontSize:13, transition:'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color='#F0F0F0')} onMouseLeave={e => (e.currentTarget.style.color='#555')}>
              <span style={{ fontSize:15 }}>◎</span>
              <span style={{ fontFamily:"'DM Mono',monospace" }}>{post.replyCount}</span>
            </button>
            <button onClick={() => onEcho(post)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:5, color: post.echoed ? '#47FFB2' : '#555', fontSize:13, transition:'color 0.15s' }}>
              <span style={{ fontSize:14 }}>↺</span>
              <span style={{ fontFamily:"'DM Mono',monospace" }}>{post.echoCount}</span>
            </button>
            <button onClick={() => onBookmark(post)} title={post.bookmarked ? 'Remove bookmark' : 'Save'}
              style={{ background:'none', border:'none', cursor:'pointer', padding:0, color: post.bookmarked ? '#E8FF47' : '#555', fontSize:14, transition:'color 0.15s', marginLeft:'auto' }}>
              {post.bookmarked ? '★' : '☆'}
            </button>
          </div>
        </div>
      </div>
      {isOwner && hovered && (
        <button onClick={() => onDelete(post.id)}
          style={{ position:'absolute', top:14, right:14, background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:13, padding:'2px 6px', borderRadius:6, transition:'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color='#FF6B6B')} onMouseLeave={e => (e.currentTarget.style.color='#555')}>✕</button>
      )}
    </div>
  )
}
