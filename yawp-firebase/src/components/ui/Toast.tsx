'use client'
import { useState, useEffect, useCallback, createContext, useContext } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId++
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2800)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{
        position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8,
        pointerEvents: 'none', alignItems: 'center',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.type === 'error' ? '#2A0A0A' : t.type === 'info' ? '#0A1A2A' : '#0A2A0A',
            border: `1px solid ${t.type === 'error' ? '#FF6B6B40' : t.type === 'info' ? '#47B0FF40' : '#47FFB240'}`,
            color: t.type === 'error' ? '#FF6B6B' : t.type === 'info' ? '#47B0FF' : '#47FFB2',
            padding: '10px 20px', borderRadius: 12, fontSize: 13,
            fontFamily: "'DM Mono', monospace", fontWeight: 500,
            animation: 'toastIn 0.3s ease-out',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}>
            {t.type === 'error' ? '✕ ' : t.type === 'info' ? '◎ ' : '✓ '}{t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
