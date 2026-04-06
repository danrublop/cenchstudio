'use client'

import { useRef, useState, useEffect, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'

function useIsLightTheme() {
  const [light, setLight] = useState(false)
  useEffect(() => {
    const check = () => setLight(document.documentElement.classList.contains('light-theme'))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return light
}

/** Build a simple studio-style env map procedurally — no HDRI fetch needed */
function useStudioEnvMap() {
  const { gl } = useThree()
  return useMemo(() => {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    // High contrast environment for chrome reflections
    // Dark base
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, size, size)

    // Large bright areas — these become the reflections on chrome
    // Top softbox
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size * 0.15)
    // Upper mid softbox
    ctx.fillStyle = '#e0e0f0'
    ctx.fillRect(0, size * 0.25, size, size * 0.12)
    // Lower accent
    ctx.fillStyle = '#b0b0c8'
    ctx.fillRect(0, size * 0.6, size, size * 0.08)
    // Bottom fill
    ctx.fillStyle = '#404060'
    ctx.fillRect(0, size * 0.85, size, size * 0.15)

    // Vertical highlights for side reflections
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillRect(0, 0, size * 0.06, size)
    ctx.fillRect(size * 0.48, 0, size * 0.04, size)
    ctx.fillRect(size * 0.94, 0, size * 0.06, size)

    const texture = new THREE.CanvasTexture(canvas)
    texture.mapping = THREE.EquirectangularReflectionMapping
    return texture
  }, [gl])
}

function LogoMesh({ svgShapes }: { svgShapes: THREE.Shape[] }) {
  const isLight = useIsLightTheme()
  const groupRef = useRef<THREE.Group>(null)
  const innerRef = useRef<THREE.Group>(null)
  const centered = useRef(false)

  const velocity = useRef(new THREE.Vector3(0.4, 0.2, 0))
  const dragging = useRef(false)
  const prevNDC = useRef({ x: 0, y: 0 })
  const idleTime = useRef(0)

  const { gl, scene, size } = useThree()
  const envMap = useStudioEnvMap()

  // Set as scene environment so meshPhysicalMaterial picks it up
  useEffect(() => {
    scene.environment = envMap
    return () => { scene.environment = null }
  }, [envMap, scene])

  const extrudeSettings = useMemo(() => ({
    depth: 25,
    bevelEnabled: true,
    bevelThickness: 6,
    bevelSize: 5,
    bevelSegments: 12,
    curveSegments: 24,
  }), [])

  useEffect(() => {
    if (!innerRef.current || centered.current) return
    const box = new THREE.Box3().setFromObject(innerRef.current)
    const c = new THREE.Vector3()
    const s = new THREE.Vector3()
    box.getCenter(c)
    box.getSize(s)
    const maxDim = Math.max(s.x, s.y, s.z)
    const scale = 4.5 / maxDim
    innerRef.current.position.set(-c.x, -c.y, -c.z)
    if (groupRef.current) {
      groupRef.current.scale.set(scale, -scale, scale)
    }
    centered.current = true
  }, [svgShapes])

  useEffect(() => {
    const canvas = gl.domElement

    const toNDC = (e: PointerEvent) => ({
      x: (e.clientX / size.width) * 2 - 1,
      y: -(e.clientY / size.height) * 2 + 1,
    })

    const onDown = (e: PointerEvent) => {
      dragging.current = true
      idleTime.current = 0
      const ndc = toNDC(e)
      prevNDC.current = ndc
      canvas.setPointerCapture(e.pointerId)
    }

    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return
      const ndc = toNDC(e)
      const dx = ndc.x - prevNDC.current.x
      const dy = ndc.y - prevNDC.current.y

      velocity.current.y = dx * 80
      velocity.current.x = -dy * 80
      velocity.current.z = (dx * dy) * 25

      prevNDC.current = ndc
    }

    const onUp = () => {
      dragging.current = false
      idleTime.current = 0
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointerleave', onUp)

    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointerleave', onUp)
    }
  }, [gl, size])

  useFrame((_, delta) => {
    if (!groupRef.current) return
    const d = Math.min(delta, 0.05)

    if (!dragging.current) {
      const friction = Math.pow(0.985, d * 60)
      velocity.current.multiplyScalar(friction)

      if (velocity.current.length() < 0.05) {
        idleTime.current += d
      } else {
        idleTime.current = 0
      }

      if (idleTime.current > 3) {
        const returnStrength = Math.min((idleTime.current - 3) * 0.3, 1.5) * d
        groupRef.current.rotation.x += (0 - groupRef.current.rotation.x) * returnStrength
        groupRef.current.rotation.y += (0 - groupRef.current.rotation.y) * returnStrength
        groupRef.current.rotation.z += (0 - groupRef.current.rotation.z) * returnStrength
      }
    }

    groupRef.current.rotation.x += velocity.current.x * d
    groupRef.current.rotation.y += velocity.current.y * d
    groupRef.current.rotation.z += velocity.current.z * d
  })

  return (
    <group ref={groupRef}>
      <group ref={innerRef}>
        {svgShapes.map((shape, i) => (
          <mesh key={i}>
            <extrudeGeometry args={[shape, extrudeSettings]} />
            <meshPhysicalMaterial
              color={isLight ? '#d8d8e0' : '#c0c0c8'}
              metalness={1}
              roughness={isLight ? 0.03 : 0.08}
              clearcoat={1}
              clearcoatRoughness={0.05}
              reflectivity={1}
              envMapIntensity={isLight ? 3 : 1.5}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export default function Logo3D() {
  const [svgShapes, setSvgShapes] = useState<THREE.Shape[] | null>(null)

  useEffect(() => {
    const loader = new SVGLoader()
    loader.load('/cench-logo.svg', (data) => {
      const allShapes: THREE.Shape[] = []
      for (const path of data.paths) {
        const pathShapes = SVGLoader.createShapes(path)
        allShapes.push(...pathShapes)
      }
      setSvgShapes(allShapes)
    })
  }, [])

  if (!svgShapes || svgShapes.length === 0) return null

  return (
    <div className="w-full h-full" style={{ cursor: 'grab' }}>
      <Canvas
        camera={{ position: [0, 0, 7], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1.5} />
        <directionalLight position={[-5, -3, 3]} intensity={0.8} />
        <pointLight position={[0, 0, 5]} intensity={1} />
        <LogoMesh svgShapes={svgShapes} />
      </Canvas>
    </div>
  )
}
