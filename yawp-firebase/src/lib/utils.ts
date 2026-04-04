import { formatDistanceToNow } from 'date-fns'

/**
 * Safely converts any Firestore value to a JavaScript Date.
 * Handles: Firestore Timestamp objects, plain numbers (ms), Date objects,
 * and falls back to epoch 0 for anything else.
 */
export function toDate(val: any): Date {
  if (!val) return new Date(0)
  if (val instanceof Date) return val
  if (typeof val === 'number') return new Date(val)
  // Firestore Timestamp has a toDate() method
  if (typeof val?.toDate === 'function') return val.toDate()
  // Firestore Timestamp also has seconds/nanoseconds
  if (typeof val?.seconds === 'number') return new Date(val.seconds * 1000)
  return new Date(0)
}

/**
 * Safe wrapper around formatDistanceToNow that never throws.
 * Returns "just now" if the date is invalid.
 */
export function safeTimeAgo(val: any): string {
  try {
    const d = toDate(val)
    if (isNaN(d.getTime())) return 'just now'
    return formatDistanceToNow(d, { addSuffix: true })
  } catch {
    return 'just now'
  }
}
