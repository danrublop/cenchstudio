'use client'

/**
 * Cross-tab agent run synchronization via BroadcastChannel.
 *
 * Prevents two browser tabs from starting agent runs simultaneously
 * on the same project. The server-side `activeRuns` Map is the
 * authoritative lock, but this provides instant client-side UX feedback.
 */

import { useVideoStore } from './index'

const CHANNEL_NAME = 'cench-agent-sync'

// Unique per-tab identifier (stable for the tab's lifetime)
const tabId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36)

type SyncMessage =
  | { type: 'agent_start'; projectId: string; tabId: string }
  | { type: 'agent_end'; projectId: string; tabId: string }
  | { type: 'agent_query'; projectId: string; tabId: string }
  | { type: 'agent_status'; projectId: string; tabId: string; running: boolean }

let channel: BroadcastChannel | null = null
let currentProjectId: string | null = null

// Track which remote tabs are running
const remoteRunning = new Set<string>()

function updateStoreFromRemote() {
  useVideoStore.setState({ isAgentRunningRemote: remoteRunning.size > 0 })
}

function handleMessage(event: MessageEvent<SyncMessage>) {
  const msg = event.data
  if (!msg || !msg.type || msg.tabId === tabId) return // ignore own messages
  if (msg.projectId !== currentProjectId) return // different project

  switch (msg.type) {
    case 'agent_start':
      remoteRunning.add(msg.tabId)
      updateStoreFromRemote()
      break
    case 'agent_end':
      remoteRunning.delete(msg.tabId)
      updateStoreFromRemote()
      break
    case 'agent_query':
      // Another tab is asking if we're running — respond with our status
      if (useVideoStore.getState().isAgentRunning) {
        channel?.postMessage({
          type: 'agent_status',
          projectId: currentProjectId,
          tabId,
          running: true,
        } satisfies SyncMessage)
      }
      break
    case 'agent_status':
      if (msg.running) {
        remoteRunning.add(msg.tabId)
        updateStoreFromRemote()
      }
      break
  }
}

/**
 * Initialize cross-tab sync for the given project.
 * Returns a cleanup function to call on unmount.
 */
export function initTabSync(projectId: string): () => void {
  currentProjectId = projectId
  remoteRunning.clear()

  if (typeof BroadcastChannel === 'undefined') {
    // Graceful degradation — server-side 409 is the fallback
    return () => {}
  }

  // Close previous channel if project changed
  channel?.close()
  channel = new BroadcastChannel(CHANNEL_NAME)
  channel.onmessage = handleMessage

  // Query other tabs for running status
  channel.postMessage({
    type: 'agent_query',
    projectId,
    tabId,
  } satisfies SyncMessage)

  return () => {
    remoteRunning.clear()
    updateStoreFromRemote()
    channel?.close()
    channel = null
    currentProjectId = null
  }
}

/** Broadcast that this tab started an agent run. */
export function broadcastAgentStart(projectId: string) {
  channel?.postMessage({ type: 'agent_start', projectId, tabId } satisfies SyncMessage)
}

/** Broadcast that this tab finished an agent run. */
export function broadcastAgentEnd(projectId: string) {
  channel?.postMessage({ type: 'agent_end', projectId, tabId } satisfies SyncMessage)
}
