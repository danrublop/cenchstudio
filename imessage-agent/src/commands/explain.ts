/**
 * Explain Command — default handler.
 * Takes any topic, generates an animated explainer video via Cench Studio.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateScenes, renderToMp4, downloadMp4, getOrCreateProject } from '../cench-client.js'
import { getOrCreateContact, addMessage, setLastScenes, getHistory, getTapbacks } from '../conversation-store.js'
import { getThreadContext } from '../plugins/thread-context.js'
import { createProgressReporter } from '../utils/progress.js'
import type { CommandContext, CommandResult } from './types.js'

const execFileAsync = promisify(execFile)

export async function handleExplain(ctx: CommandContext): Promise<CommandResult> {
  const { contactId, message, sendReply, reactToMessage } = ctx
  const contact = getOrCreateContact(contactId)

  // Record user message
  addMessage(contactId, 'user', message)

  // Set up console-only progress tracking
  const progress = createProgressReporter(contactId)

  try {
    // Silent ack via reaction, text fallback if reaction fails
    const reacted = await reactToMessage()
    if (!reacted) await sendReply('on it, ~30s')

    // Create or get project for this contact
    const projectName = `iMessage - ${contact.displayName ?? contactId}`
    const projectId = await getOrCreateProject(projectName)

    // Build history for context
    const history = getHistory(contactId, 10).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    // Build thread context if this is a reply
    const threadCtx = ctx.messageGuid ? getThreadContext(ctx.messageGuid, 5) : ''

    // Summarize tapback preferences (what styles the user has reacted positively to)
    const tapbacks = getTapbacks(contactId, 20)
    const likedCount = tapbacks.filter((t) => t.reaction === 'love' || t.reaction === 'like').length
    const dislikedCount = tapbacks.filter((t) => t.reaction === 'dislike').length
    const prefHint =
      likedCount > 0 || dislikedCount > 0
        ? `\nUser feedback: ${likedCount} positive reactions, ${dislikedCount} negative on past videos.`
        : ''

    // Generate scene via Cench agent
    const prompt = `Create a single animated explainer scene about: ${message}

Keep it concise and visually engaging. Duration: 8-12 seconds.
${threadCtx ? `\nConversation thread for context:\n${threadCtx}\n` : ''}${prefHint}
IMPORTANT rules for this generation:
- Use create_scene with a descriptive prompt. The code generator will handle the template.
- Do NOT use add_layer with full HTML documents — this breaks the scene template.
- Prefer the Motion template (anime.js + HTML/CSS) for text-heavy explanations.
- Use Canvas2D for visual simulations or drawings.
- Do NOT add narration or TTS — audio is handled separately.
- Do NOT add background music or sound effects.
- Focus only on creating one great visual scene.`

    const result = await generateScenes({
      message: prompt,
      history,
      agentOverride: 'scene-maker',
      projectName,
      projectId: projectId ?? undefined,
      callbacks: {
        onPhase: (phase) => progress.update(phase),
      },
    })

    if (result.scenes.length === 0) {
      progress.stop()
      console.log(`   [explain] 0 scenes returned. textResponse: "${result.textResponse?.slice(0, 100)}"`)
      console.log(
        `   [explain] usage: ${result.usage.inputTokens}in/${result.usage.outputTokens}out, $${result.usage.costUsd.toFixed(4)}`,
      )
      const hint = result.textResponse
        ? `agent said: ${result.textResponse.slice(0, 100)}`
        : "couldn't make that one, try rephrasing?"
      addMessage(contactId, 'assistant', hint)
      return { success: false, error: hint }
    }

    // Save scene refs for follow-up edits
    setLastScenes(contactId, result.scenes)

    // Generate TTS narration with macOS say (post-generation)
    const narrationText = result.textResponse?.slice(0, 500) || `Here's an explainer about ${message}`
    const ts = Date.now()
    const ttsAiff = `/tmp/cench-tts-${ts}.aiff`
    const ttsMp3 = `/tmp/cench-tts-${ts}.mp3`
    try {
      await execFileAsync('say', ['-v', 'Samantha', '-o', ttsAiff, narrationText])
      await execFileAsync('ffmpeg', ['-y', '-i', ttsAiff, '-codec:a', 'libmp3lame', '-b:a', '128k', ttsMp3])

      // Get actual duration from ffprobe
      const { stdout: durationStr } = await execFileAsync('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        ttsMp3,
      ])
      const duration = parseFloat(durationStr) || 5

      // Copy to public/audio/ — use import.meta.url for reliable path resolution
      const { copyFile } = await import('fs/promises')
      const thisDir = path.dirname(fileURLToPath(import.meta.url))
      const publicDir = path.resolve(thisDir, '../../../public')
      const publicPath = `/audio/imsg-tts-${ts}.mp3`
      await copyFile(ttsMp3, path.join(publicDir, publicPath))

      result.scenes[0].audioLayer = {
        enabled: true,
        tts: { src: publicPath, duration, status: 'ready' },
      }
      console.log(`   [explain] TTS ready: ${publicPath} (~${duration.toFixed(1)}s)`)
    } catch (ttsErr) {
      console.warn(`   [explain] TTS skipped: ${ttsErr}`)
    } finally {
      const { unlink } = await import('fs/promises')
      await unlink(ttsAiff).catch(() => {})
      await unlink(ttsMp3).catch(() => {})
    }

    // Render to MP4
    progress.update('rendering')
    const render = await renderToMp4(result.scenes, undefined, {
      onPhase: (phase) => progress.update(phase),
      onProgress: (scene, pct) => progress.update(`rendering scene ${scene}: ${pct}%`),
    })

    progress.stop()

    // Download the MP4 to a temp file
    const { tmpdir } = await import('os')
    const tempPath = `${tmpdir()}/cench-${Date.now()}.mp4`
    await downloadMp4(render.localPath, tempPath)

    // Record assistant response
    const responseText = result.textResponse || `Created an animated explainer about: ${message}`
    addMessage(contactId, 'assistant', responseText)

    return { success: true, mp4Path: tempPath, caption: responseText, textResponse: responseText }
  } catch (error) {
    progress.stop()
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`   [explain] error: ${msg}`)
    addMessage(contactId, 'assistant', `error: ${msg}`)

    if (msg.includes('API key') || msg.includes('authentication') || msg.includes('401')) {
      return { success: false, error: 'API key issue — check your ANTHROPIC_API_KEY' }
    }
    if (msg.includes('rate_limit') || msg.includes('429')) {
      return { success: false, error: 'rate limited, try again in a minute' }
    }
    if (msg.includes('offline') || msg.includes('ECONNREFUSED')) {
      return { success: false, error: 'studio server is down' }
    }
    return { success: false, error: 'something went wrong, try again?' }
  }
}
