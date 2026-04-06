'use client'

import { SessionProvider } from 'next-auth/react'
import { AuthSync } from './AuthSync'

const isGuestMode = process.env.NEXT_PUBLIC_ALLOW_GUEST_MODE === 'true'

export function Providers({ children }: { children: React.ReactNode }) {
  if (isGuestMode) {
    return <>{children}</>
  }

  return (
    <SessionProvider>
      <AuthSync />
      {children}
    </SessionProvider>
  )
}
