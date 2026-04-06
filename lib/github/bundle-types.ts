/**
 * Cench Project Bundle — v1 format
 *
 * Portable, versioned representation of a project's creative content.
 * Designed for GitHub export/import. Postgres remains source of truth
 * for the hosted product (users, IDs, permissions, billing).
 *
 * Included:  everything needed to reconstruct timeline + scenes.
 * Excluded:  apiPermissions, userId, billing, ephemeral agent state,
 *            pausedAgentRun, runCheckpoint, session-specific config.
 */

import type {
  Scene, SceneGraph, GlobalStyle, AudioSettings,
  Timeline,
} from '@/lib/types'

// ── Bundle root ─────────────────────────────────────────────────────────────

export const BUNDLE_FORMAT_VERSION = 1

export interface CenchBundle {
  /** Always 1 for this version of the format. */
  formatVersion: typeof BUNDLE_FORMAT_VERSION

  /** ISO 8601 timestamp of when the bundle was created. */
  exportedAt: string

  /** Project-level metadata and settings. */
  project: BundleProject

  /** Ordered scene list with full content (code, overlays, layers, interactions). */
  scenes: BundleScene[]

  /** Scene graph for interactive projects (edges, nodes, start scene). */
  sceneGraph: SceneGraph

  /** Asset manifest — references to media files used by the project. */
  assets: BundleAsset[]

  /** NLE timeline (if the project uses clip-based editing). */
  timeline: Timeline | null

  /** Zdog character library (if any). */
  zdogLibrary?: unknown[]

  /** Zdog studio shape library (if any). */
  zdogStudioLibrary?: unknown[]
}

// ── Project metadata ────────────────────────────────────────────────────────

export interface BundleProject {
  /** Original project ID (for debugging / linking, not used on import). */
  originId: string

  name: string
  outputMode: 'mp4' | 'interactive'
  globalStyle: GlobalStyle

  mp4Settings: {
    resolution: '720p' | '1080p' | '4k'
    fps: 24 | 30 | 60
    format: 'mp4' | 'webm'
  }

  interactiveSettings: {
    playerTheme: 'dark' | 'light' | 'transparent'
    showProgressBar: boolean
    showSceneNav: boolean
    allowFullscreen: boolean
    brandColor: string
    customDomain: string | null
    password: string | null
  }

  audioSettings: AudioSettings
  audioProviderEnabled: Record<string, boolean>
  mediaGenEnabled: Record<string, boolean>

  watermark: {
    assetId: string
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    opacity: number
    sizePercent: number
  } | null
}

// ── Scene ───────────────────────────────────────────────────────────────────

export interface BundleScene {
  /**
   * Full Scene object as stored in the editor's Zustand state.
   * Contains all code (svgContent, canvasCode, sceneCode, etc.),
   * overlays, interactions, AI layers, audio, video layer, etc.
   *
   * Using the full Scene type rather than cherry-picking fields
   * ensures round-trip fidelity and avoids version drift between
   * the bundle schema and the editor's internal types.
   */
  scene: Scene

  /** Position in the scene list (0-indexed). */
  position: number
}

// ── Asset manifest ──────────────────────────────────────────────────────────

export interface BundleAsset {
  /** Original asset ID (for linking scene references). */
  id: string

  filename: string
  type: 'image' | 'video' | 'svg'
  mimeType: string
  sizeBytes: number
  width: number | null
  height: number | null
  durationSeconds: number | null
  name: string
  tags: string[]

  /**
   * When true, the file is embedded in the bundle under assets/<id>/<filename>.
   * When false, only the publicUrl is stored (re-download on import).
   */
  embedded: boolean

  /**
   * Public URL for the asset. Present when the asset lives on a CDN.
   * On import, if embedded=false, this URL is used to fetch the asset.
   */
  publicUrl: string | null

  /**
   * Relative path within the bundle (e.g. "assets/abc123/photo.png").
   * Only present when embedded=true.
   */
  bundlePath: string | null
}

// ── File layout in the repo ─────────────────────────────────────────────────
//
//   cench/
//     project.json          — BundleProject + metadata
//     scenes.json           — BundleScene[] (v1: single file for simplicity)
//     scene-graph.json      — SceneGraph
//     assets.json           — BundleAsset[] manifest
//     assets/               — embedded binary files (optional)
//       <assetId>/
//         <filename>
