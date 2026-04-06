'use client'

import { useState, useEffect } from 'react'
import Editor from '@/components/Editor'
import { useVideoStore } from '@/lib/store'

export default function Home() {
  const [view, setView] = useState<'loading' | 'welcome' | 'editor'>('loading')

  useEffect(() => {
    // Wait for Zustand to rehydrate from persisted storage
    const unsub = useVideoStore.persist.onFinishHydration(() => {
      const projectId = useVideoStore.getState().project?.id
      setView(projectId ? 'editor' : 'welcome')
    })
    // If already hydrated (e.g. sync storage), check immediately
    if (useVideoStore.persist.hasHydrated()) {
      const projectId = useVideoStore.getState().project?.id
      setView(projectId ? 'editor' : 'welcome')
    }
    return unsub
  }, [])

  if (view === 'loading') return null
  return (
    <Editor
      showWelcome={view === 'welcome'}
      onEnterEditor={() => setView('editor')}
    />
  )
}
