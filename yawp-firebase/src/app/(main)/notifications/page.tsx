'use client'
import { useState, useEffect } from 'react'
import { collection, query, orderBy, getDocs, writeBatch, doc } from 'firebase/firestore'
import { safeTimeAgo } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/AuthContext'
import Avatar from '@/components/ui/Avatar'

interface NotificationItem {
  id: string
  type: 'heart' | 'follow' | 'reply'
  fromUserId: string
  fromUsername: string
  fromDisplayName: string
  postId?: string
  postContent?: string
  replyContent?: string
  createdAt: number
  read: boolean
}

const TYPE_ICON: Record<string, string> = {
  heart: '♥',
  follow: '＋',
  reply: '◎',
}
const TYPE_COLOR: Record<string, string> = {
  heart: '#FF6B6B',
  follow: '#47FFB2',
  reply: '#7C4DFF',
}
const TYPE_LABEL: Record<string, string> = {
  heart: 'hearted your yawp',
  follow: 'started following you',
  reply: 'replied to your yawp',
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        setLoading(true)
        const q = query(
          collection(db, 'notifications', user.uid, 'items'),
          orderBy('createdAt', 'desc')
        )
        const snap = await getDocs(q)
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as NotificationItem)))
        setLoading(false)

        // Mark all as read
        const unread = snap.docs.filter(d => !d.data().read)
        if (unread.length > 0) {
          const batch = writeBatch(db)
          unread.forEach(d => {
            batch.update(doc(db, 'notifications', user.uid, 'items', d.id), { read: true })
          })
          await batch.commit()
        }
      } catch (err) {
        console.error('Notifications load error:', err)
        setLoading(false)
      }
    }
    load()
  }, [user])

  return (
    <div style={{ maxWidth:640, margin:'0 auto', padding:'24px 16px' }}>
      <div style={{ marginBottom:24 }}>
        <h2 style={{ color:'#F0F0F0', fontSize:20, fontWeight:700, marginBottom:4 }}>Notifications</h2>
        <p style={{ color:'#888', fontSize:13, fontFamily:'Georgia,serif' }}>Activity on your account.</p>
      </div>

      {loading ? (
        <div style={{ color:'#555', textAlign:'center', padding:'40px 20px', fontSize:13 }}>Loading...</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 20px' }}>
          <p style={{ fontSize:28, marginBottom:12 }}>◎</p>
          <p style={{ fontFamily:'Georgia,serif', fontSize:16, color:'#888', marginBottom:6 }}>No notifications yet.</p>
          <p style={{ color:'#555', fontSize:13 }}>When someone hearts or replies to your yawp, it&apos;ll show up here.</p>
        </div>
      ) : items.map(item => (
        <div
          key={item.id}
          onClick={() => item.postId && router.push(`/post/${item.postId}`)}
          style={{
            background: item.read ? '#141414' : '#0D150D',
            border: `1px solid ${item.read ? '#2A2A2A' : '#1A3A1A'}`,
            borderRadius:14, padding:'14px 16px', marginBottom:10,
            cursor: item.postId ? 'pointer' : 'default',
            display:'flex', alignItems:'flex-start', gap:14,
            transition:'border-color 0.2s',
          }}
          onMouseEnter={e => { if (item.postId) e.currentTarget.style.borderColor = '#3A3A3A' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = item.read ? '#2A2A2A' : '#1A3A1A' }}
        >
          {/* Type icon */}
          <div style={{ width:36, height:36, borderRadius:'50%', background: TYPE_COLOR[item.type] + '22', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:16, color: TYPE_COLOR[item.type] }}>
            {TYPE_ICON[item.type]}
          </div>

          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <Avatar username={item.fromUsername} size={22} />
              <span style={{ color:'#F0F0F0', fontWeight:600, fontSize:13 }}>{item.fromDisplayName}</span>
              <span style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace" }}>@{item.fromUsername}</span>
              <span style={{ color:'#555', fontSize:11, marginLeft:'auto', flexShrink:0 }}>{safeTimeAgo(item.createdAt)}</span>
            </div>
            <p style={{ color:'#888', fontSize:13, fontFamily:'Georgia,serif', margin:0 }}>
              {TYPE_LABEL[item.type]}
              {item.postContent && (
                <span style={{ color:'#555', display:'block', marginTop:3, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  &quot;{item.postContent}{item.postContent.length >= 80 ? '…' : ''}&quot;
                </span>
              )}
              {item.replyContent && (
                <span style={{ color:'#888', display:'block', marginTop:2, fontSize:12, fontStyle:'italic' }}>
                  &quot;{item.replyContent}{item.replyContent.length >= 80 ? '…' : ''}&quot;
                </span>
              )}
            </p>
          </div>

          {!item.read && (
            <div style={{ width:8, height:8, borderRadius:'50%', background:'#47FFB2', flexShrink:0, marginTop:4 }} />
          )}
        </div>
      ))}
    </div>
  )
}
