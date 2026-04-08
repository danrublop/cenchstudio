/**
 * Tapback Tracker Plugin — SDK contribution for imessage-kit.
 *
 * Detects tapback/reaction messages using the SDK's built-in
 * Message.isReaction, Message.reactionType, and Message.isReactionRemoval fields.
 *
 * Use case: If user "loves" a video, the bot can remember that style preference.
 */

import { recordTapback } from '../conversation-store.js'

export interface TapbackEvent {
  type: 'tapback'
  sender: string
  reaction: string
  isRemoval: boolean
  targetMessageGuid: string | null
  timestamp: Date
}

export type TapbackHandler = (event: TapbackEvent) => void

let tapbackHandlers: TapbackHandler[] = []

export function onTapback(handler: TapbackHandler): () => void {
  tapbackHandlers.push(handler)
  return () => {
    tapbackHandlers = tapbackHandlers.filter((h) => h !== handler)
  }
}

/**
 * Create an imessage-kit compatible plugin object.
 * Uses the SDK's built-in reaction detection on Message objects.
 */
export function createTapbackPlugin() {
  return {
    name: 'tapback-tracker',
    onNewMessage(msg: any) {
      if (!msg.isReaction || !msg.reactionType) return

      const event: TapbackEvent = {
        type: 'tapback',
        sender: msg.sender ?? '',
        reaction: msg.reactionType,
        isRemoval: msg.isReactionRemoval ?? false,
        targetMessageGuid: msg.associatedMessageGuid ?? null,
        timestamp: msg.date ?? new Date(),
      }

      // Persist additions to conversation store
      if (!event.isRemoval) {
        recordTapback(event.sender, event.targetMessageGuid ?? '', event.reaction)
      }

      // Notify handlers
      for (const handler of tapbackHandlers) {
        try {
          handler(event)
        } catch {
          // Don't let handler errors crash the plugin
        }
      }

      console.log(
        `${event.isRemoval ? '➖' : '❤️'} Tapback: ${event.sender} ${event.isRemoval ? 'removed' : 'added'} ${event.reaction}`,
      )
    },
  }
}
