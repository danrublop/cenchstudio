import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { avatarConfigs, avatarVideos, scenes } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { AvatarService } from '@/lib/avatar'
import { getBestTTSProvider, getTTSProvider } from '@/lib/audio/router'

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const body = await req.json()
  const { text, sceneId, avatarConfigId, audioUrl, sourceImageUrl } = body

  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }

  // 1. Resolve avatar config: explicit ID → scene's config → project default
  let config: typeof avatarConfigs.$inferSelect | null = null

  if (avatarConfigId) {
    const [found] = await db
      .select()
      .from(avatarConfigs)
      .where(and(eq(avatarConfigs.id, avatarConfigId), eq(avatarConfigs.projectId, projectId)))
    config = found ?? null
  }

  if (!config && sceneId) {
    // Check if scene has a specific avatar config
    const [scene] = await db.select().from(scenes).where(eq(scenes.id, sceneId))
    if (scene?.avatarConfigId) {
      const [found] = await db.select().from(avatarConfigs).where(eq(avatarConfigs.id, scene.avatarConfigId))
      config = found ?? null
    }
  }

  if (!config) {
    // Fall back to project default
    const [found] = await db
      .select()
      .from(avatarConfigs)
      .where(and(eq(avatarConfigs.projectId, projectId), eq(avatarConfigs.isDefault, true)))
    config = found ?? null
  }

  if (!config) {
    return NextResponse.json({ error: 'No avatar config found. Configure one in project settings.' }, { status: 400 })
  }

  // 2. Generate TTS audio if not provided (skip for heygen — it handles its own TTS)
  let resolvedAudioUrl = audioUrl
  if (!resolvedAudioUrl && config.provider !== 'heygen') {
    try {
      const ttsProvider = getBestTTSProvider()
      if (ttsProvider === 'web-speech' || ttsProvider === 'puter') {
        return NextResponse.json(
          {
            error:
              'Avatar generation requires a server-side TTS provider (ElevenLabs, OpenAI, Gemini, or Google). Configure one in audio settings.',
          },
          { status: 400 },
        )
      }
      const impl = await getTTSProvider(ttsProvider)
      const ttsResult = await impl.generate({
        text,
        sceneId: sceneId ?? 'avatar-gen',
        voiceId: undefined,
      })
      resolvedAudioUrl = ttsResult.audioUrl
    } catch (e: any) {
      return NextResponse.json({ error: `TTS generation failed: ${e.message}` }, { status: 500 })
    }
  }

  // Estimate duration from text (~150 words per minute)
  const wordCount = text.split(/\s+/).length
  const estimatedDuration = Math.ceil((wordCount / 150) * 60)

  // 3. Create avatar video record
  const [videoRecord] = await db
    .insert(avatarVideos)
    .values({
      projectId,
      sceneId: sceneId ?? null,
      avatarConfigId: config.id,
      provider: config.provider,
      status: 'generating',
      text,
      audioUrl: resolvedAudioUrl ?? null,
      sourceImageUrl: sourceImageUrl ?? (config.config as any)?.sourceImageUrl ?? null,
    })
    .returning()

  // 4. For TalkingHead, skip API call — return immediately
  if (config.provider === 'talkinghead') {
    const result = await AvatarService.generate(
      {
        text,
        audioUrl: resolvedAudioUrl ?? '',
        durationSeconds: estimatedDuration,
        projectId,
        sourceImageUrl,
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

    return NextResponse.json(updated)
  }

  // 5. Call provider
  try {
    const result = await AvatarService.generate(
      {
        text,
        audioUrl: resolvedAudioUrl ?? '',
        durationSeconds: estimatedDuration,
        projectId,
        sourceImageUrl: sourceImageUrl ?? (config.config as any)?.sourceImageUrl,
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

    return NextResponse.json(updated)
  } catch (e: any) {
    await db
      .update(avatarVideos)
      .set({
        status: 'error',
        errorMessage: e.message,
      })
      .where(eq(avatarVideos.id, videoRecord.id))

    return NextResponse.json({ error: `Avatar generation failed: ${e.message}` }, { status: 500 })
  }
}
