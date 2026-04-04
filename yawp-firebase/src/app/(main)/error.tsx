'use client'

export default function MainError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 16 }}>&#x2B21;</div>
      <h2 style={{ color: '#F0F0F0', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h2>
      <p style={{ color: '#888', fontSize: 14, fontFamily: 'Georgia,serif', lineHeight: 1.6, marginBottom: 24 }}>
        An unexpected error occurred. This usually resolves on retry.
      </p>
      <button
        onClick={reset}
        style={{
          background: '#E8FF47', border: 'none', borderRadius: 20,
          padding: '10px 24px', color: '#0D0D0D', fontWeight: 700,
          fontSize: 14, cursor: 'pointer',
        }}
      >
        Try again
      </button>
      <p style={{ color: '#333', fontSize: 11, fontFamily: "'DM Mono',monospace", marginTop: 16 }}>
        {error?.message || 'Unknown error'}
      </p>
    </div>
  )
}
