/**
 * Avatar generation service — pure function extracted from
 *   POST /api/projects/[projectId]/avatar/generate
 *
 * Handles config resolution, TTS fallback, record creation, and
 * AvatarService dispatch. Called by the HTTP route, the agent tool
 * handlers (avatar-tools.ts), and Electron IPC without any Next
 * request plumbing.
 */

import { db } from '@/lib/db'
import { avatarConfigs, avatarVideos, scenes } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { AvatarService } from '@/lib/avatar'
import { getBestTTSProvider, getTTSProvider } from '@/lib/audio/router'

export class AvatarValidationError extends Error {
  readonly code = 'VALIDATION' as const
  constructor(message: string) {
    super(message)
    this.name = 'AvatarValidationError'
  }
}

export interface GenerateAvatarInput {
  text: string
  sceneId?: string | null
  avatarConfigId?: string | null
  audioUrl?: string | null
  sourceImageUrl?: string | null
}

export type GenerateAvatarResult = typeof avatarVideos.$inferSelect

export async function generateAvatar(projectId: string, input: GenerateAvatarInput): Promise<GenerateAvatarResult> {
  if (!input.text) throw new AvatarValidationError('text is required')

  // 1. Resolve avatar config: explicit ID → scene's config → project default
  let config: typeof avatarConfigs.$inferSelect | null = null

  if (input.avatarConfigId) {
    const [found] = await db
      .select()
      .from(avatarConfigs)
      .where(and(eq(avatarConfigs.id, input.avatarConfigId), eq(avatarConfigs.projectId, projectId)))
    config = found ?? null
  }

  if (!config && input.sceneId) {
    const [scene] = await db.select().from(scenes).where(eq(scenes.id, input.sceneId))
    if (scene?.avatarConfigId) {
      const [found] = await db.select().from(avatarConfigs).where(eq(avatarConfigs.id, scene.avatarConfigId))
      config = found ?? null
    }
  }

  if (!config) {
    const [found] = await db
      .select()
      .from(avatarConfigs)
      .where(and(eq(avatarConfigs.projectId, projectId), eq(avatarConfigs.isDefault, true)))
    config = found ?? null
  }

  if (!config) {
    throw new AvatarValidationError('No avatar config found. Configure one in project settings.')
  }

  // 2. Generate TTS audio if not provided. HeyGen handles its own TTS; skip.
  // Client-only TTS providers (web-speech/puter) can't produce a file, so
  // refuse them here — the agent or UI must pick a server provider.
  let resolvedAudioUrl = input.audioUrl
  if (!resolvedAudioUrl && config.provider !== 'heygen') {
    const ttsProvider = getBestTTSProvider()
    if (ttsProvider === 'web-speech' || ttsProvider === 'puter') {
      throw new AvatarValidationError(
        'Avatar generation requires a server-side TTS provider (ElevenLabs, OpenAI, Gemini, or Google). Configure one in audio settings.',
      )
    }
    try {
      const impl = await getTTSProvider(ttsProvider)
      const ttsResult = await impl.generate({
        text: input.text,
        sceneId: input.sceneId ?? 'avatar-gen',
        voiceId: undefined,
      })
      resolvedAudioUrl = ttsResult.audioUrl
    } catch (e) {
      throw new Error(`TTS generation failed: ${(e as Error).message}`)
    }
  }

  const wordCount = input.text.split(/\s+/).length
  const estimatedDuration = Math.ceil((wordCount / 150) * 60)

  const [videoRecord] = await db
    .insert(avatarVideos)
    .values({
      projectId,
      sceneId: input.sceneId ?? null,
      avatarConfigId: config.id,
      provider: config.provider,
      status: 'generating',
      text: input.text,
      audioUrl: resolvedAudioUrl ?? null,
      sourceImageUrl:
        input.sourceImageUrl ?? (config.config as { sourceImageUrl?: string } | null)?.sourceImageUrl ?? null,
    })
    .returning()

  // TalkingHead is local — no API call, mark ready and return.
  // Wrap in the same error-recovery as the remote path: if `AvatarService.generate`
  // throws, flip the row to `status: 'error'` so the UI stops spinning on a
  // zombie `generating` record (pre-existing bug in the old HTTP route).
  if (config.provider === 'talkinghead') {
    try {
      const result = await AvatarService.generate(
        {
          text: input.text,
          audioUrl: resolvedAudioUrl ?? '',
          durationSeconds: estimatedDuration,
          projectId,
          sourceImageUrl: input.sourceImageUrl ?? undefined,
        },
        config,
      )

      const [updated] = await db
        .update(avatarVideos)
        .set({
          status: 'ready',
          videoUrl: result.videoUrl,
          durationSeconds: result.durationSeconds,
          costUsd: 0,
        })
        .where(eq(avatarVideos.id, videoRecord.id))
        .returning()

      return updated
    } catch (e) {
      const message = (e as Error).message
      await db
        .update(avatarVideos)
        .set({ status: 'error', errorMessage: message })
        .where(eq(avatarVideos.id, videoRecord.id))
      throw new Error(`Avatar generation failed: ${message}`)
    }
  }

  try {
    const result = await AvatarService.generate(
      {
        text: input.text,
        audioUrl: resolvedAudioUrl ?? '',
        durationSeconds: estimatedDuration,
        projectId,
        sourceImageUrl: input.sourceImageUrl ?? (config.config as { sourceImageUrl?: string } | null)?.sourceImageUrl,
      },
      config,
    )

    const [updated] = await db
      .update(avatarVideos)
      .set({
        status: 'ready',
        videoUrl: result.videoUrl,
        durationSeconds: result.durationSeconds,
        costUsd: result.costUsd,
      })
      .where(eq(avatarVideos.id, videoRecord.id))
      .returning()

    return updated
  } catch (e) {
    const message = (e as Error).message
    await db
      .update(avatarVideos)
      .set({
        status: 'error',
        errorMessage: message,
      })
      .where(eq(avatarVideos.id, videoRecord.id))

    throw new Error(`Avatar generation failed: ${message}`)
  }
}
