/**
 * Chart Command — generates D3 data visualization videos.
 * Triggered by "chart:" prefix or "/chart" command.
 */

import { generateScenes, renderToMp4, downloadMp4 } from '../cench-client.js'
import { addMessage, setLastScenes, getOrCreateContact } from '../conversation-store.js'
import { createProgressReporter } from '../utils/progress.js'
import type { CommandContext, CommandResult } from './types.js'

export async function handleChart(ctx: CommandContext): Promise<CommandResult> {
  const { contactId, message, sendReply, reactToMessage } = ctx
  const contact = getOrCreateContact(contactId)

  // Strip "chart:" or "/chart" prefix
  const topic = message.replace(/^(\/chart\s*|chart:\s*)/i, '').trim()

  addMessage(contactId, 'user', message)

  const progress = createProgressReporter(contactId)

  try {
    const reacted = await reactToMessage()
    if (!reacted) await sendReply('making a chart, ~30s')

    const prompt = `Create an animated data visualization about: ${topic}

Requirements:
- Use the Motion template (anime.js + HTML/CSS) to build the chart
- Animate the data appearing progressively (bars growing, lines drawing, etc.)
- Include clear labels, axes, and a title
- Duration: 10-15 seconds
- Make it visually compelling with smooth transitions
- If specific data isn't available, use realistic representative data
- Do NOT use add_layer with full HTML documents — use create_scene with a prompt
- Do NOT add narration, TTS, or background music — audio is handled separately
- Focus only on creating one great visual chart scene`

    const result = await generateScenes({
      message: prompt,
      agentOverride: 'scene-maker',
      projectName: `iMessage Charts - ${contact.displayName ?? contactId}`,
      callbacks: {
        onPhase: (phase) => progress.update(phase),
      },
    })

    if (result.scenes.length === 0) {
      progress.stop()
      addMessage(contactId, 'assistant', "couldn't make that chart, try being more specific?")
      return { success: false, error: "couldn't make that chart, try being more specific?" }
    }

    setLastScenes(contactId, result.scenes)

    progress.update('rendering')
    const render = await renderToMp4(result.scenes, undefined, {
      onPhase: (phase) => progress.update(phase),
    })

    progress.stop()

    const { tmpdir } = await import('os')
    const tempPath = `${tmpdir()}/cench-chart-${Date.now()}.mp4`
    await downloadMp4(render.localPath, tempPath)

    addMessage(contactId, 'assistant', `Chart created: ${topic}`)

    return { success: true, mp4Path: tempPath, caption: `Chart: ${topic}`, textResponse: `Chart: ${topic}` }
  } catch (error) {
    progress.stop()
    const msg = error instanceof Error ? error.message : 'Unknown error'
    addMessage(contactId, 'assistant', `chart failed: ${msg}`)
    return { success: false, error: 'something went wrong with the chart, try again?' }
  }
}
