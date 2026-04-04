/**
 * Filter factory for clip visual effects.
 *
 * Maps ClipFilter configs to Pixi.js filter instances.
 * Supports: blur, brightness, contrast, saturate, grayscale,
 * sepia, hue-rotate, invert, color-temperature, drop-shadow.
 *
 * Also maps blend mode strings to Pixi blend mode constants.
 */

import { BlurFilter, ColorMatrixFilter, AlphaFilter, NoiseFilter, type Filter } from 'pixi.js'
import type { ClipFilter } from '../types'

/**
 * Create a Pixi filter from a ClipFilter config.
 * Returns null if the filter type is unrecognized.
 */
export function createPixiFilter(config: ClipFilter): Filter | null {
  switch (config.type) {
    case 'blur': {
      const f = new BlurFilter()
      f.blur = Math.max(0, config.value)
      return f as unknown as Filter
    }

    case 'brightness': {
      const f = new ColorMatrixFilter()
      f.brightness(Math.max(0, config.value), false)
      return f as unknown as Filter
    }

    case 'contrast': {
      const f = new ColorMatrixFilter()
      f.contrast(Math.max(0, config.value), false)
      return f as unknown as Filter
    }

    case 'saturate': {
      const f = new ColorMatrixFilter()
      f.saturate(Math.max(0, config.value), false)
      return f as unknown as Filter
    }

    case 'grayscale': {
      const f = new ColorMatrixFilter()
      f.greyscale(Math.max(0, Math.min(1, config.value)), false)
      return f as unknown as Filter
    }

    case 'sepia': {
      const f = new ColorMatrixFilter()
      f.sepia(false)
      // Scale the effect by the value (0 = none, 1 = full sepia)
      if (config.value < 1) {
        // Blend between identity and sepia by interpolating the matrix
        const identity = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0]
        const sepiaMatrix = [...f.matrix]
        const v = Math.max(0, Math.min(1, config.value))
        for (let i = 0; i < 20; i++) {
          f.matrix[i] = identity[i] + (sepiaMatrix[i] - identity[i]) * v
        }
      }
      return f as unknown as Filter
    }

    case 'hue-rotate': {
      const f = new ColorMatrixFilter()
      f.hue(config.value, false) // value in degrees
      return f as unknown as Filter
    }

    default:
      return null
  }
}

/**
 * Create an array of Pixi filters from clip filter configs.
 * Skips any unrecognized filter types.
 */
export function createPixiFilters(configs: ClipFilter[]): Filter[] {
  const filters: Filter[] = []
  for (const config of configs) {
    const f = createPixiFilter(config)
    if (f) filters.push(f)
  }
  return filters
}

/**
 * Map a blend mode string to a Pixi blend mode value.
 * Pixi 8 uses string-based blend modes.
 */
export function resolveBlendMode(mode: string | undefined): string {
  switch (mode) {
    case 'normal':
      return 'normal'
    case 'multiply':
      return 'multiply'
    case 'screen':
      return 'screen'
    case 'overlay':
      return 'overlay'
    case 'darken':
      return 'darken'
    case 'lighten':
      return 'lighten'
    case 'color-dodge':
      return 'color-dodge'
    case 'color-burn':
      return 'color-burn'
    case 'hard-light':
      return 'hard-light'
    case 'soft-light':
      return 'soft-light'
    case 'difference':
      return 'difference'
    case 'exclusion':
      return 'exclusion'
    case 'add':
      return 'add'
    case 'subtract':
      return 'subtract'
    case 'luminosity':
      return 'luminosity'
    case 'saturation':
      return 'saturation'
    default:
      return 'normal'
  }
}

/** All supported blend mode names for tool enum validation */
export const BLEND_MODE_NAMES = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
  'add',
  'subtract',
  'luminosity',
  'saturation',
] as const

/** All supported filter type names for tool enum validation */
export const FILTER_TYPE_NAMES = [
  'blur',
  'brightness',
  'contrast',
  'saturate',
  'grayscale',
  'sepia',
  'hue-rotate',
] as const
