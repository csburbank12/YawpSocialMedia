// Colors with their appropriate text color (dark for bright/light backgrounds)
const PALETTE: { bg: string; text: string }[] = [
  { bg: '#7C4DFF', text: '#fff' },   // purple
  { bg: '#00BCD4', text: '#fff' },   // cyan
  { bg: '#FF6B6B', text: '#fff' },   // salmon
  { bg: '#FF9800', text: '#0D0D0D' },// orange  (bright — use dark text)
  { bg: '#47FFB2', text: '#0D0D0D' },// mint    (very bright — use dark text)
  { bg: '#E8FF47', text: '#0D0D0D' },// yellow  (very bright — use dark text)
  { bg: '#FF4081', text: '#fff' },   // pink
]

function paletteFromString(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

export default function Avatar({ username, size = 38 }: { username: string; size?: number }) {
  const { bg, text } = paletteFromString(username)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, color: text,
      fontFamily: "'DM Mono',monospace", flexShrink: 0, userSelect: 'none',
    }}>
      {username[0]?.toUpperCase() ?? '?'}
    </div>
  )
}
