/**
 * Edit Command — handles follow-up modifications to existing scenes.
 * "make it shorter", "change colors to blue", "add more detail"
 */

import { generateScenes, renderToMp4, downloadMp4 } from '../cench-client.js'
import {
  getOrCreateContact,
  addMessage,
  getLastScenes,
  setLastScenes,
  getHistory,
  getTapbacks,
} from '../conversation-store.js'
import { getThreadContext } from '../plugins/thread-context.js'
import { createProgressReporter } from '../utils/progress.js'
import type { CommandContext, CommandResult } from './types.js'

export async function handleEdit(ctx: CommandContext): Promise<CommandResult> {
  const { contactId, message, sendReply, reactToMessage } = ctx
  const contact = getOrCreateContact(contactId)
  const existingScenes = getLastScenes(contactId)

  addMessage(contactId, 'user', message)

  const progress = createProgressReporter(contactId)

  try {
    const reacted = await reactToMessage()
    if (!reacted) await sendReply('updating, ~30s')

    const history = getHistory(contactId, 10).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    // Build thread context if this is a reply
    const threadCtx = ctx.messageGuid ? getThreadContext(ctx.messageGuid, 5) : ''

    // Summarize tapback preferences
    const tapbacks = getTapbacks(contactId, 20)
    const likedCount = tapbacks.filter((t) => t.reaction === 'love' || t.reaction === 'like').length
    const prefHint = likedCount > 0 ? ` (user has liked ${likedCount} past videos)` : ''

    const editMessage = threadCtx ? `${message}\n\nConversation context:\n${threadCtx}` : message

    // Pass existing scenes so the agent can modify them
    const result = await generateScenes({
      message: editMessage + prefHint,
      scenes: existingScenes.map((s) => ({
        id: s.id,
        name: s.name,
        sceneType: s.sceneType,
        duration: s.duration,
        layers: [],
      })),
      history,
      agentOverride: 'editor',
      projectName: `iMessage - ${contact.displayName ?? contactId}`,
      callbacks: {
        onPhase: (phase) => progress.update(phase),
      },
    })

    // If no scenes were generated, the edit failed — don't re-render the same video
    if (result.scenes.length === 0) {
      progress.stop()
      const hint = result.textResponse?.slice(0, 100) || "couldn't make that edit, try rephrasing?"
      addMessage(contactId, 'assistant', hint)
      return { success: false, error: hint }
    }

    const scenesToRender = result.scenes
    setLastScenes(contactId, scenesToRender)

    progress.update('rendering')
    const render = await renderToMp4(scenesToRender, undefined, {
      onPhase: (phase) => progress.update(phase),
    })

    progress.stop()

    const { tmpdir } = await import('os')
    const tempPath = `${tmpdir()}/cench-${Date.now()}.mp4`
    await downloadMp4(render.localPath, tempPath)

    const responseText = result.textResponse || 'updated your video'
    addMessage(contactId, 'assistant', responseText)

    return { success: true, mp4Path: tempPath, caption: responseText, textResponse: responseText }
  } catch (error) {
    progress.stop()
    const msg = error instanceof Error ? error.message : 'Unknown error'
    addMessage(contactId, 'assistant', `couldn't update: ${msg}`)
    return { success: false, error: "couldn't update that, try again?" }
  }
}
