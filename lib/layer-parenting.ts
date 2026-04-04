/**
 * Layer parenting — timing inheritance and hierarchy utilities.
 */

import type { SceneLayer } from './types'

/**
 * Compute the absolute startAt for a layer, walking up the parent chain.
 */
export function getAbsoluteStartAt(layer: SceneLayer, allLayers: SceneLayer[]): number {
  if (!layer.parentLayerId) return layer.startAt
  const parent = allLayers.find((l) => l.id === layer.parentLayerId)
  if (!parent) return layer.startAt
  return getAbsoluteStartAt(parent, allLayers) + layer.startAt
}

/**
 * Check if setting parentLayerId would create a cycle.
 */
export function wouldCreateCycle(childId: string, parentId: string, allLayers: SceneLayer[]): boolean {
  let current = parentId
  const visited = new Set<string>()
  while (current) {
    if (current === childId) return true
    if (visited.has(current)) return true // already a cycle
    visited.add(current)
    const layer = allLayers.find((l) => l.id === current)
    if (!layer?.parentLayerId) break
    current = layer.parentLayerId
  }
  return false
}

/**
 * Get child layers of a given parent.
 */
export function getChildLayers(parentId: string, allLayers: SceneLayer[]): SceneLayer[] {
  return allLayers.filter((l) => l.parentLayerId === parentId)
}

/**
 * Get root layers (no parent).
 */
export function getRootLayers(allLayers: SceneLayer[]): SceneLayer[] {
  return allLayers.filter((l) => !l.parentLayerId)
}

/**
 * Build a flat display list with indentation levels for hierarchy rendering.
 */
export function buildLayerHierarchy(allLayers: SceneLayer[]): Array<{ layer: SceneLayer; depth: number }> {
  const result: Array<{ layer: SceneLayer; depth: number }> = []

  function addLayer(layer: SceneLayer, depth: number) {
    result.push({ layer, depth })
    const children = getChildLayers(layer.id, allLayers).sort((a, b) => a.startAt - b.startAt)
    for (const child of children) {
      addLayer(child, depth + 1)
    }
  }

  const roots = getRootLayers(allLayers).sort((a, b) => a.zIndex - b.zIndex)
  for (const root of roots) {
    addLayer(root, 0)
  }

  return result
}

/**
 * When deleting a parent, promote children to root layers
 * with their absolute startAt preserved.
 */
export function promoteChildrenOnDelete(parentId: string, allLayers: SceneLayer[]): SceneLayer[] {
  return allLayers.map((layer) => {
    if (layer.parentLayerId === parentId) {
      return {
        ...layer,
        parentLayerId: null,
        startAt: getAbsoluteStartAt(layer, allLayers),
      }
    }
    return layer
  })
}

/**
 * Check if a layer is active at a given time (accounting for parent timing).
 */
export function isLayerActiveAtTime(
  layer: SceneLayer,
  time: number,
  allLayers: SceneLayer[],
  sceneDuration: number,
): boolean {
  const absStart = getAbsoluteStartAt(layer, allLayers)
  const end = layer.duration !== null ? absStart + layer.duration : sceneDuration
  return time >= absStart && time <= end
}
