/**
 * Safely converts a Firestore Timestamp, number (ms), or any date-like value to milliseconds.
 * Firestore Timestamp objects have a toMillis() method; plain createdAt fields are stored
 * as number milliseconds. Both need to be handled to avoid RangeError in date-fns.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toMs(val: any): number {
  if (!val) return Date.now()
  if (typeof val === 'number') return val
  if (typeof val.toMillis === 'function') return val.toMillis()
  if (typeof val.toDate === 'function') return val.toDate().getTime()
  const n = Number(val)
  return isNaN(n) ? Date.now() : n
}
