'use client'

import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'sonner'
import { AuthSync } from './AuthSync'

const isGuestMode = process.env.NEXT_PUBLIC_ALLOW_GUEST_MODE === 'true'

function AppToaster() {
  return (
    <Toaster
      position="bottom-right"
      theme="dark"
      toastOptions={{
        style: {
          background: 'rgba(20,20,20,0.95)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.92)',
        },
      }}
    />
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  if (isGuestMode) {
    return (
      <>
        {children}
        <AppToaster />
      </>
    )
  }

  return (
    <SessionProvider>
      <AuthSync />
      {children}
      <AppToaster />
    </SessionProvider>
  )
}
