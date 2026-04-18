import type { IpcMain } from 'electron'
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { generateSceneHTML } from '@/lib/sceneTemplate'
import { resolveProjectDimensions } from '@/lib/dimensions'
import { readProjectSceneBlob } from '@/lib/db/project-scene-storage'
import { readProjectScenesFromTables } from '@/lib/db/project-scene-table'
import { assertValidUuid, loadProjectOrThrow, IpcValidationError, IpcNotFoundError } from './_helpers'

/**
 * Category: scene
 *
 * Replaces the renderer-visible subset of the 576-line `app/api/scene/route.ts`:
 *
 *   POST /api/scene (Mode 2, id+html)       → scene.writeHtml({id, html})
 *   GET  /api/scene?projectId&sceneId       → scene.get({projectId, sceneId})
 *   POST /api/scene/generate-world          → scene.generateWorld({scene, ...})
 *
 * Deliberately deferred:
 *
 * - POST /api/scene (Mode 1: SDK scene create with projectId+type+code) — only
 *   the MCP server and the in-Next.js agent call this. They'll hit the Electron
 *   IPC directly in Week 3 when the agent migrates out of Next.
 *
 * - PATCH /api/scene — same audience (MCP + agent). 576-line route with
 *   scene-type-specific code parsing; not worth reimplementing until the
 *   agent comes over.
 *
 * - GET /api/scene?projectId (list without sceneId) — no renderer caller,
 *   the editor loads scenes via the project's own `loadProject` flow.
 *
 * - /api/verify-scene — zero renderer callers; agent-tool-handler target.
 */

// ── Filesystem roots ────────────────────────────────────────────────────────
// In dev, scene HTML lives under `<repo>/public/scenes/*.html` so Next can
// serve it. In packaged Electron, the bundle is read-only, so scenes live
// under `<userData>/scenes/` and the `cench://scenes/*` protocol handler
// resolves them at runtime. Both projects.ts and publish.ts use the same
// convention; shared helper below.
function resolveScenesDir(): string {
  return app.isPackaged ? path.join(app.getPath('userData'), 'scenes') : path.join(process.cwd(), 'public', 'scenes')
}

const SCENE_ID_RE = /^[a-zA-Z0-9_-]+$/
const MAX_HTML_BYTES = 5 * 1024 * 1024 // match the old route's limit

type WriteHtmlArgs = { id: string; html: string }

async function writeHtml(args: WriteHtmlArgs): Promise<{ success: true; path: string }> {
  if (!SCENE_ID_RE.test(args.id)) {
    throw new IpcValidationError('invalid scene id')
  }
  if (typeof args.html !== 'string') {
    throw new IpcValidationError('html must be a string')
  }
  if (args.html.length > MAX_HTML_BYTES) {
    throw new IpcValidationError('HTML body exceeds 5MB limit')
  }

  const scenesDir = resolveScenesDir()
  await fs.mkdir(scenesDir, { recursive: true })
  const destPath = path.resolve(path.join(scenesDir, `${args.id}.html`))
  // Defense in depth against a hand-crafted id matching SCENE_ID_RE but
  // resolving outside the scenes directory (shouldn't be possible given
  // the charset, but `..` passes the regex if someone widens it).
  if (!destPath.startsWith(scenesDir + path.sep)) {
    throw new IpcValidationError('Invalid scene id (path escape)')
  }
  await fs.writeFile(destPath, args.html, 'utf-8')
  return { success: true as const, path: `/scenes/${args.id}.html` }
}

type GetArgs = { projectId: string; sceneId: string }

async function get(args: GetArgs) {
  assertValidUuid(args.projectId, 'projectId')
  assertValidUuid(args.sceneId, 'sceneId')
  await loadProjectOrThrow(args.projectId)

  const [project] = await db
    .select({ description: schema.projects.description })
    .from(schema.projects)
    .where(eq(schema.projects.id, args.projectId))
    .limit(1)
  if (!project) throw new IpcNotFoundError(`Project ${args.projectId} not found`)

  const tableBacked = await readProjectScenesFromTables(args.projectId)
  const scenes = tableBacked?.scenes ?? readProjectSceneBlob(project.description).scenes

  const scene = (scenes as Array<{ id: string }>).find((s) => s.id === args.sceneId)
  if (!scene) {
    throw new IpcNotFoundError(`Scene ${args.sceneId} not found`)
  }
  return { scene }
}

type GenerateWorldArgs = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scene: { id: string; worldConfig: unknown; globalStyle?: any } & Record<string, unknown>
  aspectRatio?: string
  resolution?: string
}

async function generateWorld(args: GenerateWorldArgs): Promise<{ success: true; path: string }> {
  if (!args.scene?.id || !args.scene?.worldConfig) {
    throw new IpcValidationError('scene with worldConfig required')
  }
  if (!SCENE_ID_RE.test(args.scene.id)) {
    throw new IpcValidationError('invalid scene id')
  }

  const html = generateSceneHTML(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args.scene as any,
    args.scene.globalStyle ?? undefined,
    undefined,
    undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolveProjectDimensions(args.aspectRatio as any, args.resolution as any),
  )

  const scenesDir = resolveScenesDir()
  await fs.mkdir(scenesDir, { recursive: true })
  const destPath = path.resolve(path.join(scenesDir, `${args.scene.id}.html`))
  if (!destPath.startsWith(scenesDir + path.sep)) {
    throw new IpcValidationError('Invalid scene id (path escape)')
  }
  await fs.writeFile(destPath, html, 'utf-8')
  return { success: true as const, path: `/scenes/${args.scene.id}.html` }
}

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('cench:scene.writeHtml', (_e, args: WriteHtmlArgs) => writeHtml(args))
  ipcMain.handle('cench:scene.get', (_e, args: GetArgs) => get(args))
  ipcMain.handle('cench:scene.generateWorld', (_e, args: GenerateWorldArgs) => generateWorld(args))
}
