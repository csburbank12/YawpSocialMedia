'use client'
import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, getDocs, setDoc, deleteDoc, increment, updateDoc, where, limit } from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/AuthContext'
import { Post, Reply } from '@/types'
import Avatar from '@/components/ui/Avatar'
import RichText from '@/components/ui/RichText'
import QuoteCard from '@/components/ui/QuoteCard'
import { formatDistanceToNow as fmtDistance } from 'date-fns'
import { toMs } from '@/lib/utils'

function parseMentions(text: string): string[] {
  const matches = text.match(/@([\w]+)/g) ?? []
  return [...new Set(matches.map(m => m.slice(1).toLowerCase()))]
}

export default function PostPage({ params }: { params: { id: string } }) {
  const { user, profile } = useAuth()
  const router = useRouter()
  const [post, setPost] = useState<Post | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [replyText, setReplyText] = useState('')
  const [posting, setPosting] = useState(false)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!user) return
    const loadPost = async () => {
      const snap = await getDoc(doc(db, 'posts', params.id))
      if (!snap.exists()) return
      const data = snap.data()
      const [profileSnap, heartSnap, echoSnap] = await Promise.all([
        getDoc(doc(db, 'profiles', data.userId)),
        getDoc(doc(db, 'posts', params.id, 'hearts', user.uid)),
        getDoc(doc(db, 'posts', params.id, 'echoes', user.uid)),
      ])

      let quotedPost: Post | undefined
      if (data.quotedPostId) {
        const qSnap = await getDoc(doc(db, 'posts', data.quotedPostId))
        if (qSnap.exists()) {
          const qData = qSnap.data()
          const qProfileSnap = await getDoc(doc(db, 'profiles', qData.userId))
          quotedPost = {
            id: qSnap.id, ...qData,
            profile: qProfileSnap.exists() ? { id: qProfileSnap.id, ...qProfileSnap.data() } as any : null,
          } as Post
        }
      }

      setPost({
        id: snap.id, ...data,
        profile: profileSnap.exists() ? { id: profileSnap.id, ...profileSnap.data() } as any : null,
        hearted: heartSnap.exists(),
        echoed: echoSnap.exists(),
        quotedPost,
      } as Post)
    }
    loadPost()

    const q = query(collection(db, 'posts', params.id, 'replies'), orderBy('createdAt', 'asc'))
    const unsub = onSnapshot(q, async snap => {
      const replyData: Reply[] = []
      for (const d of snap.docs) {
        const data = d.data()
        const profileSnap = await getDoc(doc(db, 'profiles', data.userId))
        const heartSnap = await getDoc(doc(db, 'posts', params.id, 'replies', d.id, 'hearts', user.uid))
        replyData.push({
          id: d.id, ...data,
          profile: profileSnap.exists() ? { id: profileSnap.id, ...profileSnap.data() } as any : null,
          hearted: heartSnap.exists(),
        } as Reply)
      }
      setReplies(replyData)
    })
    return unsub
  }, [params.id, user])

  const handleReply = async () => {
    if (!replyText.trim() || posting || !user || !post || !profile) return
    setPosting(true)
    const mentions = parseMentions(replyText)
    await addDoc(collection(db, 'posts', params.id, 'replies'), {
      postId: params.id, userId: user.uid, content: replyText.trim(),
      mentions, heartCount: 0, createdAt: Date.now(),
    })
    await updateDoc(doc(db, 'posts', params.id), { replyCount: increment(1) })

    // Notify post owner of reply
    if (post.userId !== user.uid) {
      await setDoc(doc(db, 'notifications', post.userId, 'items', `reply_${params.id}_${user.uid}_${Date.now()}`), {
        type: 'reply',
        fromUserId: user.uid, fromUsername: profile.username, fromDisplayName: profile.displayName,
        postId: params.id, postContent: post.content.slice(0, 80),
        replyContent: replyText.trim().slice(0, 80),
        createdAt: Date.now(), read: false,
      })
    }

    // Notify mentioned users
    for (const username of mentions) {
      if (username === profile.username) continue
      const mentionedSnap = await getDocs(query(collection(db, 'profiles'), where('username', '==', username), limit(1)))
      if (!mentionedSnap.empty) {
        const mentionedUid = mentionedSnap.docs[0].id
        await setDoc(doc(db, 'notifications', mentionedUid, 'items', `mention_reply_${params.id}_${user.uid}`), {
          type: 'mention',
          fromUserId: user.uid, fromUsername: profile.username, fromDisplayName: profile.displayName,
          postId: params.id, postContent: replyText.trim().slice(0, 80),
          createdAt: Date.now(), read: false,
        })
      }
    }

    setReplyText('')
    setPosting(false)
  }

  const toggleHeart = async () => {
    if (!user || !post) return
    const heartRef = doc(db, 'posts', params.id, 'hearts', user.uid)
    const postRef = doc(db, 'posts', params.id)
    if (post.hearted) {
      await deleteDoc(heartRef)
      await updateDoc(postRef, { heartCount: increment(-1) })
      setPost(prev => prev ? { ...prev, hearted: false, heartCount: prev.heartCount - 1 } : prev)
    } else {
      await setDoc(heartRef, { userId: user.uid, createdAt: Date.now() })
      await updateDoc(postRef, { heartCount: increment(1) })
      setPost(prev => prev ? { ...prev, hearted: true, heartCount: prev.heartCount + 1 } : prev)
      if (post.userId !== user.uid && profile) {
        await setDoc(doc(db, 'notifications', post.userId, 'items', `heart_${params.id}_${user.uid}`), {
          type: 'heart', fromUserId: user.uid, fromUsername: profile.username,
          fromDisplayName: profile.displayName, postId: params.id,
          postContent: post.content.slice(0, 80), createdAt: Date.now(), read: false,
        })
      }
    }
  }

  const toggleReplyHeart = async (reply: Reply) => {
    if (!user) return
    const heartRef = doc(db, 'posts', params.id, 'replies', reply.id, 'hearts', user.uid)
    const replyRef = doc(db, 'posts', params.id, 'replies', reply.id)
    if (reply.hearted) {
      await deleteDoc(heartRef)
      await updateDoc(replyRef, { heartCount: increment(-1) })
      setReplies(prev => prev.map(r => r.id === reply.id ? { ...r, hearted: false, heartCount: r.heartCount - 1 } : r))
    } else {
      await setDoc(heartRef, { userId: user.uid, createdAt: Date.now() })
      await updateDoc(replyRef, { heartCount: increment(1) })
      setReplies(prev => prev.map(r => r.id === reply.id ? { ...r, hearted: true, heartCount: r.heartCount + 1 } : r))
    }
  }

  const deletePost = async () => {
    if (!post || post.userId !== user?.uid) return
    if (!confirm('Delete this yawp?')) return
    await deleteDoc(doc(db, 'posts', params.id))
    router.back()
  }

  if (!post) return (
    <div style={{ maxWidth:640, margin:'0 auto', padding:'24px 16px' }}>
      <div style={{ background:'#141414', borderRadius:16, padding:'18px 20px', marginBottom:16 }}>
        <div style={{ height:16, background:'#1E1E1E', borderRadius:8, marginBottom:12, width:'60%' }} />
        <div style={{ height:14, background:'#1E1E1E', borderRadius:8, marginBottom:8, width:'90%' }} />
        <div style={{ height:14, background:'#1E1E1E', borderRadius:8, width:'75%' }} />
      </div>
    </div>
  )

  const username = post.profile?.username ?? 'unknown'
  const isOwner = post.userId === user?.uid

  return (
    <div style={{ maxWidth:640, margin:'0 auto', padding:'24px 16px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'#888', cursor:'pointer', fontSize:14, padding:0 }}>← Back</button>
        {isOwner && (
          <button onClick={deletePost} style={{ background:'none', border:'1px solid #2A2A2A', borderRadius:20, color:'#555', cursor:'pointer', fontSize:12, padding:'4px 12px', transition:'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='#FF6B6B'; e.currentTarget.style.color='#FF6B6B' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='#2A2A2A'; e.currentTarget.style.color='#555' }}>
            Delete post
          </button>
        )}
      </div>

      {/* Original post */}
      <div style={{ background:'#141414', border:'1px solid #2A2A2A', borderRadius:16, padding:'18px 20px', marginBottom:16 }}>
        <div style={{ display:'flex', gap:12 }}>
          <button onClick={() => router.push(`/profile/${username}`)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, flexShrink:0 }}>
            <Avatar username={username} />
          </button>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' }}>
              <button onClick={() => router.push(`/profile/${username}`)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'#F0F0F0', fontWeight:700, fontSize:14 }}>{post.profile?.displayName ?? username}</button>
              <button onClick={() => router.push(`/profile/${username}`)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'#555', fontSize:12, fontFamily:"'DM Mono',monospace" }}>@{username}</button>
              <span style={{ color:'#555', fontSize:12, marginLeft:'auto' }}>{fmtDistance(new Date(toMs(post.createdAt)), { addSuffix:true })}</span>
              {post.editedAt && <span style={{ color:'#444', fontSize:11, fontFamily:"'DM Mono',monospace" }}>edited</span>}
            </div>
            <RichText
              content={post.content}
              style={{ color:'#F0F0F0', fontSize:15, lineHeight:1.6, fontFamily:'Georgia,serif', display:'block', marginBottom: post.quotedPost || (post.tags?.length ?? 0) > 0 ? 10 : 12 }}
            />
            {post.quotedPost && <QuoteCard post={post.quotedPost} />}
            {(post.tags?.length ?? 0) > 0 && (
              <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap', marginTop: post.quotedPost ? 10 : 0 }}>
                {post.tags.map(tag => <span key={tag} style={{ background:'#1E1E1E', color:'#E8FF47', fontSize:11, padding:'2px 8px', borderRadius:20, fontFamily:"'DM Mono',monospace" }}>{tag}</span>)}
              </div>
            )}
            <div style={{ display:'flex', gap:20 }}>
              <button onClick={toggleHeart} style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:5, color: post.hearted ? '#FF6B6B' : '#555', fontSize:13, transition:'color 0.15s' }}>
                <span style={{ fontSize:16 }}>{post.hearted ? '♥' : '♡'}</span>
                <span style={{ fontFamily:"'DM Mono',monospace" }}>{post.heartCount}</span>
              </button>
              <span style={{ display:'flex', alignItems:'center', gap:5, color:'#555', fontSize:13 }}>
                <span style={{ fontSize:15 }}>◎</span>
                <span style={{ fontFamily:"'DM Mono',monospace" }}>{post.replyCount}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Reply composer */}
      <div style={{ background:'#141414', border:`1px solid ${focused ? '#3A3A3A' : '#2A2A2A'}`, borderRadius:16, padding:'14px 18px', marginBottom:16, transition:'border-color 0.2s' }}>
        <textarea value={replyText} onChange={e => setReplyText(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          placeholder="Write a reply... (@mention someone)" maxLength={280} rows={focused || replyText ? 3 : 1}
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
      {replies.length > 0 && (
        <div style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace", letterSpacing:'0.1em', marginBottom:8 }}>
          {replies.length} {replies.length === 1 ? 'REPLY' : 'REPLIES'}
        </div>
      )}
      <div style={{ background:'#141414', border:'1px solid #2A2A2A', borderRadius:16, overflow:'hidden' }}>
        {replies.length === 0 ? (
          <div style={{ textAlign:'center', color:'#555', padding:'32px 20px', fontFamily:'Georgia,serif', fontSize:14 }}>No replies yet. Be the first.</div>
        ) : replies.map((reply, i) => {
          const ru = reply.profile?.username ?? 'unknown'
          return (
            <div key={reply.id} style={{ display:'flex', gap:12, padding:'14px 20px', borderBottom: i < replies.length - 1 ? '1px solid #1E1E1E' : 'none' }}>
              <button onClick={() => router.push(`/profile/${ru}`)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, flexShrink:0 }}>
                <Avatar username={ru} size={32} />
              </button>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <button onClick={() => router.push(`/profile/${ru}`)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'#F0F0F0', fontWeight:600, fontSize:13 }}>{reply.profile?.displayName ?? ru}</button>
                  <button onClick={() => router.push(`/profile/${ru}`)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace" }}>@{ru}</button>
                  <span style={{ color:'#555', fontSize:11, marginLeft:'auto' }}>{fmtDistance(new Date(toMs(reply.createdAt)), { addSuffix:true })}</span>
                </div>
                <RichText
                  content={reply.content}
                  style={{ color:'#E0E0E0', fontSize:14, lineHeight:1.6, fontFamily:'Georgia,serif', display:'block', marginBottom:10 }}
                />
                <button onClick={() => toggleReplyHeart(reply)}
                  style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:4, color: reply.hearted ? '#FF6B6B' : '#555', fontSize:12, transition:'color 0.15s' }}>
                  <span>{reply.hearted ? '♥' : '♡'}</span>
                  <span style={{ fontFamily:"'DM Mono',monospace" }}>{reply.heartCount}</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
