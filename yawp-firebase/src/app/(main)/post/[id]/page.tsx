'use client'
import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, setDoc, deleteDoc, increment, updateDoc } from 'firebase/firestore'
import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/AuthContext'
import { Post, Reply } from '@/types'
import Avatar from '@/components/ui/Avatar'

export default function PostPage({ params }: { params: { id: string } }) {
  const { user } = useAuth()
  const router = useRouter()
  const [post, setPost] = useState<Post | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [replyText, setReplyText] = useState('')
  const [posting, setPosting] = useState(false)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!user) return
    // Load post
    const loadPost = async () => {
      const snap = await getDoc(doc(db, 'posts', params.id))
      if (!snap.exists()) return
      const data = snap.data()
      const profileSnap = await getDoc(doc(db, 'profiles', data.userId))
      const heartSnap = await getDoc(doc(db, 'posts', params.id, 'hearts', user.uid))
      setPost({ id: snap.id, ...data, profile: profileSnap.exists() ? { id: profileSnap.id, ...profileSnap.data() } as any : null, hearted: heartSnap.exists() } as Post)
    }
    loadPost()

    // Real-time replies
    const q = query(collection(db, 'posts', params.id, 'replies'), orderBy('createdAt', 'asc'))
    const unsub = onSnapshot(q, async snap => {
      const replyData: Reply[] = []
      for (const d of snap.docs) {
        const data = d.data()
        const profileSnap = await getDoc(doc(db, 'profiles', data.userId))
        const heartSnap = await getDoc(doc(db, 'posts', params.id, 'replies', d.id, 'hearts', user.uid))
        replyData.push({ id: d.id, ...data, profile: profileSnap.exists() ? { id: profileSnap.id, ...profileSnap.data() } as any : null, hearted: heartSnap.exists() } as Reply)
      }
      setReplies(replyData)
    })
    return unsub
  }, [params.id, user])

  const handleReply = async () => {
    if (!replyText.trim() || posting || !user || !post) return
    setPosting(true)
    await addDoc(collection(db, 'posts', params.id, 'replies'), {
      postId: params.id, userId: user.uid, content: replyText.trim(), heartCount: 0, createdAt: Date.now(),
    })
    await updateDoc(doc(db, 'posts', params.id), { replyCount: increment(1) })
    setReplyText('')
    setPosting(false)
  }

  const toggleHeart = async () => {
    if (!user || !post) return
    const heartRef = doc(db, 'posts', params.id, 'hearts', user.uid)
    if (post.hearted) {
      await deleteDoc(heartRef)
      await updateDoc(doc(db, 'posts', params.id), { heartCount: increment(-1) })
      setPost(prev => prev ? { ...prev, hearted: false, heartCount: prev.heartCount - 1 } : prev)
    } else {
      await setDoc(heartRef, { userId: user.uid, createdAt: Date.now() })
      await updateDoc(doc(db, 'posts', params.id), { heartCount: increment(1) })
      setPost(prev => prev ? { ...prev, hearted: true, heartCount: prev.heartCount + 1 } : prev)
    }
  }

  if (!post) return (
    <div style={{ maxWidth:640, margin:'0 auto', padding:'24px 16px', textAlign:'center', color:'#555' }}>Loading...</div>
  )

  const username = post.profile?.username ?? 'unknown'

  return (
    <div style={{ maxWidth:640, margin:'0 auto', padding:'24px 16px' }}>
      <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'#888', cursor:'pointer', fontSize:14, marginBottom:16, padding:0 }}>← Back</button>

      {/* Original post */}
      <div style={{ background:'#141414', border:'1px solid #2A2A2A', borderRadius:16, padding:'18px 20px', marginBottom:16 }}>
        <div style={{ display:'flex', gap:12 }}>
          <Avatar username={username} />
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ color:'#F0F0F0', fontWeight:700, fontSize:14 }}>{post.profile?.displayName ?? username}</span>
              <span style={{ color:'#555', fontSize:12, fontFamily:"'DM Mono',monospace" }}>@{username}</span>
              <span style={{ color:'#555', fontSize:12, marginLeft:'auto' }}>{formatDistanceToNow(new Date(post.createdAt), { addSuffix:true })}</span>
            </div>
            <p style={{ color:'#F0F0F0', fontSize:15, lineHeight:1.6, margin:'0 0 12px', fontFamily:'Georgia,serif' }}>{post.content}</p>
            {post.tags?.length > 0 && (
              <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
                {post.tags.map(tag => <span key={tag} style={{ background:'#1E1E1E', color:'#E8FF47', fontSize:11, padding:'2px 8px', borderRadius:20, fontFamily:"'DM Mono',monospace" }}>{tag}</span>)}
              </div>
            )}
            <div style={{ display:'flex', gap:20 }}>
              <button onClick={toggleHeart} style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:5, color: post.hearted ? '#FF6B6B' : '#555', fontSize:13, transition:'color 0.15s' }}>
                <span style={{ fontSize:16 }}>{post.hearted ? '♥' : '♡'}</span>
                <span style={{ fontFamily:"'DM Mono',monospace" }}>{post.heartCount}</span>
              </button>
              <button style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:5, color:'#555', fontSize:13 }}>
                <span style={{ fontSize:15 }}>◎</span>
                <span style={{ fontFamily:"'DM Mono',monospace" }}>{post.replyCount}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reply composer */}
      <div style={{ background:'#141414', border:`1px solid ${focused ? '#3A3A3A' : '#2A2A2A'}`, borderRadius:16, padding:'14px 18px', marginBottom:16, transition:'border-color 0.2s' }}>
        <textarea value={replyText} onChange={e => setReplyText(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          placeholder="Write a reply..." maxLength={280} rows={focused || replyText ? 3 : 1}
          style={{ width:'100%', background:'none', border:'none', outline:'none', color:'#F0F0F0', fontSize:14, resize:'none', fontFamily:'Georgia,serif', lineHeight:1.6 }} />
        {(focused || replyText) && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10, paddingTop:10, borderTop:'1px solid #2A2A2A' }}>
            <span style={{ color: 280-replyText.length < 20 ? '#FF6B6B' : '#555', fontSize:11, fontFamily:"'DM Mono',monospace" }}>{280-replyText.length}</span>
            <button onClick={handleReply} disabled={!replyText.trim() || posting}
              style={{ background: replyText.trim() ? '#47FFB2' : '#2A2A2A', border:'none', borderRadius:20, padding:'7px 18px', color: replyText.trim() ? '#0D0D0D' : '#555', fontWeight:700, fontSize:13, cursor: replyText.trim() ? 'pointer' : 'default', transition:'all 0.15s' }}>
              {posting ? '...' : 'Reply'}
            </button>
          </div>
        )}
      </div>

      {/* Replies */}
      {replies.length > 0 && <div style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace", letterSpacing:'0.1em', marginBottom:8 }}>{replies.length} {replies.length===1?'REPLY':'REPLIES'}</div>}
      <div style={{ background:'#141414', border:'1px solid #2A2A2A', borderRadius:16, overflow:'hidden' }}>
        {replies.length === 0 ? (
          <div style={{ textAlign:'center', color:'#555', padding:'32px 20px', fontFamily:'Georgia,serif', fontSize:14 }}>No replies yet. Be the first.</div>
        ) : replies.map((reply, i) => {
          const ru = reply.profile?.username ?? 'unknown'
          return (
            <div key={reply.id} style={{ display:'flex', gap:12, padding:'14px 20px', borderBottom: i < replies.length-1 ? '1px solid #1E1E1E' : 'none' }}>
              <Avatar username={ru} size={32} />
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <span style={{ color:'#F0F0F0', fontWeight:600, fontSize:13 }}>{reply.profile?.displayName ?? ru}</span>
                  <span style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace" }}>@{ru}</span>
                  <span style={{ color:'#555', fontSize:11, marginLeft:'auto' }}>{formatDistanceToNow(new Date(reply.createdAt), { addSuffix:true })}</span>
                </div>
                <p style={{ color:'#E0E0E0', fontSize:14, lineHeight:1.6, margin:'0 0 10px', fontFamily:'Georgia,serif' }}>{reply.content}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
