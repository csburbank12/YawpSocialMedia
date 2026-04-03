'use client'
import { useRouter } from 'next/navigation'
import { Post } from '@/types'
import Avatar from './Avatar'
import RichText from './RichText'
import { formatDistanceToNow } from 'date-fns'
import { toMs } from '@/lib/utils'

interface Props {
  post: Post
}

/**
 * Renders a quoted post in a nested card — used inside posts that quote another post.
 */
export default function QuoteCard({ post }: Props) {
  const router = useRouter()
  const username = post.profile?.username ?? 'unknown'

  return (
    <div
      onClick={e => { e.stopPropagation(); router.push(`/post/${post.id}`) }}
      style={{
        border:'1px solid #2A2A2A',
        borderRadius:12,
        padding:'12px 14px',
        marginTop:10,
        marginBottom:4,
        cursor:'pointer',
        transition:'border-color 0.15s',
        background:'#0D0D0D',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#3A3A3A')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#2A2A2A')}
    >
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
        <Avatar username={username} size={20} />
        <span
          onClick={e => { e.stopPropagation(); router.push(`/profile/${username}`) }}
          style={{ color:'#F0F0F0', fontWeight:700, fontSize:13, cursor:'pointer' }}
        >
          {post.profile?.displayName ?? username}
        </span>
        <span style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace" }}>@{username}</span>
        <span style={{ color:'#444', fontSize:11, marginLeft:'auto' }}>
          {formatDistanceToNow(new Date(toMs(post.createdAt)), { addSuffix: true })}
        </span>
      </div>
      <RichText
        content={post.content ? (post.content.length > 200 ? post.content.slice(0, 200) + '…' : post.content) : ''}
        style={{ color:'#AAA', fontSize:13, fontFamily:'Georgia,serif', lineHeight:1.55 }}
      />
    </div>
  )
}
