/**
 * Shared types for command handlers.
 */

export interface CommandContext {
  contactId: string
  message: string
  messageGuid?: string
  sendReply: (text: string) => Promise<void>
  sendFile: (filePath: string, caption?: string) => Promise<void>
  reactToMessage: () => Promise<boolean>
}

export interface CommandResult {
  success: boolean
  mp4Path?: string
  caption?: string
  textResponse?: string
  error?: string
}
