/**
 * Briefing Command — daily animated summary.
 * Triggered by "good morning", "briefing", or scheduled recurring.
 */

import { generateScenes, renderToMp4, downloadMp4 } from '../cench-client.js'
import { addMessage, setLastScenes, getOrCreateContact } from '../conversation-store.js'
import { createProgressReporter } from '../utils/progress.js'
import type { CommandContext, CommandResult } from './types.js'

async function fetchWeather(): Promise<string> {
  const apiKey = process.env.WEATHER_API_KEY
  if (!apiKey) return 'Weather: sunny, 72°F (API key not configured)'

  try {
    const res = await fetch(`https://api.weatherapi.com/v1/current.json?key=${encodeURIComponent(apiKey)}&q=auto:ip`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return 'Weather: unavailable'
    const data = await res.json()
    const c = data.current
    return `Weather: ${c.condition.text}, ${c.temp_f}°F / ${c.temp_c}°C, humidity ${c.humidity}%`
  } catch {
    return 'Weather: unavailable'
  }
}

function getTimeGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'good morning'
  if (hour < 17) return 'good afternoon'
  return 'good evening'
}

export async function handleBriefing(ctx: CommandContext): Promise<CommandResult> {
  const { contactId, sendReply, reactToMessage } = ctx
  const contact = getOrCreateContact(contactId)

  addMessage(contactId, 'user', 'daily briefing')

  const progress = createProgressReporter(contactId)

  try {
    const greeting = getTimeGreeting()
    const reacted = await reactToMessage()
    if (!reacted) await sendReply(`${greeting}! making your briefing, ~45s`)

    const weather = await fetchWeather()
    const date = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })

    const prompt = `Create an animated daily briefing scene with this info:

Date: ${date}
${weather}

Design requirements:
- Clean, minimal morning-dashboard aesthetic
- Animate each section appearing one by one
- Use calming colors (soft blues, whites)
- Duration: 8 seconds
- Include the date prominently
- Show weather with a simple icon representation
- End with a motivational "Have a great day!" message`

    const result = await generateScenes({
      message: prompt,
      agentOverride: 'scene-maker',
      projectName: `iMessage Briefing - ${contact.displayName ?? contactId}`,
      callbacks: {
        onPhase: (phase) => progress.update(phase),
      },
    })

    if (result.scenes.length === 0) {
      progress.stop()
      // Text fallback — this IS the content delivery
      await sendReply(`${greeting}! here's your quick update:\n\n${date}\n${weather}\n\nhave a great day!`)
      addMessage(contactId, 'assistant', 'Briefing sent (text fallback)')
      return { success: true, textResponse: 'Briefing sent as text' }
    }

    setLastScenes(contactId, result.scenes)

    progress.update('rendering')
    const render = await renderToMp4(result.scenes, undefined, {
      onPhase: (phase) => progress.update(phase),
    })

    progress.stop()

    const { tmpdir } = await import('os')
    const tempPath = `${tmpdir()}/cench-briefing-${Date.now()}.mp4`
    await downloadMp4(render.localPath, tempPath)

    addMessage(contactId, 'assistant', `Daily briefing for ${date}`)

    return {
      success: true,
      mp4Path: tempPath,
      caption: `your ${date} briefing`,
      textResponse: `Daily briefing for ${date}`,
    }
  } catch (error) {
    progress.stop()
    const msg = error instanceof Error ? error.message : 'Unknown error'

    // Fallback to text briefing
    const weather = await fetchWeather()
    await sendReply(`couldn't render the video briefing, but here's your update:\n\n${weather}`)

    return { success: false, error: msg }
  }
}
