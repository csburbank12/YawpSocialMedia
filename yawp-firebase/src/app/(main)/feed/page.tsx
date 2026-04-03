'use client'
import { useState, useEffect, useRef } from 'react'
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, doc, setDoc, deleteDoc, getDoc, getDocs,
  increment, updateDoc, where,
} from 'firebase/firestore'
import { formatDistanceToNow } from 'date-fns'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/AuthContext'
import { Post } from '@/types'
import Avatar from '@/components/ui/Avatar'
import RichText from '@/components/ui/RichText'
import QuoteCard from '@/components/ui/QuoteCard'
import { useRouter } from 'next/navigation'

const DRAFT_KEY = 'yawp_draft'

/** Extract @mentioned usernames from content */
function parseMentions(text: string): string[] {
  const matches = text.match(/@([\w]+)/g) ?? []
  return [...new Set(matches.map(m => m.slice(1).toLowerCase()))]
}

/** Words in a string */
function wordCount(text: string | undefined): number {
  if (!text) return 0
  return text.trim().split(/\s+/).filter(Boolean).length
}

export default function FeedPage() {
  const { user, profile } = useAuth()
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [focused, setFocused] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)
  // Quote compose state
  const [quotingPost, setQuotingPost] = useState<Post | null>(null)
  // Muted user IDs
  const [mutedIds, setMutedIds] = useState<Set<string>>(new Set())
  const composerRef = useRef<HTMLTextAreaElement>(null)

  // Load draft from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY)
    if (saved) {
      setContent(saved)
      setDraftRestored(true)
      setTimeout(() => setDraftRestored(false), 3000)
    }
  }, [])

  // Auto-save draft to localStorage
  useEffect(() => {
    if (content) {
      localStorage.setItem(DRAFT_KEY, content)
    } else {
      localStorage.removeItem(DRAFT_KEY)
    }
  }, [content])

  // Load muted users — wrapped in try/catch since this is a new subcollection
  // that may not be covered by existing Firestore rules on first deploy
  useEffect(() => {
    if (!user) return
    getDocs(collection(db, 'profiles', user.uid, 'muted'))
      .then(snap => setMutedIds(new Set(snap.docs.map(d => d.id))))
      .catch(() => { /* muted subcollection not yet accessible — silently skip */ })
  }, [user])

  // Subscribe to feed
  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(60))
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

        postsData.push({
          id: d.id, ...data,
          profile: profileSnap.exists() ? { id: profileSnap.id, ...profileSnap.data() } as any : null,
          hearted: heartSnap.exists(),
          echoed: echoSnap.exists(),
          bookmarked: bookmarkSnap.exists(),
          quotedPost,
        } as Post)
      }
      setPosts(postsData)
    })
    return unsub
  }, [user])

  const handlePost = async () => {
    if (!content.trim() || posting || !user || !profile) return
    setPosting(true)
    const tags = Array.from(new Set((content.match(/#\w+/g) ?? []).map(t => t.toLowerCase())))
    const mentions = parseMentions(content)

    const postData: Record<string, any> = {
      userId: user.uid, content: content.trim(), tags, mentions,
      heartCount: 0, echoCount: 0, replyCount: 0, createdAt: Date.now(),
    }
    if (quotingPost) postData.quotedPostId = quotingPost.id

    const ref = await addDoc(collection(db, 'posts'), postData)
    localStorage.removeItem(DRAFT_KEY)
    setContent('')
    setQuotingPost(null)
    setPosting(false)

    // Notify quoted post owner
    if (quotingPost && quotingPost.userId !== user.uid) {
      await setDoc(doc(db, 'notifications', quotingPost.userId, 'items', `quote_${ref.id}_${user.uid}`), {
        type: 'quote',
        fromUserId: user.uid,
        fromUsername: profile.username,
        fromDisplayName: profile.displayName,
        postId: ref.id,
        quotedPostId: quotingPost.id,
        postContent: content.trim().slice(0, 80),
        createdAt: Date.now(),
        read: false,
      })
    }

    // Notify mentioned users
    for (const username of mentions) {
      if (username === profile.username) continue
      const mentionedSnap = await getDocs(
        query(collection(db, 'profiles'), where('username', '==', username), limit(1))
      )
      if (!mentionedSnap.empty) {
        const mentionedUid = mentionedSnap.docs[0].id
        await setDoc(doc(db, 'notifications', mentionedUid, 'items', `mention_${ref.id}_${user.uid}`), {
          type: 'mention',
          fromUserId: user.uid,
          fromUsername: profile.username,
          fromDisplayName: profile.displayName,
          postId: ref.id,
          postContent: content.trim().slice(0, 80),
          createdAt: Date.now(),
          read: false,
        })
      }
    }
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
    if (post.bookmarked) await deleteDoc(ref)
    else await setDoc(ref, { postId: post.id, savedAt: Date.now() })
  }

  const deletePost = async (postId: string) => {
    if (!confirm('Delete this yawp?')) return
    await deleteDoc(doc(db, 'posts', postId))
  }

  const handleMute = async (targetUserId: string) => {
    if (!user) return
    try {
      const muteRef = doc(db, 'profiles', user.uid, 'muted', targetUserId)
      await setDoc(muteRef, { mutedAt: Date.now() })
    } catch {
      // Firestore write may fail if rules don't yet cover the muted subcollection
    }
    // Update local state regardless so the UI hides the post immediately
    setMutedIds(prev => new Set([...prev, targetUserId]))
  }

  const startQuote = (post: Post) => {
    setQuotingPost(post)
    composerRef.current?.focus()
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const remaining = 280 - content.length
  const hasPosted = posts.some(p => p.userId === user?.uid)
  const visiblePosts = posts.filter(p => !mutedIds.has(p.userId))

  return (
    <div style={{ maxWidth:640, margin:'0 auto', padding:'24px 16px' }}>
      {/* First-time welcome nudge */}
      {!hasPosted && posts.length > 0 && profile && !profile.bio && (
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
        {/* Quote preview inside composer */}
        {quotingPost && (
          <div style={{ marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace" }}>AMPLIFYING</span>
              <button onClick={() => setQuotingPost(null)} style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:13, padding:0 }}>✕</button>
            </div>
            <QuoteCard post={quotingPost} />
          </div>
        )}
        <textarea
          ref={composerRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={quotingPost ? 'Add your voice…' : "What's your yawp today?"}
          maxLength={280} rows={focused || content || quotingPost ? 3 : 1}
          style={{ width:'100%', background:'none', border:'none', outline:'none', color:'#F0F0F0', fontSize:15, resize:'none', fontFamily:'Georgia,serif', lineHeight:1.6 }}
        />
        {(focused || content || quotingPost) && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12, paddingTop:12, borderTop:'1px solid #2A2A2A' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ color: remaining < 20 ? '#FF6B6B' : remaining < 40 ? '#FF8C47' : '#555', fontSize:12, fontFamily:"'DM Mono',monospace" }}>{remaining}</span>
              {draftRestored && (
                <span style={{ color:'#47FFB2', fontSize:11, fontFamily:"'DM Mono',monospace" }}>draft restored</span>
              )}
              {!draftRestored && content && (
                <span style={{ color:'#333', fontSize:11, fontFamily:"'DM Mono',monospace" }}>draft saved</span>
              )}
            </div>
            <button onClick={handlePost} disabled={!content.trim() || posting} style={{ background: content.trim() ? '#E8FF47' : '#2A2A2A', border:'none', borderRadius:20, padding:'7px 18px', color: content.trim() ? '#0D0D0D' : '#555', fontWeight:700, fontSize:13, cursor: content.trim() ? 'pointer' : 'default', transition:'all 0.15s' }}>
              {posting ? '...' : 'Yawp'}
            </button>
          </div>
        )}
      </div>

      {/* Feed */}
      {visiblePosts.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 20px', color:'#555' }}>
          <p style={{ fontSize:28, marginBottom:12 }}>⬡</p>
          <p style={{ fontFamily:'Georgia,serif', fontSize:16, marginBottom:8, color:'#888' }}>The feed is quiet.</p>
          <p style={{ fontSize:13 }}>Be the first to yawp.</p>
        </div>
      ) : visiblePosts.map(post => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={user?.uid ?? ''}
          onHeart={toggleHeart}
          onEcho={toggleEcho}
          onBookmark={toggleBookmark}
          onDelete={deletePost}
          onMute={handleMute}
          onQuote={startQuote}
          onOpenThread={() => router.push(`/post/${post.id}`)}
          onOpenProfile={username => router.push(`/profile/${username}`)}
          onOpenTag={tag => router.push(`/tag/${encodeURIComponent(tag.replace('#', ''))}`)}
        />
      ))}
    </div>
  )
}

function PostCard({
  post, currentUserId, onHeart, onEcho, onBookmark, onDelete, onMute, onQuote,
  onOpenThread, onOpenProfile, onOpenTag,
}: {
  post: Post
  currentUserId: string
  onHeart: (p: Post) => void
  onEcho: (p: Post) => void
  onBookmark: (p: Post) => void
  onDelete: (id: string) => void
  onMute: (userId: string) => void
  onQuote: (p: Post) => void
  onOpenThread: () => void
  onOpenProfile: (username: string) => void
  onOpenTag: (tag: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const username = post.profile?.username ?? 'unknown'
  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })
  const isOwner = post.userId === currentUserId
  const words = wordCount(post.content)
  const readTime = words >= 50 ? `${Math.ceil(words / 200)} min read` : null

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMenuOpen(false) }}
      style={{ background:'#141414', border:`1px solid ${hovered ? '#3A3A3A' : '#2A2A2A'}`, borderRadius:16, padding:'18px 20px', marginBottom:12, transition:'border-color 0.2s', position:'relative' }}
    >
      <div style={{ display:'flex', gap:12 }}>
        <button onClick={() => onOpenProfile(username)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, flexShrink:0 }}>
          <Avatar username={username} />
        </button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' }}>
            <button onClick={() => onOpenProfile(username)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'#F0F0F0', fontWeight:700, fontSize:14 }}>{post.profile?.displayName ?? username}</button>
            <button onClick={() => onOpenProfile(username)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'#555', fontSize:12, fontFamily:"'DM Mono',monospace" }}>@{username}</button>
            <span style={{ color:'#555', fontSize:12, marginLeft:'auto' }}>{timeAgo}</span>
            {readTime && <span style={{ color:'#444', fontSize:11, fontFamily:"'DM Mono',monospace" }}>{readTime}</span>}
            {post.editedAt && <span style={{ color:'#444', fontSize:11, fontFamily:"'DM Mono',monospace" }}>edited</span>}
          </div>

          <div onClick={onOpenThread} style={{ cursor:'pointer' }}>
            <RichText
              content={post.content}
              style={{ color:'#F0F0F0', fontSize:15, lineHeight:1.6, fontFamily:'Georgia,serif', display:'block', marginBottom: post.quotedPost || (post.tags?.length ?? 0) > 0 ? 10 : 12, wordBreak:'break-word' }}
            />
          </div>

          {/* Quoted post */}
          {post.quotedPost && <QuoteCard post={post.quotedPost} />}

          {/* Tags */}
          {(post.tags?.length ?? 0) > 0 && (
            <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap', marginTop: post.quotedPost ? 10 : 0 }}>
              {post.tags.map(tag => (
                <span key={tag} onClick={() => onOpenTag(tag)}
                  style={{ background:'#1E1E1E', color:'#E8FF47', fontSize:11, padding:'2px 8px', borderRadius:20, fontFamily:"'DM Mono',monospace", cursor:'pointer' }}>{tag}</span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ display:'flex', gap:20, alignItems:'center' }}>
            <button onClick={() => onHeart(post)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:5, color: post.hearted ? '#FF6B6B' : '#555', fontSize:13, transition:'color 0.15s' }}>
              <span style={{ fontSize:16 }}>{post.hearted ? '♥' : '♡'}</span>
              <span style={{ fontFamily:"'DM Mono',monospace" }}>{post.heartCount}</span>
            </button>
            <button onClick={onOpenThread} style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:5, color:'#555', fontSize:13, transition:'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#F0F0F0')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>
              <span style={{ fontSize:15 }}>◎</span>
              <span style={{ fontFamily:"'DM Mono',monospace" }}>{post.replyCount}</span>
            </button>
            <button onClick={() => onEcho(post)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:5, color: post.echoed ? '#47FFB2' : '#555', fontSize:13, transition:'color 0.15s' }}>
              <span style={{ fontSize:14 }}>↺</span>
              <span style={{ fontFamily:"'DM Mono',monospace" }}>{post.echoCount}</span>
            </button>
            {/* Quote button */}
            <button
              onClick={() => onQuote(post)}
              title="Amplify with your voice"
              style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:4, color:'#555', fontSize:13, transition:'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#E8FF47')}
              onMouseLeave={e => (e.currentTarget.style.color = '#555')}
            >
              <span style={{ fontSize:14 }}>❝</span>
            </button>
            <button onClick={() => onBookmark(post)} title={post.bookmarked ? 'Remove bookmark' : 'Save'}
              style={{ background:'none', border:'none', cursor:'pointer', padding:0, color: post.bookmarked ? '#E8FF47' : '#555', fontSize:14, transition:'color 0.15s', marginLeft:'auto' }}>
              {post.bookmarked ? '★' : '☆'}
            </button>
          </div>
        </div>
      </div>

      {/* Owner actions + mute menu */}
      {hovered && (
        <div style={{ position:'absolute', top:14, right:14, display:'flex', gap:6, alignItems:'center' }}>
          {isOwner && (
            <button onClick={() => onDelete(post.id)}
              style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:13, padding:'2px 6px', borderRadius:6, transition:'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#FF6B6B')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>✕</button>
          )}
          {!isOwner && (
            <div style={{ position:'relative' }}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                style={{ background:'none', border:'none', color:'#444', cursor:'pointer', fontSize:16, padding:'2px 6px', borderRadius:6, lineHeight:1 }}
                title="More options"
              >⋯</button>
              {menuOpen && (
                <div style={{ position:'absolute', right:0, top:'100%', background:'#1A1A1A', border:'1px solid #2A2A2A', borderRadius:10, padding:'4px 0', zIndex:20, minWidth:140, boxShadow:'0 4px 20px rgba(0,0,0,0.5)' }}>
                  <button
                    onClick={() => { onMute(post.userId); setMenuOpen(false) }}
                    style={{ display:'block', width:'100%', textAlign:'left', background:'none', border:'none', color:'#888', fontSize:13, padding:'8px 14px', cursor:'pointer', fontFamily:"'DM Mono',monospace" }}
                    onMouseEnter={e => { e.currentTarget.style.background='#2A2A2A'; e.currentTarget.style.color='#F0F0F0' }}
                    onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='#888' }}
                  >
                    Mute @{username}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
