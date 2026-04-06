import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { PublishedProject, PublishedScene } from '@/lib/types'
import { normalizeTransition } from '@/lib/transitions'
import { assertProjectAccess } from '@/lib/auth-helpers'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { project, scenes, globalStyle } = body

    if (!project?.id || !scenes?.length) {
      return NextResponse.json({ error: 'Missing project or scenes' }, { status: 400 })
    }

    const access = await assertProjectAccess(project.id)
    if (access.error) return access.error

    const publishDir = path.join(process.cwd(), 'public', 'published', project.id)
    const scenesDir = path.join(publishDir, 'scenes')
    const assetsDir = path.join(publishDir, 'assets')

    // Create directories
    fs.mkdirSync(scenesDir, { recursive: true })
    fs.mkdirSync(assetsDir, { recursive: true })

    // Copy scene HTML files
    const publishedScenes: PublishedScene[] = []
    const missingSceneIds: string[] = []
    for (const scene of scenes) {
      const srcPath = path.join(process.cwd(), 'public', 'scenes', `${scene.id}.html`)
      const destPath = path.join(scenesDir, `${scene.id}.html`)

      if (!fs.existsSync(srcPath)) {
        console.warn(`[Publish] Scene HTML missing: ${scene.id}.html`)
        missingSceneIds.push(scene.id)
        continue
      }

      try {
        fs.copyFileSync(srcPath, destPath)
      } catch (e) {
        console.error(`[Publish] Failed to copy scene HTML for ${scene.id}:`, e)
        missingSceneIds.push(scene.id)
        continue
      }

      publishedScenes.push({
        id: scene.id,
        type: scene.sceneType ?? 'svg',
        duration: scene.duration,
        htmlUrl: `/published/${project.id}/scenes/${scene.id}.html`,
        htmlContent: null,
        interactions: scene.interactions ?? [],
        variables: scene.variables ?? [],
        transition: normalizeTransition(scene.transition),
      })
    }

    if (missingSceneIds.length > 0) {
      return NextResponse.json(
        {
          error: `Failed to publish: ${missingSceneIds.length} scene(s) are missing HTML files. Regenerate them and try again.`,
          missingSceneIds,
        },
        { status: 400 },
      )
    }

    // Copy uploaded assets referenced in scenes
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir)
      for (const file of files) {
        const src = path.join(uploadsDir, file)
        const dest = path.join(assetsDir, file)
        if (fs.statSync(src).isFile()) {
          fs.copyFileSync(src, dest)
        }
      }
    }

    // Read existing manifest to get version
    const manifestPath = path.join(publishDir, 'manifest.json')
    let version = 1
    if (fs.existsSync(manifestPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
        version = (existing.version ?? 0) + 1
      } catch (e) {
        console.warn('[Publish] Failed to parse existing manifest, starting at version 1:', (e as Error).message)
      }
    }

    // Generate manifest
    const manifest: PublishedProject = {
      id: project.id,
      version,
      name: project.name || 'Untitled Project',
      playerOptions: {
        theme: project.interactiveSettings?.playerTheme ?? 'dark',
        showProgressBar: project.interactiveSettings?.showProgressBar ?? true,
        showSceneNav: project.interactiveSettings?.showSceneNav ?? false,
        allowFullscreen: project.interactiveSettings?.allowFullscreen ?? true,
        brandColor: project.interactiveSettings?.brandColor ?? '#e84545',
        autoplay: true,
      },
      sceneGraph: project.sceneGraph,
      scenes: publishedScenes,
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

    const publishedUrl = `/v/${project.id}`

    return NextResponse.json({ publishedUrl, version })
  } catch (err: unknown) {
    console.error('Publish error:', err)
    const message = err instanceof Error ? err.message.replace(/[a-zA-Z0-9_\-]{20,}/g, '[REDACTED]').slice(0, 200) : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
