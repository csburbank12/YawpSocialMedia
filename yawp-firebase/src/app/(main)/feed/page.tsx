'use client'
import { useState, useEffect, useRef } from 'react'
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, doc, setDoc, deleteDoc, getDoc, increment, updateDoc, getDocs, where
} from 'firebase/firestore'
import { formatDistanceToNow } from 'date-fns'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/AuthContext'
import { Post } from '@/types'
import Avatar from '@/components/ui/Avatar'
import { useToast } from '@/components/ui/Toast'
import { useRouter } from 'next/navigation'

function CharRing({ remaining, max }: { remaining: number; max: number }) {
  const r = 10, c = 2 * Math.PI * r
  const pct = Math.max(0, remaining) / max
  const stroke = remaining < 20 ? '#FF6B6B' : remaining < 40 ? '#FF8C47' : '#3A3A3A'
  const fill = remaining < 20 ? '#FF6B6B' : remaining < 40 ? '#FF8C47' : '#E8FF47'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <svg width={26} height={26} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={13} cy={13} r={r} fill="none" stroke="#2A2A2A" strokeWidth={2.5} />
        <circle cx={13} cy={13} r={r} fill="none" stroke={fill} strokeWidth={2.5}
          strokeDasharray={c} strokeDashoffset={c * pct}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.2s, stroke 0.2s' }} />
      </svg>
      {remaining < 40 && (
        <span style={{ color: stroke, fontSize: 11, fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>{remaining}</span>
      )}
    </div>
  )
}

function renderContentWithHashtags(content: string, onOpenTag: (tag: string) => void) {
  const parts = content.split(/(#\w+)/g)
  return parts.map((part, i) => {
    if (part.startsWith('#')) {
      return (
        <span key={i} onClick={e => { e.stopPropagation(); onOpenTag(part) }}
          style={{ color: '#E8FF47', cursor: 'pointer', fontWeight: 600 }}>{part}</span>
      )
    }
    return part
  })
}

function FeedSkeleton() {
  return (
    <div>
      {[1, 2, 3].map(i => (
        <div key={i} className="animate-fade-in" style={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 16, padding: '18px 20px', marginBottom: 12, animationDelay: `${i * 0.1}s` }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%' }} className="skeleton" />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ height: 14, width: 100 }} className="skeleton" />
                <div style={{ height: 14, width: 70 }} className="skeleton" />
              </div>
              <div style={{ height: 14, width: '90%', marginBottom: 8 }} className="skeleton" />
              <div style={{ height: 14, width: '60%', marginBottom: 16 }} className="skeleton" />
              <div style={{ display: 'flex', gap: 20 }}>
                <div style={{ height: 14, width: 40 }} className="skeleton" />
                <div style={{ height: 14, width: 40 }} className="skeleton" />
                <div style={{ height: 14, width: 40 }} className="skeleton" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function FeedPage() {
  const { user, profile } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [focused, setFocused] = useState(false)
  const [feedMode, setFeedMode] = useState<'everyone' | 'following'>('everyone')
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load following list for feed filter
  useEffect(() => {
    if (!user) return
    const loadFollowing = async () => {
      const snap = await getDocs(collection(db, 'profiles', user.uid, 'following'))
      setFollowingIds(new Set(snap.docs.map(d => d.id)))
    }
    loadFollowing()
  }, [user])

  useEffect(() => {
    if (!user) return
    setLoading(true)
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
      setLoading(false)
    })
    return unsub
  }, [user])

  const handlePost = async () => {
    if (!content.trim() || posting || !user || !profile) return
    setPosting(true)
    try {
      const tags = Array.from(new Set((content.match(/#\w+/g) || []).map(t => t.toLowerCase())))
      await addDoc(collection(db, 'posts'), {
        userId: user.uid, content: content.trim(), tags,
        heartCount: 0, echoCount: 0, replyCount: 0, createdAt: Date.now(),
      })
      setContent('')
      toast('Yawp posted!')
    } catch {
      toast('Failed to post. Try again.', 'error')
    }
    setPosting(false)
  }

  const toggleHeart = async (post: Post) => {
    if (!user) return
    const heartRef = doc(db, 'posts', post.id, 'hearts', user.uid)
    const postRef = doc(db, 'posts', post.id)
    try {
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
    } catch {
      toast('Action failed. Try again.', 'error')
    }
  }

  const toggleEcho = async (post: Post) => {
    if (!user) return
    const echoRef = doc(db, 'posts', post.id, 'echoes', user.uid)
    const postRef = doc(db, 'posts', post.id)
    try {
      if (post.echoed) {
        await deleteDoc(echoRef)
        await updateDoc(postRef, { echoCount: increment(-1) })
      } else {
        await setDoc(echoRef, { userId: user.uid, createdAt: Date.now() })
        await updateDoc(postRef, { echoCount: increment(1) })
        toast('Echoed!')
      }
    } catch {
      toast('Action failed. Try again.', 'error')
    }
  }

  const toggleBookmark = async (post: Post) => {
    if (!user) return
    const ref = doc(db, 'bookmarks', user.uid, 'posts', post.id)
    try {
      if (post.bookmarked) {
        await deleteDoc(ref)
        toast('Bookmark removed')
      } else {
        await setDoc(ref, { postId: post.id, savedAt: Date.now() })
        toast('Saved to bookmarks')
      }
    } catch {
      toast('Action failed. Try again.', 'error')
    }
  }

  const deletePost = async (postId: string) => {
    if (!confirm('Delete this yawp?')) return
    try {
      await deleteDoc(doc(db, 'posts', postId))
      toast('Yawp deleted')
    } catch {
      toast('Failed to delete. Try again.', 'error')
    }
  }

  const sharePost = async (postId: string) => {
    const url = `${window.location.origin}/post/${postId}`
    try {
      await navigator.clipboard.writeText(url)
      toast('Link copied!')
    } catch {
      toast('Could not copy link', 'error')
    }
  }

  const remaining = 280 - content.length
  const hasPosted = posts.some(p => p.userId === user?.uid)

  const filteredPosts = feedMode === 'following'
    ? posts.filter(p => followingIds.has(p.userId) || p.userId === user?.uid)
    : posts

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      {/* First-time welcome nudge */}
      {!hasPosted && posts.length > 0 && profile && !profile.bio && (
        <div className="animate-fade-in-up" style={{ background: '#0D1A0D', border: '1px solid #1A3A1A', borderRadius: 14, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#47FFB2', fontSize: 18, flexShrink: 0 }}>⬡</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#47FFB2', fontWeight: 600, fontSize: 13, marginBottom: 2 }}>Welcome to Yawp.</div>
            <div style={{ color: '#888', fontSize: 12, fontFamily: 'Georgia,serif' }}>
              Sound your first yawp below — or{' '}
              <span onClick={() => router.push('/profile')} style={{ color: '#E8FF47', cursor: 'pointer' }}>fill in your profile first</span>.
            </div>
          </div>
        </div>
      )}

      {/* Composer */}
      <div style={{ background: '#141414', border: `1px solid ${focused ? '#3A3A3A' : '#2A2A2A'}`, borderRadius: 16, padding: '16px 20px', marginBottom: 20, transition: 'border-color 0.2s' }}>
        <textarea ref={textareaRef} value={content} onChange={e => setContent(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handlePost() } }}
          placeholder="What's your yawp today?" maxLength={280} rows={focused || content ? 3 : 1}
          style={{ width: '100%', background: 'none', border: 'none', outline: 'none', color: '#F0F0F0', fontSize: 15, resize: 'none', fontFamily: 'Georgia,serif', lineHeight: 1.6 }} />
        {(focused || content) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid #2A2A2A' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CharRing remaining={remaining} max={280} />
              <span style={{ color: '#555', fontSize: 10, fontFamily: "'DM Mono',monospace" }}>
                {navigator?.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+Enter
              </span>
            </div>
            <button onClick={handlePost} disabled={!content.trim() || posting} style={{ background: content.trim() ? '#E8FF47' : '#2A2A2A', border: 'none', borderRadius: 20, padding: '7px 18px', color: content.trim() ? '#0D0D0D' : '#555', fontWeight: 700, fontSize: 13, cursor: content.trim() ? 'pointer' : 'default', transition: 'all 0.15s' }}>
              {posting ? '...' : 'Yawp'}
            </button>
          </div>
        )}
      </div>

      {/* Feed toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#141414', borderRadius: 10, padding: 3, border: '1px solid #2A2A2A' }}>
        {(['everyone', 'following'] as const).map(mode => (
          <button key={mode} onClick={() => setFeedMode(mode)}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: feedMode === mode ? '#E8FF4720' : 'transparent',
              color: feedMode === mode ? '#E8FF47' : '#555',
              fontSize: 12, fontFamily: "'DM Mono',monospace", fontWeight: 600,
              transition: 'all 0.15s', letterSpacing: '0.04em',
            }}>
            {mode === 'everyone' ? 'EVERYONE' : 'FOLLOWING'}
          </button>
        ))}
      </div>

      {/* Feed */}
      {loading ? <FeedSkeleton /> : filteredPosts.length === 0 ? (
        <div className="animate-fade-in" style={{ textAlign: 'center', padding: '60px 20px', color: '#555' }}>
          <p style={{ fontSize: 28, marginBottom: 12 }}>⬡</p>
          <p style={{ fontFamily: 'Georgia,serif', fontSize: 16, marginBottom: 8, color: '#888' }}>
            {feedMode === 'following' ? 'Nothing from people you follow yet.' : 'The feed is quiet.'}
          </p>
          <p style={{ fontSize: 13 }}>
            {feedMode === 'following' ? 'Follow people from the Discover page, or switch to Everyone.' : 'Be the first to yawp.'}
          </p>
        </div>
      ) : filteredPosts.map((post, i) => (
        <PostCard key={post.id} post={post} currentUserId={user?.uid ?? ''}
          onHeart={toggleHeart} onEcho={toggleEcho}
          onBookmark={toggleBookmark} onDelete={deletePost}
          onShare={sharePost}
          onOpenThread={() => router.push(`/post/${post.id}`)}
          onOpenProfile={username => router.push(`/profile/${username}`)}
          onOpenTag={tag => router.push(`/tag/${encodeURIComponent(tag.replace('#', ''))}`)}
          index={i}
        />
      ))}
    </div>
  )
}

function PostCard({ post, currentUserId, onHeart, onEcho, onBookmark, onDelete, onShare, onOpenThread, onOpenProfile, onOpenTag, index }: {
  post: Post; currentUserId: string
  onHeart: (p: Post) => void; onEcho: (p: Post) => void
  onBookmark: (p: Post) => void; onDelete: (id: string) => void
  onShare: (id: string) => void
  onOpenThread: () => void
  onOpenProfile: (username: string) => void
  onOpenTag: (tag: string) => void
  index: number
}) {
  const [hovered, setHovered] = useState(false)
  const [heartAnim, setHeartAnim] = useState(false)
  const username = post.profile?.username ?? 'unknown'
  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })
  const isOwner = post.userId === currentUserId

  const handleHeart = () => {
    if (!post.hearted) {
      setHeartAnim(true)
      setTimeout(() => setHeartAnim(false), 400)
    }
    onHeart(post)
  }

  return (
    <div className="animate-fade-in-up" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background: '#141414', border: `1px solid ${hovered ? '#3A3A3A' : '#2A2A2A'}`, borderRadius: 16, padding: '18px 20px', marginBottom: 12, transition: 'border-color 0.2s', position: 'relative', animationDelay: `${Math.min(index * 0.05, 0.3)}s` }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => onOpenProfile(username)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
          <Avatar username={username} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <button onClick={() => onOpenProfile(username)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#F0F0F0', fontWeight: 700, fontSize: 14 }}>{post.profile?.displayName ?? username}</button>
            <button onClick={() => onOpenProfile(username)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#555', fontSize: 12, fontFamily: "'DM Mono',monospace" }}>@{username}</button>
            <span style={{ color: '#555', fontSize: 12, marginLeft: 'auto' }}>{timeAgo}</span>
          </div>
          <p onClick={onOpenThread} style={{ color: '#F0F0F0', fontSize: 15, lineHeight: 1.6, margin: '0 0 12px', fontFamily: 'Georgia,serif', wordBreak: 'break-word', cursor: 'pointer' }}>
            {renderContentWithHashtags(post.content, onOpenTag)}
          </p>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <button onClick={handleHeart} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 5, color: post.hearted ? '#FF6B6B' : '#555', fontSize: 13, transition: 'color 0.15s' }}>
              <span className={heartAnim ? 'animate-heart' : ''} style={{ fontSize: 16 }}>{post.hearted ? '♥' : '♡'}</span>
              <span style={{ fontFamily: "'DM Mono',monospace" }}>{post.heartCount}</span>
            </button>
            <button onClick={onOpenThread} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 5, color: '#555', fontSize: 13, transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#F0F0F0')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>
              <span style={{ fontSize: 15 }}>◎</span>
              <span style={{ fontFamily: "'DM Mono',monospace" }}>{post.replyCount}</span>
            </button>
            <button onClick={() => onEcho(post)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 5, color: post.echoed ? '#47FFB2' : '#555', fontSize: 13, transition: 'color 0.15s' }}>
              <span style={{ fontSize: 14 }}>↺</span>
              <span style={{ fontFamily: "'DM Mono',monospace" }}>{post.echoCount}</span>
            </button>
            <button onClick={e => { e.stopPropagation(); onShare(post.id) }} title="Copy link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#555', fontSize: 13, transition: 'color 0.15s', marginLeft: 4 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#F0F0F0')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>
              ↗
            </button>
            <button onClick={() => onBookmark(post)} title={post.bookmarked ? 'Remove bookmark' : 'Save'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: post.bookmarked ? '#E8FF47' : '#555', fontSize: 14, transition: 'color 0.15s', marginLeft: 'auto' }}>
              {post.bookmarked ? '★' : '☆'}
            </button>
          </div>
        </div>
      </div>
      {isOwner && hovered && (
        <button onClick={() => onDelete(post.id)}
          style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 13, padding: '2px 6px', borderRadius: 6, transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#FF6B6B')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>✕</button>
      )}
    </div>
  )
}
