/**
 * SFX category chips for the Audio tab — browse is client-side ZzFX (see `sfx-zzfx-presets.ts`).
 * Remote Pixabay/Freesound “library” browse was removed; optional search still uses `/api/sfx`.
 */
export {
  SFX_LIBRARY_CATEGORIES,
  ZZFX_SFX_CATEGORIES,
  getZzfxCategory,
  getZzfxCategory as getSfxLibraryCategory,
  getZzfxPresetById,
  allZzfxPresetsFlat,
  type ZzfxSfxPreset,
  type ZzfxSfxCategory,
} from './sfx-zzfx-presets'
