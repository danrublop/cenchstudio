import { describe, expect, it } from 'vitest'
import { applyPostFxToSceneCode, applyStageEnvToSceneCode } from './three-postfx-patch'

const BASE_SCENE = `
import * as THREE from 'three';
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(WIDTH, HEIGHT);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, WIDTH / HEIGHT, 0.1, 1000);
camera.position.set(0, 4, 10);

window.__tl.to({}, {
  duration: DURATION,
  onUpdate() {
    renderer.render(scene, camera);
  },
}, 0);
renderer.render(scene, camera);
`

describe('applyPostFxToSceneCode', () => {
  it('inserts createCenchPostFX and rewrites render calls for a preset', () => {
    const { code, summary } = applyPostFxToSceneCode(BASE_SCENE, 'cinematic')
    expect(code).toContain('const fx = window.createCenchPostFX(')
    expect(code).toContain('window.CENCH_POSTFX_PRESETS && window.CENCH_POSTFX_PRESETS["cinematic"]')
    expect(code).toContain('fx.render()')
    expect(code).not.toMatch(/^\s*renderer\.render\(scene, camera\)/m)
    expect(summary).toMatch(/cinematic/)
    expect(summary).toMatch(/2 render calls rewritten/)
  })

  it('supports custom preset with explicit opts', () => {
    const { code } = applyPostFxToSceneCode(BASE_SCENE, 'custom', { bloom: { strength: 0.6 }, filmGrain: true })
    expect(code).toContain('const fx = window.createCenchPostFX(')
    expect(code).toContain('"bloom":{"strength":0.6}')
    expect(code).toContain('"filmGrain":true')
  })

  it('merges custom opts on top of preset when both are provided', () => {
    const { code } = applyPostFxToSceneCode(BASE_SCENE, 'cinematic', { bloom: { strength: 0.9 } })
    expect(code).toContain(
      'Object.assign({}, (window.CENCH_POSTFX_PRESETS && window.CENCH_POSTFX_PRESETS["cinematic"])',
    )
    expect(code).toContain('"bloom":{"strength":0.9}')
  })

  it('updates an existing fx wiring instead of duplicating', () => {
    const once = applyPostFxToSceneCode(BASE_SCENE, 'bloom').code
    const twice = applyPostFxToSceneCode(once, 'cyberpunk').code
    const occurrences = twice.match(/createCenchPostFX\(/g) || []
    expect(occurrences.length).toBe(1)
    expect(twice).toContain('"cyberpunk"')
    expect(twice).not.toContain('"bloom"]')
  })
})

describe('applyStageEnvToSceneCode', () => {
  it('inserts an env call when none exists', () => {
    const { code, summary } = applyStageEnvToSceneCode(BASE_SCENE, 'studio_white')
    expect(code).toContain('window.applyCenchThreeEnvironment("studio_white", scene, renderer, camera)')
    expect(summary).toMatch(/Inserted stage environment/)
  })

  it('swaps an existing env call in place', () => {
    const first = applyStageEnvToSceneCode(BASE_SCENE, 'tech_grid').code
    const second = applyStageEnvToSceneCode(first, 'cinematic_fog')
    expect(second.code).toContain('"cinematic_fog"')
    expect(second.code).not.toContain('"tech_grid"')
    expect((second.code.match(/applyCenchThreeEnvironment\(/g) || []).length).toBe(1)
    expect(second.summary).toMatch(/Swapped/)
  })
})
