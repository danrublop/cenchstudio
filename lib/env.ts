import { z } from 'zod'

/**
 * Server-side environment variables schema.
 * All optional keys default to empty string so the app boots without them,
 * but features that need a key will check for truthiness at call-site.
 */
const serverSchema = z.object({
  // ── Database ──────────────────────────────────────────
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  STORAGE_MODE: z.enum(['local', 'cloud']).default('local'),

  // ── AI providers ──────────────────────────────────────
  ANTHROPIC_API_KEY: z.string().default(''),
  OPENAI_API_KEY: z.string().default(''),
  GOOGLE_AI_KEY: z.string().default(''),

  // ── Media providers ───────────────────────────────────
  FAL_KEY: z.string().default(''),
  HEYGEN_API_KEY: z.string().default(''),
  ELEVENLABS_API_KEY: z.string().default(''),
  LOTTIEFILES_API_KEY: z.string().default(''),

  // ── Audio providers ───────────────────────────────────
  FREESOUND_API_KEY: z.string().default(''),
  PIXABAY_API_KEY: z.string().default(''),
  GOOGLE_TTS_API_KEY: z.string().default(''),
  GEMINI_API_KEY: z.string().default(''),
  EDGE_TTS_URL: z.string().default(''),

  // ── Cloud storage (STORAGE_MODE=cloud) ────────────────
  CLOUD_STORAGE_BUCKET: z.string().default(''),
  CLOUD_STORAGE_REGION: z.string().default(''),
  CLOUD_STORAGE_ACCESS_KEY: z.string().default(''),
  CLOUD_STORAGE_SECRET_KEY: z.string().default(''),
  CLOUD_STORAGE_ENDPOINT: z.string().default(''),

  // ── Runtime ───────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

const clientSchema = z.object({
  NEXT_PUBLIC_RENDER_SERVER_URL: z.string().default('http://localhost:3001'),
})

function validateEnv() {
  const serverResult = serverSchema.safeParse(process.env)
  const clientResult = clientSchema.safeParse(process.env)

  if (!serverResult.success) {
    const formatted = serverResult.error.flatten().fieldErrors
    console.error('Invalid server environment variables:', formatted)
    throw new Error(`Invalid environment variables: ${Object.keys(formatted).join(', ')}`)
  }

  if (!clientResult.success) {
    const formatted = clientResult.error.flatten().fieldErrors
    console.error('Invalid client environment variables:', formatted)
    throw new Error(`Invalid environment variables: ${Object.keys(formatted).join(', ')}`)
  }

  return { ...serverResult.data, ...clientResult.data }
}

export const env = validateEnv()
export type Env = ReturnType<typeof validateEnv>
