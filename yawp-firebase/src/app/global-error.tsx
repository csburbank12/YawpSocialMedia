'use client'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: '#0D0D0D', margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ background: '#E8FF47', color: '#0D0D0D', fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 18, padding: '5px 14px', borderRadius: 8, display: 'inline-block', marginBottom: 24 }}>YAWP</div>
          <h2 style={{ color: '#F0F0F0', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: '#888', fontSize: 14, fontFamily: 'Georgia,serif', lineHeight: 1.6, marginBottom: 24 }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              background: '#E8FF47', border: 'none', borderRadius: 20,
              padding: '10px 24px', color: '#0D0D0D', fontWeight: 700,
              fontSize: 14, cursor: 'pointer', marginRight: 8,
            }}
          >
            Try again
          </button>
          <button
            onClick={() => { window.location.href = '/' }}
            style={{
              background: 'none', border: '1px solid #2A2A2A', borderRadius: 20,
              padding: '10px 24px', color: '#888', fontWeight: 600,
              fontSize: 14, cursor: 'pointer',
            }}
          >
            Go home
          </button>
          <p style={{ color: '#333', fontSize: 11, fontFamily: "'DM Mono',monospace", marginTop: 16 }}>
            {error?.message || 'Unknown error'}
          </p>
        </div>
      </body>
    </html>
  )
}
