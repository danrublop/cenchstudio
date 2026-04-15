import type { SFXResult } from './types'
import type { SFXProvider } from '../types'

export interface SfxLocalSoundEntry {
  id: string
  name: string
  /** Path under public/sfx-library/, e.g. impacts/12345.mp3 */
  file: string
  license: string
  duration: number | null
  /** Where the file was fetched from (metadata only) */
  sourceProvider?: 'pixabay' | 'freesound'
  /**
   * In-repo bundled audio: `zzfx` from `npm run sfx-library:zzfx`;
   * `soloud` — [SoLoud](https://github.com/jarikomppa/soloud) (zlib/libpng);
   * `react-sounds` — files from / generated like [react-sounds](https://github.com/e3ntity/react-sounds) (MIT).
   */
  librarySource?: 'zzfx' | 'soloud' | 'react-sounds'
}

/** Auto-generated ZzFX pack entries (replaced when re-running `npm run sfx-library:zzfx`). */
export function isBundledZzfxSound(s: SfxLocalSoundEntry): boolean {
  return s.librarySource === 'zzfx' || s.file.includes('/zzfx-') || s.id.startsWith('zzfx-')
}

/** SoLoud-sourced bundled rows (preserved across ZzFX rebuild and `sfx-library:fetch`). */
export function isBundledSoloudSound(s: SfxLocalSoundEntry): boolean {
  return s.librarySource === 'soloud' || s.file.includes('/soloud-') || s.id.startsWith('soloud-')
}

/** react-sounds library clips vendored under `public/sfx-library/` (same preservation rules). */
export function isBundledReactSoundsSound(s: SfxLocalSoundEntry): boolean {
  return (
    s.librarySource === 'react-sounds' ||
    s.file.includes('/react-sounds-') ||
    s.id.startsWith('react-sounds-')
  )
}

/** All bundled library rows to prepend when re-fetching remote SFX. */
export function isBundledLibrarySound(s: SfxLocalSoundEntry): boolean {
  return isBundledZzfxSound(s) || isBundledSoloudSound(s) || isBundledReactSoundsSound(s)
}

export interface SfxLocalCategory {
  id: string
  label: string
  sounds: SfxLocalSoundEntry[]
}

export interface SfxLocalManifest {
  version: number
  generatedAt?: string
  categories: SfxLocalCategory[]
}

export function manifestSoundToResult(entry: SfxLocalSoundEntry): SFXResult {
  const base = `/sfx-library/${entry.file}`.replace(/\/+/g, '/')
  return {
    id: entry.id,
    name: entry.name,
    audioUrl: base,
    previewUrl: base,
    duration: entry.duration,
    license: entry.license,
    provider: 'local',
  }
}

export function getLocalSoundsForCategory(manifest: SfxLocalManifest | null, categoryId: string): SFXResult[] {
  if (!manifest?.categories?.length) return []
  const cat = manifest.categories.find((c) => c.id === categoryId)
  if (!cat?.sounds?.length) return []
  return cat.sounds.map(manifestSoundToResult)
}

export function countLocalSounds(manifest: SfxLocalManifest | null): number {
  if (!manifest?.categories) return 0
  return manifest.categories.reduce((n, c) => n + (c.sounds?.length ?? 0), 0)
}
