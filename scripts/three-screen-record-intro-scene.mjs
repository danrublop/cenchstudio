/**
 * Scene code for "Screen record intro" — extruded Cench logo (SVGLoader + ExtrudeGeometry),
 * chrome MeshPhysicalMaterial, three monitors, canvas text plane, white fade.
 * PATCH via API with sceneType: 'three' and generatedCode: JSON.stringify({ sceneCode: readFileSync(...) }).
 */
export const sceneCode = `
import * as THREE from 'three'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'

const { WIDTH, HEIGHT, PALETTE, DURATION } = window

/** Neutral white/off-white PMREM so chrome reads metallic — no blue sky / no grid. */
function attachWhiteStudioEnv(scn, ren) {
  const pmrem = new THREE.PMREMGenerator(ren)
  const envScene = new THREE.Scene()
  const skyGeo = new THREE.SphereGeometry(50, 32, 16)
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color(0xffffff) },
      bottomColor: { value: new THREE.Color(0xeeeeee) },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPos;
      void main() {
        float h = normalize(vWorldPos).y * 0.5 + 0.5;
        gl_FragColor = vec4(mix(bottomColor, topColor, h), 1.0);
      }
    `,
  })
  envScene.add(new THREE.Mesh(skyGeo, skyMat))
  const panelMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const p1 = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), panelMat)
  p1.position.set(-8, 10, 7)
  p1.lookAt(0, 0, 0)
  envScene.add(p1)
  const p2 = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), panelMat)
  p2.position.set(9, 5, 5)
  p2.lookAt(0, 0, 0)
  envScene.add(p2)
  const envMap = pmrem.fromScene(envScene, 0.035).texture
  scn.environment = envMap
  pmrem.dispose()
  skyGeo.dispose()
  skyMat.dispose()
  panelMat.dispose()
  p1.geometry.dispose()
  p2.geometry.dispose()
}

function clamp(lo, x, hi) {
  return Math.max(lo, Math.min(hi, x))
}
function lerp(a, b, t) {
  return a + (b - a) * t
}
function smoothstep(t) {
  return t * t * (3 - 2 * t)
}

;(async function run() {
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setSize(WIDTH, HEIGHT)
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
renderer.shadowMap.enabled = false
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.outputColorSpace = THREE.SRGBColorSpace
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0xffffff)

const camera = new THREE.PerspectiveCamera(48, WIDTH / HEIGHT, 0.1, 200)
camera.position.set(0, 0.4, 9.2)
camera.lookAt(0, -0.2, 0)
window.__threeCamera = camera

const ambient = new THREE.AmbientLight(0xffffff, 0.62)
const key = new THREE.DirectionalLight(0xffffff, 1.35)
key.position.set(-5.5, 12, 8)
const fill = new THREE.DirectionalLight(0xffffff, 0.55)
fill.position.set(8, 6, 6)
const rim = new THREE.DirectionalLight(0xffffff, 0.4)
rim.position.set(0, 4, -10)
scene.add(ambient, key, fill, rim)

attachWhiteStudioEnv(scene, renderer)

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(120, 120),
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    metalness: 0,
  }),
)
floor.rotation.x = -Math.PI / 2
floor.position.y = -2.2
scene.add(floor)

const rootGroup = new THREE.Group()
const logoGroup = new THREE.Group()
const monitorsRoot = new THREE.Group()
rootGroup.add(logoGroup)
rootGroup.add(monitorsRoot)
scene.add(rootGroup)

const chromeMat = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color(0xffffff),
  metalness: 1,
  roughness: 0.06,
  clearcoat: 1,
  clearcoatRoughness: 0.05,
  envMapIntensity: 2.1,
  ior: 1.47,
  transparent: true,
  opacity: 1,
})

try {
  const loader = new SVGLoader()
  const data = await new Promise((resolve, reject) => {
    loader.load('/cench-logo.svg', resolve, undefined, reject)
  })
  for (let i = 0; i < data.paths.length; i++) {
    const path = data.paths[i]
    const shapes = SVGLoader.createShapes(path)
    for (let j = 0; j < shapes.length; j++) {
      const geo = new THREE.ExtrudeGeometry(shapes[j], {
        depth: 0.5,
        bevelEnabled: true,
        bevelThickness: 0.07,
        bevelSize: 0.045,
        bevelSegments: 2,
        curveSegments: 10,
      })
      const mesh = new THREE.Mesh(geo, chromeMat)
      logoGroup.add(mesh)
    }
  }
} catch (e) {
  console.warn('[screen-intro] SVGLoader:', e)
  const fb = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 0.45), chromeMat)
  logoGroup.add(fb)
}

logoGroup.scale.set(1, -1, 1)
{
  const box = new THREE.Box3().setFromObject(logoGroup)
  const sz = new THREE.Vector3()
  box.getSize(sz)
  const sc = 2.75 / Math.max(sz.x, sz.y, sz.z, 0.001)
  logoGroup.scale.set(sc, -sc, sc)
  box.setFromObject(logoGroup)
  const center = new THREE.Vector3()
  box.getCenter(center)
  logoGroup.position.sub(center)
}
logoGroup.position.y += 0.95

function makeMonitor() {
  const g = new THREE.Group()
  const bezelMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(PALETTE[0] || '#8a8e98'),
    metalness: 0.88,
    roughness: 0.2,
    clearcoat: 0.55,
  })
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.38, 1.02, 0.11), bezelMat)
  const screenMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(PALETTE[3] || '#2563eb'),
    metalness: 0.4,
    roughness: 0.42,
    emissive: new THREE.Color(PALETTE[3] || '#2563eb'),
    emissiveIntensity: 0.1,
  })
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 0.8), screenMat)
  screen.position.z = 0.057
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.2), bezelMat)
  stand.position.set(0, -0.58, 0)
  g.add(bezel, screen, stand)
  return g
}

for (let k = 0; k < 3; k++) {
  const mon = makeMonitor()
  mon.position.set((k - 1) * 2.15, -1.42, 0.45)
  monitorsRoot.add(mon)
}

const cnv = document.createElement('canvas')
cnv.width = 2048
cnv.height = 512
const ctx = cnv.getContext('2d')
ctx.fillStyle = '#' + new THREE.Color(PALETTE[0] || '#1a1a2e').getHexString()
ctx.font = 'bold 118px system-ui, Segoe UI, sans-serif'
ctx.textAlign = 'center'
ctx.fillText('Generate  videos  with  prompts', 1024, 290)
const textTex = new THREE.CanvasTexture(cnv)
textTex.colorSpace = THREE.SRGBColorSpace
const textMat = new THREE.MeshBasicMaterial({ map: textTex, transparent: true, opacity: 0 })
const textPlane = new THREE.Mesh(new THREE.PlaneGeometry(7.8, 1.9), textMat)
textPlane.position.set(0, -0.42, 1.8)
scene.add(textPlane)

const fadeMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0,
  depthWrite: false,
})
const fadeQuad = new THREE.Mesh(new THREE.PlaneGeometry(28, 16), fadeMat)
fadeQuad.position.z = -3.5
camera.add(fadeQuad)
scene.add(camera)

function tick() {
  requestAnimationFrame(tick)
  const t = window.__tl && typeof window.__tl.time === 'function' ? window.__tl.time() : 0
  const p = DURATION > 0 ? clamp(0, t / DURATION, 1) : 0

  const flyT = smoothstep(clamp(0, p / 0.14, 1))
  rootGroup.scale.setScalar(Math.max(0.02, lerp(0.1, 1, flyT)))
  rootGroup.position.set(0, lerp(5.2, 0.15, flyT), lerp(3.8, 0, flyT))

  const spinT = clamp(0, (p - 0.1) / 0.34, 1)
  rootGroup.rotation.y = 0

  const fallT = smoothstep(clamp(0, (p - 0.56) / 0.2, 1))
  rootGroup.position.y -= fallT * fallT * 8.5
  rootGroup.position.x += fallT * 2.1
  rootGroup.rotation.x = fallT * 0.82

  const bob = Math.sin(spinT * Math.PI * 3) * 0.1 * (1 - fallT)
  rootGroup.position.y += bob

  const introYaw = spinT * Math.PI * 4
  const continuousYaw = t * 0.95
  logoGroup.rotation.y = introYaw + continuousYaw

  monitorsRoot.rotation.y = p * Math.PI * 2.35

  const textIn = smoothstep(clamp(0, (p - 0.2) / 0.11, 1))
  const textOut = smoothstep(clamp(0, (p - 0.68) / 0.14, 1))
  textMat.opacity = textIn * (1 - textOut)

  const logoFade = p > 0.74 ? lerp(1, 0, clamp(0, (p - 0.74) / 0.1, 1)) : 1
  chromeMat.opacity = logoFade

  fadeMat.opacity = smoothstep(clamp(0, (p - 0.82) / 0.18, 1))

  renderer.render(scene, camera)
}

renderer.render(scene, camera)
requestAnimationFrame(tick)
})()
`
