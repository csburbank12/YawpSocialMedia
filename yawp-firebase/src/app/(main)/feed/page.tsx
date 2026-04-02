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
  const [heartedIds, setHeartedIds] = useState<Set<string>>(new Set())
  const router = useRouter()

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50))
    const unsub = onSnapshot(q, async (snap) => {
      const postsData: Post[] = []
      for (const d of snap.docs) {
        const data = d.data()
        // Fetch profile for each post
        const profileSnap = await getDoc(doc(db, 'profiles', data.userId))
        const postProfile = profileSnap.exists() ? { id: profileSnap.id, ...profileSnap.data() } as any : null
        // Check if hearted
        const heartSnap = await getDoc(doc(db, 'posts', d.id, 'hearts', user.uid))
        postsData.push({
          id: d.id, ...data,
          profile: postProfile,
          hearted: heartSnap.exists(),
          echoed: false,
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
      userId: user.uid,
      content: content.trim(),
      tags,
      heartCount: 0,
      echoCount: 0,
      replyCount: 0,
      createdAt: Date.now(),
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
    }
  }

  const remaining = 280 - content.length

  return (
    <div style={{ maxWidth:640, margin:'0 auto', padding:'24px 16px' }}>
      {/* Composer */}
      <div style={{
        background:'#141414', border:`1px solid ${focused ? '#3A3A3A' : '#2A2A2A'}`,
        borderRadius:16, padding:'16px 20px', marginBottom:20, transition:'border-color 0.2s'
      }}>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="What's your yawp today?"
          maxLength={280} rows={focused || content ? 3 : 1}
          style={{ width:'100%', background:'none', border:'none', outline:'none', color:'#F0F0F0', fontSize:15, resize:'none', fontFamily:'Georgia,serif', lineHeight:1.6 }}
        />
        {(focused || content) && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12, paddingTop:12, borderTop:'1px solid #2A2A2A' }}>
            <span style={{ color: remaining < 20 ? '#FF6B6B' : remaining < 40 ? '#FF8C47' : '#555', fontSize:12, fontFamily:"'DM Mono',monospace" }}>{remaining}</span>
            <button onClick={handlePost} disabled={!content.trim() || posting} style={{
              background: content.trim() ? '#E8FF47' : '#2A2A2A',
              border:'none', borderRadius:20, padding:'7px 18px',
              color: content.trim() ? '#0D0D0D' : '#555',
              fontWeight:700, fontSize:13, cursor: content.trim() ? 'pointer' : 'default', transition:'all 0.15s'
            }}>{posting ? '...' : 'Yawp'}</button>
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
        <PostCard key={post.id} post={post} currentUserId={user?.uid ?? ''} onHeart={toggleHeart} onOpenThread={() => router.push(`/post/${post.id}`)} />
      ))}
    </div>
  )
}

function PostCard({ post, currentUserId, onHeart, onOpenThread }: {
  post: Post; currentUserId: string
  onHeart: (p: Post) => void; onOpenThread: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const username = post.profile?.username ?? 'unknown'
  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })

  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background:'#141414', border:`1px solid ${hovered ? '#3A3A3A' : '#2A2A2A'}`, borderRadius:16, padding:'18px 20px', marginBottom:12, transition:'border-color 0.2s' }}>
      <div style={{ display:'flex', gap:12 }}>
        <Avatar username={username} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' }}>
            <span style={{ color:'#F0F0F0', fontWeight:700, fontSize:14 }}>{post.profile?.displayName ?? username}</span>
            <span style={{ color:'#555', fontSize:12, fontFamily:"'DM Mono',monospace" }}>@{username}</span>
            <span style={{ color:'#555', fontSize:12, marginLeft:'auto' }}>{timeAgo}</span>
          </div>
          <p onClick={onOpenThread} style={{ color:'#F0F0F0', fontSize:15, lineHeight:1.6, margin:'0 0 12px', fontFamily:'Georgia,serif', wordBreak:'break-word', cursor:'pointer' }}>
            {post.content}
          </p>
          {post.tags?.length > 0 && (
            <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
              {post.tags.map(tag => (
                <span key={tag} style={{ background:'#1E1E1E', color:'#E8FF47', fontSize:11, padding:'2px 8px', borderRadius:20, fontFamily:"'DM Mono',monospace" }}>{tag}</span>
              ))}
            </div>
          )}
          <div style={{ display:'flex', gap:20 }}>
            <button onClick={() => onHeart(post)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:5, color: post.hearted ? '#FF6B6B' : '#555', fontSize:13, transition:'color 0.15s' }}>
              <span style={{ fontSize:16 }}>{post.hearted ? '♥' : '♡'}</span>
              <span style={{ fontFamily:"'DM Mono',monospace" }}>{post.heartCount}</span>
            </button>
            <button onClick={onOpenThread} style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:5, color:'#555', fontSize:13 }}>
              <span style={{ fontSize:15 }}>◎</span>
              <span style={{ fontFamily:"'DM Mono',monospace" }}>{post.replyCount}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
