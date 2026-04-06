'use client'

import { useSession } from 'next-auth/react'
import { useEffect } from 'react'
import { useVideoStore } from '@/lib/store'

/** Syncs the Auth.js session user into the Zustand store. */
export function AuthSync() {
  const { data: session } = useSession()
  const setCurrentUser = useVideoStore((s) => s.setCurrentUser)

  const userId = session?.user?.id
  const userEmail = session?.user?.email
  const userName = session?.user?.name
  const userImage = session?.user?.image

  useEffect(() => {
    if (userId && userEmail) {
      setCurrentUser({
        id: userId,
        email: userEmail,
        name: userName ?? null,
        image: userImage ?? null,
      })
    } else {
      setCurrentUser(null)
    }
  }, [userId, userEmail, userName, userImage, setCurrentUser])

  return null
}
