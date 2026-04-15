/**
 * Legacy-to-React wrapper utilities.
 *
 * Each function takes existing scene code and wraps it in a React component
 * that uses the appropriate CenchReact bridge component. This allows migrating
 * any existing scene type to React without changing the visual output.
 *
 * Security note: The generated JSX runs inside sandboxed scene iframes — same
 * security model as all other scene types which embed AI-generated JS/HTML in
 * inline script tags. The ref-based HTML injection wraps the same AI-generated
 * content that was previously injected directly into the HTML template.
 */

import type { Scene } from '../types'

/**
 * Wrap a Motion scene (sceneCode + sceneHTML + sceneStyles) in a React component.
 * Renders the existing HTML content and runs GSAP scene code in useEffect.
 */
export function wrapMotionAsReact(scene: Pick<Scene, 'sceneCode' | 'sceneHTML' | 'sceneStyles'>): string {
  const { sceneCode = '', sceneHTML = '', sceneStyles = '' } = scene
  const escapedHTML = JSON.stringify(sceneHTML)
  const escapedStyles = JSON.stringify(sceneStyles)
  const escapedCode = JSON.stringify(sceneCode)

  // Wrapper injects Motion HTML and runs GSAP code — equivalent to generateMotionHTML
  return [
    'export default function Scene() {',
    '  var frame = useCurrentFrame();',
    '  var contentRef = React.useRef(null);',
    '',
    '  React.useEffect(function() {',
    '    var styleEl = document.createElement("style");',
    `    styleEl.textContent = ${escapedStyles};`,
    '    document.head.appendChild(styleEl);',
    '',
    `    if (contentRef.current) contentRef.current.innerHTML = ${escapedHTML};`,
    '',
    '    var scriptEl = document.createElement("script");',
    `    scriptEl.textContent = ${escapedCode};`,
    '    document.body.appendChild(scriptEl);',
    '',
    '    return function() { styleEl.remove(); };',
    '  }, []);',
    '',
    '  return (',
    '    <AbsoluteFill>',
    '      <div ref={contentRef} style={{ width: "100%", height: "100%" }} />',
    '    </AbsoluteFill>',
    '  );',
    '}',
  ].join('\n')
}

/**
 * Wrap a Canvas2D scene in a React component.
 * Creates a canvas#c element and runs the original canvas code.
 */
export function wrapCanvasAsReact(scene: Pick<Scene, 'canvasCode'>): string {
  const { canvasCode = '' } = scene
  const escapedCode = JSON.stringify(canvasCode)

  return [
    'export default function Scene() {',
    '  React.useEffect(function() {',
    '    var scriptEl = document.createElement("script");',
    `    scriptEl.textContent = ${escapedCode};`,
    '    document.body.appendChild(scriptEl);',
    '  }, []);',
    '',
    '  return (',
    '    <AbsoluteFill>',
    '      <canvas id="c" width={WIDTH} height={HEIGHT} style={{ width: "100%", height: "100%" }} />',
    '    </AbsoluteFill>',
    '  );',
    '}',
  ].join('\n')
}

/**
 * Wrap an SVG scene in a React component.
 */
export function wrapSVGAsReact(scene: Pick<Scene, 'svgContent'>): string {
  const { svgContent = '' } = scene
  const escapedSVG = JSON.stringify(svgContent)

  return [
    'export default function Scene() {',
    '  var svgRef = React.useRef(null);',
    '',
    '  React.useEffect(function() {',
    `    if (svgRef.current) svgRef.current.innerHTML = ${escapedSVG};`,
    '  }, []);',
    '',
    '  return (',
    '    <AbsoluteFill>',
    '      <div ref={svgRef}',
    '        style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}',
    '      />',
    '    </AbsoluteFill>',
    '  );',
    '}',
  ].join('\n')
}

/**
 * Wrap a Three.js scene in a React component.
 */
export function wrapThreeAsReact(scene: Pick<Scene, 'sceneCode'>): string {
  const { sceneCode = '' } = scene
  const escapedCode = JSON.stringify(sceneCode)

  return [
    'export default function Scene() {',
    '  React.useEffect(function() {',
    '    var scriptEl = document.createElement("script");',
    `    scriptEl.textContent = ${escapedCode};`,
    '    document.body.appendChild(scriptEl);',
    '  }, []);',
    '',
    '  return (',
    '    <AbsoluteFill>',
    '      <div id="three-container" style={{ width: "100%", height: "100%" }} />',
    '    </AbsoluteFill>',
    '  );',
    '}',
  ].join('\n')
}

/**
 * Wrap a D3 scene in a React component using D3Layer.
 */
export function wrapD3AsReact(scene: Pick<Scene, 'sceneCode' | 'd3Data'>): string {
  const { sceneCode = '', d3Data } = scene
  const escapedCode = JSON.stringify(sceneCode)
  const escapedData = JSON.stringify(d3Data ?? null)

  return [
    'export default function Scene() {',
    '  function setup(d3, el, config) {',
    `    window.DATA = ${escapedData};`,
    '    var scriptEl = document.createElement("script");',
    `    scriptEl.textContent = ${escapedCode};`,
    '    document.body.appendChild(scriptEl);',
    '  }',
    '',
    '  return (',
    '    <AbsoluteFill>',
    '      <D3Layer setup={setup} />',
    '    </AbsoluteFill>',
    '  );',
    '}',
  ].join('\n')
}

/**
 * Wrap a Lottie scene in a React component using LottieLayer.
 */
export function wrapLottieAsReact(scene: Pick<Scene, 'lottieSource'>): string {
  const { lottieSource = '' } = scene

  let parsedData: string
  try {
    JSON.parse(lottieSource)
    parsedData = lottieSource
  } catch {
    parsedData = '{}'
  }

  return [
    'export default function Scene() {',
    `  var data = ${parsedData};`,
    '  return (',
    '    <AbsoluteFill>',
    '      <LottieLayer data={data} />',
    '    </AbsoluteFill>',
    '  );',
    '}',
  ].join('\n')
}

/**
 * Auto-detect scene type and wrap with the appropriate converter.
 * Returns null if the scene is already React or type is unsupported.
 */
export function wrapSceneAsReact(scene: Scene): string | null {
  switch (scene.sceneType) {
    case 'motion':
      return wrapMotionAsReact(scene)
    case 'canvas2d':
      return wrapCanvasAsReact(scene)
    case 'svg':
      return wrapSVGAsReact(scene)
    case 'three':
      return wrapThreeAsReact(scene)
    case 'd3':
      return wrapD3AsReact(scene)
    case 'lottie':
      return wrapLottieAsReact(scene)
    case 'react':
      return null
    default:
      return null
  }
}
