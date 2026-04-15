/**
 * POST /api/mcp-tool — Execute a single agent tool and return the result.
 *
 * This endpoint is the backend for the MCP server. It loads world state,
 * executes a tool using the same handlers as the in-app agent, persists
 * changes, and returns the result.
 *
 * Body: { projectId, toolName, args }
 * Response: { success, content, data? }
 */

import { NextRequest, NextResponse } from 'next/server'
import type { Scene, GlobalStyle, SceneGraph } from '@/lib/types'
import type { WorldStateMutable } from '@/lib/agents/tool-executor'
import { executeTool } from '@/lib/agents/tool-executor'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { readProjectScenesFromTables, writeProjectScenesToTables } from '@/lib/db/project-scene-table'
import { readProjectSceneBlob } from '@/lib/db/project-scene-storage'
import { generateSceneHTML } from '@/lib/sceneTemplate'
import { resolveProjectDimensions } from '@/lib/dimensions'
import { resolveStyle } from '@/lib/styles/presets'
import fs from 'fs/promises'
import path from 'path'

export async function POST(req: NextRequest) {
  try {
    const { projectId, toolName, args } = await req.json()

    if (!projectId || !toolName) {
      return NextResponse.json({ error: 'projectId and toolName are required' }, { status: 400 })
    }

    // Load project
    const [project] = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Load scenes
    const tableBacked = await readProjectScenesFromTables(projectId)
    const blob = readProjectSceneBlob(project.description)
    const scenes: Scene[] = tableBacked?.scenes ?? blob.scenes ?? []

    const globalStyle: GlobalStyle = (project as any).globalStyle ?? {
      presetId: 'clean',
      fontOverride: null,
      bgColorOverride: null,
      paletteOverride: null,
      strokeColorOverride: null,
    }

    // Build world state
    const world: WorldStateMutable = {
      scenes: JSON.parse(JSON.stringify(scenes)), // deep clone
      globalStyle: JSON.parse(JSON.stringify(globalStyle)),
      projectName: project.name ?? 'Untitled',
      projectId,
      outputMode: (project as any).outputMode ?? 'interactive',
      sceneGraph: (project as any).sceneGraph ?? { nodes: [], edges: [] },
      apiPermissions: (project as any).apiPermissions ?? {},
      audioProviderEnabled: (project as any).audioProviderEnabled ?? {},
      mediaGenEnabled: (project as any).mediaGenEnabled ?? {},
      sessionPermissions: {},
      zdogLibrary: (project as any).zdogLibrary ?? [],
      timeline: (project as any).timeline ?? null,
      mp4Settings: (project as any).mp4Settings ?? undefined,
    }

    // Execute tool
    const result = await executeTool(toolName, args ?? {}, world)

    // Persist scene changes if successful
    if (result.success) {
      // Write updated scenes back
      try {
        await writeProjectScenesToTables(projectId, world.scenes, world.sceneGraph)
      } catch (e) {
        console.error('[mcp-tool] Failed to persist scenes to tables:', e)
      }

      // Write HTML files for affected scenes
      if (result.affectedSceneId) {
        const scene = world.scenes.find((s) => s.id === result.affectedSceneId)
        if (scene) {
          try {
            const resolved = resolveStyle(world.globalStyle.presetId, world.globalStyle)
            const html = generateSceneHTML(scene, world.globalStyle, undefined, undefined, resolveProjectDimensions(world.mp4Settings?.aspectRatio, world.mp4Settings?.resolution))
            const scenesDir = path.join(process.cwd(), 'public', 'scenes')
            await fs.mkdir(scenesDir, { recursive: true })
            await fs.writeFile(path.join(scenesDir, `${scene.id}.html`), html, 'utf-8')
          } catch (e) {
            console.error('[mcp-tool] Failed to write scene HTML:', e)
          }
        }
      }

      // Persist global style if changed
      if (result.changes?.some((c) => c.type === 'global_updated')) {
        try {
          await db
            .update(schema.projects)
            .set({ globalStyle: world.globalStyle } as any)
            .where(eq(schema.projects.id, projectId))
        } catch (e) {
          console.error('[mcp-tool] Failed to persist global style:', e)
        }
      }
    }

    // Format response
    const parts: string[] = []
    if (result.changes?.length) {
      parts.push(result.changes.map((c) => c.description).join('; '))
    }
    if (result.data) {
      parts.push(JSON.stringify(result.data, null, 2))
    }

    return NextResponse.json({
      success: result.success,
      content: result.success
        ? parts.join('\n\n') || 'Done'
        : result.error ?? 'Tool execution failed',
      data: result.data,
      affectedSceneId: result.affectedSceneId,
      permissionNeeded: result.permissionNeeded,
    })
  } catch (err: any) {
    console.error('[mcp-tool] Error:', err)
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 })
  }
}
