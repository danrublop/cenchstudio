import { describe, expect, it } from 'vitest'
import { THREE_SYSTEM_PROMPT } from './prompts'

const PALETTE = ['#1a1a2e', '#e84545', '#16a34a', '#2563eb']
const BG = '#fffef9'
const DURATION = 8

describe('THREE_SYSTEM_PROMPT', () => {
  const prompt = THREE_SYSTEM_PROMPT(PALETTE, BG, DURATION, '')

  it('documents the new cookbook sections', () => {
    expect(prompt).toContain('POST-FX COOKBOOK')
    expect(prompt).toContain('POSTFX PRESETS')
    expect(prompt).toContain('SCENE BUILDERS')
    expect(prompt).toContain('ADVANCED / OPT-IN')
  })

  it('exposes new helper globals in the globals list', () => {
    const mustHave = [
      'createCenchPostFX',
      'createCenchPostFXPreset',
      'CENCH_POSTFX_PRESETS',
      'CENCH_TONE_MAPS',
      'addCinematicLighting',
      'addGroundPlane',
      'loadPBRSet',
      'loadHDREnvironment',
      'createInstancedField',
      'createPositionalAudio',
    ]
    for (const name of mustHave) {
      expect(prompt).toContain(name)
    }
  })

  it('boilerplate uses CENCH_TONE_MAPS.aces', () => {
    expect(prompt).toContain('renderer.toneMapping = CENCH_TONE_MAPS.aces')
  })

  it('stays within the prompt budget (hard ceiling 28000 chars / ~7k tokens)', () => {
    // Post-expansion target: ~26k chars (~6.5k input tokens). The cookbook
    // sections are the main cost and they materially improve output quality.
    // 28000 is the regression guard — fail if future edits push it higher.
    expect(prompt.length).toBeLessThan(28000)
  })

  it('still mentions every registered stage environment id', () => {
    const ids = [
      'studio_white',
      'cinematic_fog',
      'iso_playful',
      'tech_grid',
      'nature_sunset',
      'data_lab',
      'track_rolling_topdown',
    ]
    for (const id of ids) {
      expect(prompt).toContain(id)
    }
  })
})
