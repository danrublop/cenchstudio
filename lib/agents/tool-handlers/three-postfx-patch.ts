/**
 * Pure string-rewriting helpers for the `apply_three_postfx` and
 * `set_three_stage_environment` agent tools. No side effects, no
 * framework imports — safe to unit-test in isolation.
 */

/** Swap `renderer.render(scene, camera)` calls for `fx.render()`. */
function rewriteRenderCallsToFx(code: string): { code: string; replaced: number } {
  const pattern = /(^|[^\w.])renderer\.render\s*\(\s*scene\s*,\s*camera\s*\)/g
  let replaced = 0
  const out = code.replace(pattern, (_m, prefix) => {
    replaced++
    return `${prefix}fx.render()`
  })
  return { code: out, replaced }
}

/** Insert a line of code after camera setup or renderer DOM append, falling back to prepend. */
function insertAfterCameraSetup(code: string, insertion: string): string {
  const camRegex = /(camera\.(?:position\.set|lookAt)\s*\([^)]*\)\s*;?)/
  const match = code.match(camRegex)
  if (match && match.index != null) {
    const end = match.index + match[0].length
    return code.slice(0, end) + '\n' + insertion + '\n' + code.slice(end)
  }
  const appendRegex = /(document\.body\.appendChild\s*\(\s*renderer\.domElement\s*\)\s*;?)/
  const match2 = code.match(appendRegex)
  if (match2 && match2.index != null) {
    const end = match2.index + match2[0].length
    return code.slice(0, end) + '\n' + insertion + '\n' + code.slice(end)
  }
  return insertion + '\n' + code
}

/** Patch sceneCode to wire up createCenchPostFX + replace render calls. */
export function applyPostFxToSceneCode(
  code: string,
  preset: string,
  custom?: Record<string, unknown>,
): { code: string; summary: string } {
  let opts: string
  if (preset === 'custom') {
    opts = JSON.stringify(custom ?? {})
  } else if (custom && Object.keys(custom).length > 0) {
    opts = `Object.assign({}, (window.CENCH_POSTFX_PRESETS && window.CENCH_POSTFX_PRESETS[${JSON.stringify(preset)}]) || {}, ${JSON.stringify(custom)})`
  } else {
    opts = `(window.CENCH_POSTFX_PRESETS && window.CENCH_POSTFX_PRESETS[${JSON.stringify(preset)}]) || {}`
  }

  const fxLine = `const fx = window.createCenchPostFX(renderer, scene, camera, ${opts});`

  let next = code
  if (/\bconst\s+fx\s*=\s*window\.createCenchPostFX\s*\(/.test(next)) {
    next = next.replace(/const\s+fx\s*=\s*window\.createCenchPostFX\s*\([^;]*;/m, fxLine)
  } else {
    next = insertAfterCameraSetup(next, fxLine)
  }

  const { code: swapped, replaced } = rewriteRenderCallsToFx(next)
  return {
    code: swapped,
    summary: `Applied post-fx preset "${preset}" (${replaced} render call${replaced === 1 ? '' : 's'} rewritten).`,
  }
}

/** Patch sceneCode to apply (or swap) a Cench stage environment. */
export function applyStageEnvToSceneCode(code: string, envId: string): { code: string; summary: string } {
  const call = `window.applyCenchThreeEnvironment(${JSON.stringify(envId)}, scene, renderer, camera);`
  const existing =
    /window\.applyCenchThreeEnvironment\s*\(\s*['"][^'"]*['"]\s*,\s*scene\s*,\s*renderer\s*,\s*camera\s*\)\s*;?/
  if (existing.test(code)) {
    return {
      code: code.replace(existing, call),
      summary: `Swapped stage environment to "${envId}".`,
    }
  }
  return {
    code: insertAfterCameraSetup(code, call),
    summary: `Inserted stage environment "${envId}".`,
  }
}
