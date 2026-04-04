/**
 * Sync Cench stage environment id in Three.js module scene code (applyCenchThreeEnvironment).
 */

const APPLY_PREFIX = /applyCenchThreeEnvironment\s*\(\s*['"][^'"]*['"]/

/** First applyCenchThreeEnvironment string literal arg, if any. */
export function parseAppliedThreeEnvironmentId(sceneCode: string): string | null {
  const m = sceneCode.match(/applyCenchThreeEnvironment\s*\(\s*(['"])([^'"]*)\1/)
  return m ? m[2] : null
}

function replaceApplyFirstArg(code: string, envId: string): string {
  return code.replace(APPLY_PREFIX, `applyCenchThreeEnvironment(${JSON.stringify(envId)}`)
}

function removeApplyLine(code: string): string {
  return code.replace(/^\s*applyCenchThreeEnvironment\s*\([^)]*\)\s*;?\s*$/m, '')
}

function injectAfterAnchor(code: string, envId: string): string {
  const line = `applyCenchThreeEnvironment(${JSON.stringify(envId)}, scene, renderer, camera);`
  const anchor1 = /(window\.__threeCamera\s*=\s*camera\s*;)/
  if (anchor1.test(code)) {
    return code.replace(anchor1, (_, cap: string) => `${cap}\n\n${line}`)
  }
  const anchor2 = /(camera\.lookAt\s*\([^)]*\)\s*;)/
  const m = code.match(anchor2)
  if (m?.index !== undefined) {
    const end = m.index + m[0].length
    return code.slice(0, end) + '\n\n' + line + code.slice(end)
  }
  return code
}

export type PatchThreeEnvironmentResult = {
  sceneCode: string
  patched: boolean
  injectFailed: boolean
}

/**
 * Set or clear the stage environment in scene module code.
 * When envId is null or '', removes a single applyCenchThreeEnvironment(...) line if present.
 */
export function patchThreeEnvironmentInSceneCode(sceneCode: string, envId: string | null): PatchThreeEnvironmentResult {
  if (envId === null || envId === '') {
    const next = removeApplyLine(sceneCode)
    return {
      sceneCode: next,
      patched: next !== sceneCode,
      injectFailed: false,
    }
  }

  if (APPLY_PREFIX.test(sceneCode)) {
    const next = replaceApplyFirstArg(sceneCode, envId)
    return {
      sceneCode: next,
      patched: true,
      injectFailed: false,
    }
  }

  const injected = injectAfterAnchor(sceneCode, envId)
  const ok = injected !== sceneCode
  return {
    sceneCode: ok ? injected : sceneCode,
    patched: ok,
    injectFailed: !ok,
  }
}
