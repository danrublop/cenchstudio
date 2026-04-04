const HEYGEN_BASE = 'https://api.heygen.com/v2'
const HEYGEN_KEY = () => process.env.HEYGEN_API_KEY

export interface HeyGenAvatar {
  avatar_id: string
  avatar_name: string
  gender: string
  preview_image_url: string
  preview_video_url: string | null
}

export interface HeyGenVoice {
  voice_id: string
  language: string
  gender: string
  name: string
  preview_audio: string | null
}

async function heygenFetch(path: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(`${HEYGEN_BASE}${path}`, {
    ...options,
    headers: {
      'X-Api-Key': HEYGEN_KEY()!,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const data = await response.json()
  if (!response.ok || data.error) {
    throw new Error(data.error?.message ?? data.message ?? `HeyGen API error: ${response.status}`)
  }
  return data.data ?? data
}

// ── List avatars ────────────────────────────────────────────────────────────

let avatarCache: { avatars: HeyGenAvatar[]; fetchedAt: number } | null = null
const AVATAR_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

export async function listAvatars(): Promise<HeyGenAvatar[]> {
  if (avatarCache && Date.now() - avatarCache.fetchedAt < AVATAR_CACHE_TTL) {
    return avatarCache.avatars
  }

  const data = await heygenFetch('/avatars')
  const avatars: HeyGenAvatar[] = (data.avatars ?? []).map((a: any) => ({
    avatar_id: a.avatar_id,
    avatar_name: a.avatar_name,
    gender: a.gender,
    preview_image_url: a.preview_image_url,
    preview_video_url: a.preview_video_url,
  }))

  avatarCache = { avatars, fetchedAt: Date.now() }
  return avatars
}

// ── Generate avatar video ───────────────────────────────────────────────────

export async function generateAvatarVideo(opts: {
  avatarId: string
  voiceId: string
  script: string
  width?: number
  height?: number
  bgColor?: string
}): Promise<{ videoId: string; estimatedSeconds: number }> {
  const data = await heygenFetch('/video/generate', {
    method: 'POST',
    body: JSON.stringify({
      video_inputs: [
        {
          character: {
            type: 'avatar',
            avatar_id: opts.avatarId,
            avatar_style: 'normal',
          },
          voice: {
            type: 'text',
            input_text: opts.script,
            voice_id: opts.voiceId,
          },
          background: {
            type: 'color',
            value: opts.bgColor ?? '#00FF00', // green for chroma key
          },
        },
      ],
      dimension: {
        width: opts.width ?? 512,
        height: opts.height ?? 512,
      },
    }),
  })

  // Estimate duration from script length (~150 words per minute)
  const wordCount = opts.script.split(/\s+/).length
  const estimatedSeconds = Math.ceil((wordCount / 150) * 60)

  return {
    videoId: data.video_id,
    estimatedSeconds,
  }
}

// ── Poll video status ───────────────────────────────────────────────────────

export async function getVideoStatus(videoId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  thumbnailUrl?: string
  error?: string
}> {
  const data = await heygenFetch(`/video_status.get?video_id=${videoId}`)

  return {
    status: data.status,
    videoUrl: data.video_url,
    thumbnailUrl: data.thumbnail_url,
    error: data.error,
  }
}

// ── Download video ──────────────────────────────────────────────────────────

export async function downloadVideo(videoUrl: string): Promise<Buffer> {
  const response = await fetch(videoUrl)
  if (!response.ok) throw new Error(`Failed to download HeyGen video: ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

// ── List voices ────────────────────────────────────────────────────────────

let voiceCache: { voices: HeyGenVoice[]; fetchedAt: number } | null = null
const VOICE_CACHE_TTL = 24 * 60 * 60 * 1000

export async function listVoices(): Promise<HeyGenVoice[]> {
  if (voiceCache && Date.now() - voiceCache.fetchedAt < VOICE_CACHE_TTL) {
    return voiceCache.voices
  }

  const data = await heygenFetch('/voices')
  const voices: HeyGenVoice[] = (data.voices ?? []).map((v: any) => ({
    voice_id: v.voice_id,
    language: v.language,
    gender: v.gender,
    name: v.name,
    preview_audio: v.preview_audio ?? null,
  }))

  voiceCache = { voices, fetchedAt: Date.now() }
  return voices
}

// ── Starfish TTS ───────────────────────────────────────────────────────────

export async function generateStarfishTTS(opts: {
  text: string
  voiceId: string
  speed?: number
}): Promise<{ audioUrl: string }> {
  const data = await heygenFetch('/tts', {
    method: 'POST',
    body: JSON.stringify({
      text: opts.text,
      voice_id: opts.voiceId,
      speed: opts.speed ?? 1.0,
    }),
  })

  return { audioUrl: data.audio_url ?? data.url }
}
