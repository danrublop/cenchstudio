/**
 * Pure functions for converting between CenchBundle and the file layout
 * used in a GitHub repo. No database or server dependencies.
 */

import type { CenchBundle } from './bundle-types'

/**
 * Split a CenchBundle into the file layout used in a GitHub repo:
 *   cench/project.json
 *   cench/scenes.json
 *   cench/scene-graph.json
 *   cench/assets.json
 */
export function bundleToFiles(bundle: CenchBundle): Map<string, string> {
  const files = new Map<string, string>()

  // project.json — metadata + settings
  files.set('cench/project.json', JSON.stringify({
    formatVersion: bundle.formatVersion,
    exportedAt: bundle.exportedAt,
    project: bundle.project,
    timeline: bundle.timeline,
    zdogLibrary: bundle.zdogLibrary,
    zdogStudioLibrary: bundle.zdogStudioLibrary,
  }, null, 2))

  // scenes.json — ordered scene list
  files.set('cench/scenes.json', JSON.stringify(bundle.scenes, null, 2))

  // scene-graph.json — graph edges and nodes
  files.set('cench/scene-graph.json', JSON.stringify(bundle.sceneGraph, null, 2))

  // assets.json — asset manifest
  files.set('cench/assets.json', JSON.stringify(bundle.assets, null, 2))

  return files
}

/**
 * Reconstruct a CenchBundle from the individual JSON files
 * (as stored in a GitHub repo under cench/).
 */
export function filesToBundle(files: Map<string, string>): CenchBundle {
  const projectJson = files.get('cench/project.json')
  const scenesJson = files.get('cench/scenes.json')
  const graphJson = files.get('cench/scene-graph.json')
  const assetsJson = files.get('cench/assets.json')

  if (!projectJson) throw new Error('Missing cench/project.json')
  if (!scenesJson) throw new Error('Missing cench/scenes.json')
  if (!graphJson) throw new Error('Missing cench/scene-graph.json')

  const projectData = JSON.parse(projectJson)
  const scenes = JSON.parse(scenesJson)
  const sceneGraph = JSON.parse(graphJson)
  const assets = assetsJson ? JSON.parse(assetsJson) : []

  return {
    formatVersion: projectData.formatVersion,
    exportedAt: projectData.exportedAt,
    project: projectData.project,
    scenes,
    sceneGraph,
    assets,
    timeline: projectData.timeline ?? null,
    zdogLibrary: projectData.zdogLibrary,
    zdogStudioLibrary: projectData.zdogStudioLibrary,
  }
}
