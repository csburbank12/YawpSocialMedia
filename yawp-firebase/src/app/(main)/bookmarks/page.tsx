'use client'
import { useState, useEffect } from 'react'
import { collection, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore'
import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/AuthContext'
import { Post } from '@/types'
import Avatar from '@/components/ui/Avatar'
import { useToast } from '@/components/ui/Toast'

function BookmarksSkeleton() {
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
              <div style={{ height: 14, width: '85%', marginBottom: 8 }} className="skeleton" />
              <div style={{ height: 14, width: '55%' }} className="skeleton" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function BookmarksPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    if (!user) return
    const load = async () => {
      setLoading(true)
      try {
        const bookmarkSnap = await getDocs(collection(db, 'bookmarks', user.uid, 'posts'))
        const postDocs: { post: Post; savedAt: number }[] = []
        for (const b of bookmarkSnap.docs) {
          const postSnap = await getDoc(doc(db, 'posts', b.id))
          if (!postSnap.exists()) continue
          const data = postSnap.data()
          const profileSnap = await getDoc(doc(db, 'profiles', data.userId))
          const savedAt = b.data().savedAt ?? 0
          postDocs.push({
            savedAt,
            post: {
              id: postSnap.id, ...data,
              profile: profileSnap.exists() ? { id: profileSnap.id, ...profileSnap.data() } as any : null,
              bookmarked: true,
            } as Post,
          })
        }
        // Sort by bookmark time descending (most recent first)
        postDocs.sort((a, b) => b.savedAt - a.savedAt)
        setPosts(postDocs.map(d => d.post))
      } catch {
        toast('Failed to load bookmarks', 'error')
      }
      setLoading(false)
    }
    load()
  }, [user])

  const removeBookmark = async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await deleteDoc(doc(db, 'bookmarks', user!.uid, 'posts', postId))
      setPosts(prev => prev.filter(p => p.id !== postId))
      toast('Bookmark removed')
    } catch {
      toast('Failed to remove bookmark', 'error')
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: '#F0F0F0', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Bookmarks</h2>
        <p style={{ color: '#888', fontSize: 13, fontFamily: 'Georgia,serif' }}>Yawps you saved for later.</p>
      </div>

      {loading ? <BookmarksSkeleton /> : posts.length === 0 ? (
        <div className="animate-fade-in" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ fontSize: 28, marginBottom: 12 }}>★</p>
          <p style={{ fontFamily: 'Georgia,serif', fontSize: 16, color: '#888', marginBottom: 6 }}>No saved yawps yet.</p>
          <p style={{ color: '#555', fontSize: 13, marginBottom: 24 }}>Tap the bookmark icon on any yawp to save it here.</p>
          <button onClick={() => router.push('/feed')} style={{ background: '#E8FF47', border: 'none', borderRadius: 20, padding: '9px 22px', color: '#0D0D0D', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Back to feed →
          </button>
        </div>
      ) : posts.map((post, i) => {
        const username = post.profile?.username ?? 'unknown'
        return (
          <div key={post.id} className="animate-fade-in-up" onClick={() => router.push(`/post/${post.id}`)}
            style={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 16, padding: '18px 20px', marginBottom: 12, cursor: 'pointer', position: 'relative', transition: 'border-color 0.2s', animationDelay: `${i * 0.05}s` }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#3A3A3A'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#2A2A2A'}>
            <div style={{ display: 'flex', gap: 12 }}>
              <Avatar username={username} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ color: '#F0F0F0', fontWeight: 700, fontSize: 14 }}>{post.profile?.displayName ?? username}</span>
                  <span style={{ color: '#555', fontSize: 12, fontFamily: "'DM Mono',monospace" }}>@{username}</span>
                  <span style={{ color: '#555', fontSize: 12, marginLeft: 'auto' }}>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
                </div>
                <p style={{ color: '#F0F0F0', fontSize: 15, lineHeight: 1.6, margin: '0 0 10px', fontFamily: 'Georgia,serif', wordBreak: 'break-word' }}>{post.content}</p>
                {post.tags?.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {post.tags.map(tag => <span key={tag} style={{ background: '#1E1E1E', color: '#E8FF47', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontFamily: "'DM Mono',monospace" }}>{tag}</span>)}
                  </div>
                )}
              </div>
            </div>
            <button onClick={e => removeBookmark(post.id, e)}
              title="Remove bookmark"
              style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: '#E8FF47', fontSize: 16, padding: '2px 4px', lineHeight: 1 }}>
              ★
            </button>
          </div>
        )
      })}
    </div>
  )
}
