const VEO3_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const GOOGLE_AI_KEY = () => process.env.GOOGLE_AI_KEY

export const VEO3_COST_ESTIMATE = 1.0 // rough estimate per clip

// ── Generate video ──────────────────────────────────────────────────────────

export async function generateVeo3Video(opts: {
  prompt: string
  negativePrompt?: string
  aspectRatio: '16:9' | '9:16' | '1:1'
  durationSeconds: 5 | 8
}): Promise<{ operationName: string }> {
  const response = await fetch(
    `${VEO3_BASE}/models/veo-3.0-generate-preview:generateVideo?key=${GOOGLE_AI_KEY()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: { text: opts.prompt },
        negativePrompt: opts.negativePrompt ? { text: opts.negativePrompt } : undefined,
        generationConfig: {
          mediaResolution: 'MEDIA_RESOLUTION_HIGH',
          aspectRatio: opts.aspectRatio,
          durationSeconds: opts.durationSeconds,
        },
      }),
    }
  )

  if (response.status === 403 || response.status === 429) {
    throw new Error(
      `Veo 3 is not available (${response.status}). You may need waitlist access. ` +
      'Consider using Canvas2D animations or existing video assets instead.'
    )
  }

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error?.message ?? `Veo 3 error: ${response.status}`)
  }

  return { operationName: data.name }
}

// ── Poll status ─────────────────────────────────────────────────────────────

export async function getVeo3Status(operationName: string): Promise<{
  done: boolean
  videoUri?: string
  error?: string
}> {
  const response = await fetch(
    `${VEO3_BASE}/${operationName}?key=${GOOGLE_AI_KEY()}`
  )

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error?.message ?? `Veo 3 status error: ${response.status}`)
  }

  if (data.done) {
    // Extract video from response
    const video = data.response?.generatedSamples?.[0]
    if (video?.video?.uri) {
      return { done: true, videoUri: video.video.uri }
    }
    if (data.error) {
      return { done: true, error: data.error.message }
    }
  }

  return { done: false }
}

// ── Download video from GCS ─────────────────────────────────────────────────

export async function downloadVeo3Video(uri: string): Promise<Buffer> {
  // GCS URI format: gs://bucket/path or direct HTTPS URL
  const url = uri.startsWith('gs://')
    ? `https://storage.googleapis.com/${uri.slice(5)}`
    : uri

  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download Veo 3 video: ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

// ── Prompt enhancement ──────────────────────────────────────────────────────

export async function enhanceVeo3Prompt(userPrompt: string): Promise<string> {
  // Uses Claude to enhance the prompt with cinematic language
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic()

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `Rewrite this video description into a detailed cinematic prompt for an AI video generator.
Add camera movement, lighting, atmosphere, and visual quality terms. Keep it under 200 words.
Do NOT output anything except the enhanced prompt text.

User description: "${userPrompt}"`,
    }],
  })

  const text = response.content[0]
  if (text.type !== 'text') return userPrompt
  return text.text.trim()
}
