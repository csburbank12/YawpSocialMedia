import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/AuthContext'
import { ToastProvider } from '@/components/ui/Toast'

export const metadata: Metadata = {
  title: 'Yawp — Sound your barbaric yawp',
  description: 'A text-first, algorithm-free social network built for humans.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
