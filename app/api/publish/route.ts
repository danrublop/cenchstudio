import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { PublishedProject, PublishedScene } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { project, scenes, globalStyle } = body

    if (!project?.id || !scenes?.length) {
      return NextResponse.json({ error: 'Missing project or scenes' }, { status: 400 })
    }

    const publishDir = path.join(process.cwd(), 'public', 'published', project.id)
    const scenesDir = path.join(publishDir, 'scenes')
    const assetsDir = path.join(publishDir, 'assets')

    // Create directories
    fs.mkdirSync(scenesDir, { recursive: true })
    fs.mkdirSync(assetsDir, { recursive: true })

    // Copy scene HTML files
    const publishedScenes: PublishedScene[] = []
    for (const scene of scenes) {
      const srcPath = path.join(process.cwd(), 'public', 'scenes', `${scene.id}.html`)
      const destPath = path.join(scenesDir, `${scene.id}.html`)

      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath)
      }

      publishedScenes.push({
        id: scene.id,
        type: scene.sceneType ?? 'svg',
        duration: scene.duration,
        htmlUrl: `/published/${project.id}/scenes/${scene.id}.html`,
        htmlContent: null,
        interactions: scene.interactions ?? [],
        variables: scene.variables ?? [],
        transition: scene.transition ?? 'none',
      })
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
      } catch {}
    }

    // Generate manifest
    const manifest: PublishedProject = {
      id: project.id,
      version,
      name: project.name || 'Untitled Project',
      playerOptions: {
        theme: project.interactiveSettings?.playerTheme ?? 'dark',
        showProgressBar: project.interactiveSettings?.showProgressBar ?? true,
        showSceneNav: project.interactiveSettings?.showSceneNav ?? true,
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
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
