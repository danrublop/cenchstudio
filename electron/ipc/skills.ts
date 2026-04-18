import type { IpcMain } from 'electron'
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { IpcValidationError, IpcNotFoundError } from './_helpers'

/**
 * Category: skills
 *
 * Replaces: GET /api/skills?source=cench&file=SKILL.md
 *
 * Reads markdown skill files from two bundled trees:
 *   .claude/skills/cench     → agent orchestration skills (cench mode)
 *   lib/skills/library       → templated examples for the skill builder UI
 *
 * In dev (`npm run dev:electron`) these sit at their repo-relative paths.
 * For the packaged app both directories must be copied as `extraResources`
 * — see `package.json > build.extraResources` and resolve from
 * `process.resourcesPath`. Path traversal is blocked by normalizing the
 * resolved absolute path against the allowed root.
 */

function getSkillRoots(): Record<string, string> {
  if (app.isPackaged) {
    const base = path.join(process.resourcesPath, 'skill-data')
    return {
      cench: path.join(base, 'cench'),
      library: path.join(base, 'library'),
    }
  }
  const repoRoot = path.resolve(__dirname, '..')
  return {
    cench: path.join(repoRoot, '.claude/skills/cench'),
    library: path.join(repoRoot, 'lib/skills/library'),
  }
}

async function readSkillFile(args: { source: string; file: string }): Promise<{
  content: string
  file: string
  source: string
}> {
  if (!args.source || !args.file) {
    throw new IpcValidationError('source and file are required')
  }
  const roots = getSkillRoots()
  const root = roots[args.source]
  if (!root) {
    throw new IpcValidationError(`Unknown source: ${args.source}`)
  }

  const resolved = path.resolve(root, args.file)
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new IpcValidationError('Invalid file path (path traversal)')
  }

  // Parity with the `cench://` protocol handler: follow the symlink before
  // trusting the prefix. A skill file replaced with a link out to `/etc/
  // passwd` would otherwise leak arbitrary files through the renderer.
  let finalPath = resolved
  try {
    finalPath = await fs.realpath(resolved)
    if (!finalPath.startsWith(root + path.sep) && finalPath !== root) {
      throw new IpcValidationError('Invalid file path (symlink escape)')
    }
  } catch (err) {
    if (err instanceof IpcValidationError) throw err
    // realpath throws on missing files — treat as NotFound below.
  }

  try {
    const content = await fs.readFile(finalPath, 'utf-8')
    return { content, file: args.file, source: args.source }
  } catch {
    throw new IpcNotFoundError(`Skill file not found: ${args.source}/${args.file}`)
  }
}

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('cench:skills.readFile', (_e, args: { source: string; file: string }) => readSkillFile(args))
}
