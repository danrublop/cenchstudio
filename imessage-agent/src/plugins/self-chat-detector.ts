/**
 * Self-Chat Detector Plugin — SDK contribution for imessage-kit.
 *
 * Detects when a message is from a self-chat (texting yourself / note-to-self).
 * In iMessage, self-chats have a chat where the sender and recipient are the
 * same Apple ID. The SDK's `isFromMe` flag is true for ALL sent messages,
 * but in a self-chat the received copy also comes from the same account.
 *
 * This plugin:
 * 1. Learns the current user's identity from outgoing messages
 * 2. Detects self-chats by comparing sender to self
 * 3. Annotates messages with `isSelfChat: true`
 *
 * Contribution target: @photon-ai/imessage-kit core or plugin registry
 */

const selfIdentities = new Set<string>()

/**
 * Register a known self identity (phone number or Apple ID).
 * Called manually or learned from outgoing messages.
 */
export function addSelfIdentity(id: string): void {
  selfIdentities.add(id.toLowerCase().trim())
}

/** Check if a sender is the current user */
export function isSelf(sender: string): boolean {
  return selfIdentities.has(sender.toLowerCase().trim())
}

/** Get all known self identities */
export function getSelfIdentities(): string[] {
  return Array.from(selfIdentities)
}

export function createSelfChatPlugin() {
  return {
    name: 'self-chat-detector',
    description: 'Detects self-chats (note-to-self) and annotates messages with isSelfChat flag',
    version: '1.0.0',

    onNewMessage(msg: any) {
      // Learn self identity from outgoing messages
      if (msg.isFromMe && msg.sender) {
        addSelfIdentity(msg.sender)
      }

      // If we know the sender matches a self identity, this is a self-chat receive
      if (!msg.isFromMe && msg.sender && isSelf(msg.sender)) {
        msg.isSelfChat = true
      }
    },
  }
}
