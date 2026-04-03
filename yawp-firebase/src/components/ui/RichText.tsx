'use client'
import { useRouter } from 'next/navigation'

interface Props {
  content: string
  style?: React.CSSProperties
}

/**
 * Renders post content with @mentions and #hashtags as clickable links.
 */
export default function RichText({ content, style }: Props) {
  const router = useRouter()

  if (!content) return <span style={style} />

  // Split on @mentions and #hashtags, keeping the delimiters
  const parts = content.split(/((?:^|\s)@[\w]+|(?:^|\s)#[\w]+)/g)

  return (
    <span style={style}>
      {parts.map((part, i) => {
        const trimmed = part.trimStart()
        const leading = part.slice(0, part.length - trimmed.length)

        if (trimmed.startsWith('@') && trimmed.length > 1) {
          const username = trimmed.slice(1)
          return (
            <span key={i}>
              {leading}
              <span
                onClick={e => { e.stopPropagation(); router.push(`/profile/${username}`) }}
                style={{ color:'#47FFB2', cursor:'pointer', fontWeight:600 }}
              >
                @{username}
              </span>
            </span>
          )
        }

        if (trimmed.startsWith('#') && trimmed.length > 1) {
          const tag = trimmed.slice(1)
          return (
            <span key={i}>
              {leading}
              <span
                onClick={e => { e.stopPropagation(); router.push(`/tag/${encodeURIComponent(tag)}`) }}
                style={{ color:'#E8FF47', cursor:'pointer' }}
              >
                #{tag}
              </span>
            </span>
          )
        }

        return <span key={i}>{part}</span>
      })}
    </span>
  )
}
