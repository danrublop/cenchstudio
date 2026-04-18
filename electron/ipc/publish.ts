import type { IpcMain } from 'electron'
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import type { PublishedProject, PublishedScene } from '@/lib/types'
import { normalizeTransition } from '@/lib/transitions'
import { loadProjectOrThrow, IpcValidationError } from './_helpers'

/**
 * Category: publish
 *
 * Replaces: POST /api/publish — writes a `published/<projectId>/` bundle
 * under `public/` (dev) or `<userData>/published/` (packaged). Copies
 * scene HTML files from the scenes dir, copies uploads, writes a
 * `manifest.json` consumed by the `/v/[projectId]` viewer.
 *
 * The published viewer (`app/v/[projectId]/page.tsx`) is an explicitly
 * web-only surface — Electron users will publish from desktop and share
 * the resulting URL, which is served by whatever HTTP host renders the
 * published viewer (not the desktop app itself). That's why this IPC
 * just writes files; the desktop app doesn't serve them.
 */

// Use the userData directory when packaged, dev public/ when not. Same
// convention as projects.remove cleanup.
function scenesSourceDir(): string {
  return app.isPackaged ? path.join(app.getPath('userData'), 'scenes') : path.join(process.cwd(), 'public', 'scenes')
}

function publishBase(): string {
  return app.isPackaged
    ? path.join(app.getPath('userData'), 'published')
    : path.join(process.cwd(), 'public', 'published')
}

function uploadsDir(): string {
  return app.isPackaged ? path.join(app.getPath('userData'), 'uploads') : path.join(process.cwd(), 'public', 'uploads')
}

type PublishArgs = {
  project: {
    id: string
    name?: string
    interactiveSettings?: {
      playerTheme?: 'dark' | 'light'
      showProgressBar?: boolean
      showSceneNav?: boolean
      allowFullscreen?: boolean
      brandColor?: string
    }
    sceneGraph: PublishedProject['sceneGraph']
  }
  scenes: Array<{
    id: string
    sceneType?: string
    duration: number
    interactions?: unknown[]
    variables?: unknown[]
    transition?: unknown
  }>
  globalStyle?: unknown
}

async function publish(args: PublishArgs) {
  if (!args.project?.id || !args.scenes?.length) {
    throw new IpcValidationError('Missing project or scenes')
  }
  await loadProjectOrThrow(args.project.id)

  const publishDir = path.join(publishBase(), args.project.id)
  const scenesDir = path.join(publishDir, 'scenes')
  const assetsDir = path.join(publishDir, 'assets')
  await fs.mkdir(scenesDir, { recursive: true })
  await fs.mkdir(assetsDir, { recursive: true })

  const publishedScenes: PublishedScene[] = []
  const missingSceneIds: string[] = []
  const srcScenesDir = scenesSourceDir()

  for (const scene of args.scenes) {
    const srcPath = path.join(srcScenesDir, `${scene.id}.html`)
    const destPath = path.join(scenesDir, `${scene.id}.html`)
    try {
      await fs.access(srcPath)
    } catch {
      console.warn(`[publish] Scene HTML missing: ${scene.id}.html`)
      missingSceneIds.push(scene.id)
      continue
    }
    try {
      await fs.copyFile(srcPath, destPath)
    } catch (e) {
      console.error(`[publish] Failed to copy scene HTML for ${scene.id}:`, e)
      missingSceneIds.push(scene.id)
      continue
    }
    publishedScenes.push({
      id: scene.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: (scene.sceneType ?? 'svg') as any,
      duration: scene.duration,
      htmlUrl: `/published/${args.project.id}/scenes/${scene.id}.html`,
      htmlContent: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      interactions: (scene.interactions ?? []) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      variables: (scene.variables ?? []) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transition: normalizeTransition(scene.transition as any),
    })
  }

  if (missingSceneIds.length > 0) {
    throw new IpcValidationError(
      `Failed to publish: ${missingSceneIds.length} scene(s) are missing HTML files. Regenerate them and try again.`,
    )
  }

  // Copy flat upload files (best-effort; used to rewrite asset URLs to
  // `/published/<projectId>/assets/*` in the manifest consumer).
  const uploads = uploadsDir()
  if (fsSync.existsSync(uploads)) {
    try {
      const files = await fs.readdir(uploads)
      for (const file of files) {
        const src = path.join(uploads, file)
        const dest = path.join(assetsDir, file)
        try {
          const stat = await fs.stat(src)
          if (stat.isFile()) await fs.copyFile(src, dest)
        } catch {}
      }
    } catch (e) {
      console.warn('[publish] uploads copy failed:', e)
    }
  }

  // Read existing manifest to carry the version forward.
  const manifestPath = path.join(publishDir, 'manifest.json')
  let version = 1
  try {
    const existing = JSON.parse(await fs.readFile(manifestPath, 'utf-8'))
    version = (existing.version ?? 0) + 1
  } catch {
    // no prior publish, leave version at 1
  }

  const manifest: PublishedProject = {
    id: args.project.id,
    version,
    name: args.project.name || 'Untitled Project',
    playerOptions: {
      theme: args.project.interactiveSettings?.playerTheme ?? 'dark',
      showProgressBar: args.project.interactiveSettings?.showProgressBar ?? true,
      showSceneNav: args.project.interactiveSettings?.showSceneNav ?? false,
      allowFullscreen: args.project.interactiveSettings?.allowFullscreen ?? true,
      brandColor: args.project.interactiveSettings?.brandColor ?? '#e84545',
      autoplay: true,
    },
    sceneGraph: args.project.sceneGraph,
    scenes: publishedScenes,
  }

  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2))
  return { publishedUrl: `/v/${args.project.id}`, version }
}

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('cench:publish.run', (_e, args: PublishArgs) => publish(args))
}
