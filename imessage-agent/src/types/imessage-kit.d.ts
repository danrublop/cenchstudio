/**
 * Type declarations for @photon-ai/imessage-kit
 * Matches v2.1.2 of the SDK.
 */
declare module '@photon-ai/imessage-kit' {
  export type Recipient = string
  export type ServiceType = 'iMessage' | 'SMS' | 'RCS'
  export type ReactionType = 'love' | 'like' | 'dislike' | 'laugh' | 'emphasize' | 'question'

  export interface Attachment {
    readonly id: string
    readonly filename: string
    readonly mimeType: string
    readonly path: string
    readonly size: number
    readonly isImage: boolean
    readonly createdAt: Date
  }

  export interface Message {
    readonly id: string
    readonly guid: string
    readonly text: string | null
    readonly sender: string
    readonly senderName: string | null
    readonly chatId: string
    readonly isGroupChat: boolean
    readonly service: ServiceType
    readonly isRead: boolean
    readonly isFromMe: boolean
    readonly isReaction: boolean
    readonly reactionType: ReactionType | null
    readonly isReactionRemoval: boolean
    readonly associatedMessageGuid: string | null
    readonly attachments: readonly Attachment[]
    readonly date: Date
  }

  export interface MessageFilter {
    readonly unreadOnly?: boolean
    readonly excludeOwnMessages?: boolean
    readonly sender?: string
    readonly chatId?: string
    readonly service?: ServiceType
    readonly hasAttachments?: boolean
    readonly excludeReactions?: boolean
    readonly since?: Date
    readonly search?: string
    readonly limit?: number
  }

  export interface MessageQueryResult {
    readonly messages: readonly Message[]
    readonly total: number
    readonly unreadCount: number
  }

  export interface SendResult {
    readonly success: boolean
    readonly message?: Message
    readonly error?: string
  }

  export interface WatcherEvents {
    onMessage?: (message: Message) => void | Promise<void>
    onDirectMessage?: (message: Message) => void | Promise<void>
    onGroupMessage?: (message: Message) => void | Promise<void>
    onError?: (error: Error) => void
  }

  export interface PluginHooks {
    onInit?: () => void | Promise<void>
    onBeforeQuery?: (filter: unknown) => void | Promise<void>
    onAfterQuery?: (messages: readonly Message[]) => void | Promise<void>
    onBeforeSend?: (to: string, content: { text?: string; attachments?: string[] }) => void | Promise<void>
    onAfterSend?: (to: string, result: SendResult) => void | Promise<void>
    onNewMessage?: (message: Message) => void | Promise<void>
    onError?: (error: Error, context?: string) => void | Promise<void>
    onDestroy?: () => void | Promise<void>
  }

  export interface Plugin extends PluginHooks {
    readonly name: string
    readonly version?: string
    readonly description?: string
  }

  export interface WatcherConfig {
    readonly pollInterval?: number
    readonly unreadOnly?: boolean
    readonly excludeOwnMessages?: boolean
  }

  export interface IMessageConfig {
    readonly databasePath?: string
    readonly watcher?: WatcherConfig
    readonly retry?: { readonly max?: number; readonly delay?: number }
    readonly scriptTimeout?: number
    readonly maxConcurrent?: number
    readonly debug?: boolean
    readonly plugins?: readonly Plugin[]
  }

  export class IMessageSDK {
    constructor(config?: IMessageConfig)

    use(plugin: Plugin): this

    send(
      to: string | Recipient,
      content:
        | string
        | {
            text?: string
            images?: string[]
            files?: string[]
          },
    ): Promise<SendResult>

    sendFile(to: string | Recipient, filePath: string, text?: string): Promise<SendResult>
    sendFiles(to: string | Recipient, filePaths: string[], text?: string): Promise<SendResult>

    getMessages(filter?: MessageFilter): Promise<MessageQueryResult>
    getUnreadMessages(): Promise<{
      groups: Array<{ sender: string; messages: Message[] }>
      total: number
      senderCount: number
    }>

    startWatching(events?: WatcherEvents): Promise<void>
    stopWatching(): void
    close(): Promise<void>

    message(message: Message): any
  }

  export function definePlugin(plugin: Plugin): Plugin
}
