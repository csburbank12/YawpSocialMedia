'use client'
import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, getDocs, doc, getDoc, setDoc, deleteDoc, increment, updateDoc } from 'firebase/firestore'
import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/AuthContext'
import { Post } from '@/types'
import Avatar from '@/components/ui/Avatar'
import { useToast } from '@/components/ui/Toast'

export default function TagPage({ params }: { params: { name: string } }) {
  const { user, profile } = useAuth()
  const router = useRouter()
  const tag = `#${decodeURIComponent(params.name).toLowerCase().replace(/^#/, '')}`
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    if (!user) return
    const load = async () => {
      setLoading(true)
      try {
        const snap = await getDocs(
          query(collection(db, 'posts'), where('tags', 'array-contains', tag), orderBy('createdAt', 'desc'))
        )
        const postsData: Post[] = []
        for (const d of snap.docs) {
          const data = d.data()
          const profileSnap = await getDoc(doc(db, 'profiles', data.userId))
          const heartSnap = await getDoc(doc(db, 'posts', d.id, 'hearts', user.uid))
          postsData.push({
            id: d.id, ...data,
            profile: profileSnap.exists() ? { id: profileSnap.id, ...profileSnap.data() } as any : null,
            hearted: heartSnap.exists(),
          } as Post)
        }
        setPosts(postsData)
      } catch {
        toast('Failed to load posts', 'error')
      }
      setLoading(false)
    }
    load()
  }, [user, tag])

  const toggleHeart = async (post: Post) => {
    if (!user) return
    const heartRef = doc(db, 'posts', post.id, 'hearts', user.uid)
    const postRef = doc(db, 'posts', post.id)
    try {
      if (post.hearted) {
        await deleteDoc(heartRef)
        await updateDoc(postRef, { heartCount: increment(-1) })
        setPosts(prev => prev.map(p => p.id === post.id ? { ...p, hearted: false, heartCount: p.heartCount - 1 } : p))
      } else {
        await setDoc(heartRef, { userId: user.uid, createdAt: Date.now() })
        await updateDoc(postRef, { heartCount: increment(1) })
        setPosts(prev => prev.map(p => p.id === post.id ? { ...p, hearted: true, heartCount: p.heartCount + 1 } : p))
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

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 14, padding: 0 }}>←</button>
        <div>
          <h2 style={{ color: '#E8FF47', fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 20, marginBottom: 2 }}>{tag}</h2>
          {!loading && <p style={{ color: '#555', fontSize: 12, fontFamily: "'DM Mono',monospace" }}>{posts.length} yawp{posts.length !== 1 ? 's' : ''}</p>}
        </div>
      </div>

      {loading ? (
        <div>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 16, padding: '18px 20px', marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%' }} className="skeleton" />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 14, width: 120, marginBottom: 12 }} className="skeleton" />
                  <div style={{ height: 14, width: '80%', marginBottom: 8 }} className="skeleton" />
                  <div style={{ height: 14, width: '50%' }} className="skeleton" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="animate-fade-in" style={{ textAlign: 'center', color: '#555', padding: '60px 20px' }}>
          <p style={{ fontFamily: 'Georgia,serif', fontSize: 15, color: '#888', marginBottom: 6 }}>No yawps with {tag} yet.</p>
          <p style={{ fontSize: 13 }}>Be the first.</p>
        </div>
      ) : posts.map((post, i) => {
        const username = post.profile?.username ?? 'unknown'
        return (
          <div key={post.id} className="animate-fade-in-up"
            style={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 16, padding: '18px 20px', marginBottom: 12, transition: 'border-color 0.2s', animationDelay: `${Math.min(i * 0.05, 0.3)}s` }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#3A3A3A'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#2A2A2A'}>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => router.push(`/profile/${username}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                <Avatar username={username} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => router.push(`/profile/${username}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#F0F0F0', fontWeight: 700, fontSize: 14 }}>{post.profile?.displayName ?? username}</button>
                  <span style={{ color: '#555', fontSize: 12, fontFamily: "'DM Mono',monospace" }}>@{username}</span>
                  <span style={{ color: '#555', fontSize: 12, marginLeft: 'auto' }}>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
                </div>
                <p onClick={() => router.push(`/post/${post.id}`)} style={{ color: '#F0F0F0', fontSize: 15, lineHeight: 1.6, margin: '0 0 12px', fontFamily: 'Georgia,serif', wordBreak: 'break-word', cursor: 'pointer' }}>{post.content}</p>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                  {post.tags?.map(t => (
                    <span key={t} onClick={() => router.push(`/tag/${encodeURIComponent(t.replace('#', ''))}`)}
                      style={{ background: t === tag ? '#E8FF4722' : '#1E1E1E', color: '#E8FF47', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontFamily: "'DM Mono',monospace", cursor: 'pointer',
                               border: t === tag ? '1px solid #E8FF4755' : '1px solid transparent' }}>{t}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 20 }}>
                  <button onClick={() => toggleHeart(post)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 5, color: post.hearted ? '#FF6B6B' : '#555', fontSize: 13, transition: 'color 0.15s' }}>
                    <span style={{ fontSize: 16 }}>{post.hearted ? '♥' : '♡'}</span>
                    <span style={{ fontFamily: "'DM Mono',monospace" }}>{post.heartCount}</span>
                  </button>
                  <button onClick={() => router.push(`/post/${post.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 5, color: '#555', fontSize: 13 }}>
                    <span style={{ fontSize: 15 }}>◎</span>
                    <span style={{ fontFamily: "'DM Mono',monospace" }}>{post.replyCount}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
