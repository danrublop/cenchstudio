/**
 * Three.js Component Library for Cench Studio
 *
 * Pre-built, composable scene components for Three.js r183.
 * Each component exposes a `buildCode` string — a self-contained JS function
 * that accepts (scene, palette, mulberry32) and returns { update(t) }.
 *
 * Usage:
 *   assembleThreeScene(config) → complete JS string for injection into the
 *   Three.js scene template.
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** A reusable, categorised Three.js building block. */
export interface ThreeComponent {
  /** Unique kebab-case identifier */
  id: string
  /** Human-readable display name */
  name: string
  /** Determines which slot this component fills in a scene */
  category: 'lighting' | 'camera' | 'object' | 'environment'
  /** One-sentence description shown to the agent and in the UI */
  description: string
  /** Search tags for fuzzy matching */
  tags: string[]
  /**
   * Self-contained JS function body as a string.
   * The function signature is always:
   *   function build<Id>(scene, camera, palette, rand, DURATION)
   * It must return an object: { update(t: number): void }
   * where t is elapsed seconds since scene start.
   *
   * Rules:
   * - Import nothing — THREE is available via importmap ES module.
   * - Use palette[n] for all colors, never hardcoded hex.
   * - Use rand() (a mulberry32 instance) instead of Math.random().
   * - camera and DURATION are optional-use (some components need them).
   */
  buildCode: string
}

// ── Lighting Components ───────────────────────────────────────────────────────

const lightingStudio: ThreeComponent = {
  id: 'lighting-studio',
  name: 'Studio 3-Point',
  category: 'lighting',
  description: '3-point key/fill/rim lighting with soft shadows and warm tint. Best all-purpose setup.',
  tags: ['studio', '3-point', 'shadows', 'warm', 'key', 'fill', 'rim'],
  buildCode: `
function buildLightingStudio(scene, camera, palette, rand, DURATION) {
  const ambient = new THREE.AmbientLight(0xffffff, 0.3);

  const key = new THREE.DirectionalLight(0xfff6e0, 1.4);
  key.position.set(-5, 8, 5);
  key.castShadow = true;
  key.shadow.mapSize.width = 2048;
  key.shadow.mapSize.height = 2048;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 50;
  key.shadow.camera.left = -10;
  key.shadow.camera.right = 10;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -10;
  key.shadow.bias = -0.001;

  const fill = new THREE.DirectionalLight(0xd0e8ff, 0.45);
  fill.position.set(6, 2, 4);

  const rim = new THREE.DirectionalLight(0xffe0d0, 0.7);
  rim.position.set(0, 4, -9);

  scene.add(ambient, key, fill, rim);

  return { update(t) {} };
}
`,
}

const lightingDramatic: ThreeComponent = {
  id: 'lighting-dramatic',
  name: 'Dramatic Single Key',
  category: 'lighting',
  description: 'One strong side-key light with deep shadows. High contrast, cinematic look.',
  tags: ['dramatic', 'cinematic', 'shadow', 'contrast', 'single-light', 'moody'],
  buildCode: `
function buildLightingDramatic(scene, camera, palette, rand, DURATION) {
  const ambient = new THREE.AmbientLight(0x111122, 0.15);

  const key = new THREE.SpotLight(0xffffff, 3.0, 40, Math.PI / 6, 0.4, 1.5);
  key.position.set(-8, 10, 3);
  key.castShadow = true;
  key.shadow.mapSize.width = 2048;
  key.shadow.mapSize.height = 2048;
  key.shadow.bias = -0.002;
  key.target.position.set(0, 0, 0);
  scene.add(key.target);

  const backlight = new THREE.DirectionalLight(0x1a1a3a, 0.3);
  backlight.position.set(5, -2, -5);

  scene.add(ambient, key, backlight);

  return { update(t) {} };
}
`,
}

const lightingSoftOverhead: ThreeComponent = {
  id: 'lighting-soft-overhead',
  name: 'Soft Overhead',
  category: 'lighting',
  description: 'Even overhead lighting with minimal shadow. Ideal for diagrams and technical illustrations.',
  tags: ['soft', 'overhead', 'even', 'flat', 'diagram', 'technical'],
  buildCode: `
function buildLightingSoftOverhead(scene, camera, palette, rand, DURATION) {
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);

  const top = new THREE.DirectionalLight(0xffffff, 0.9);
  top.position.set(0, 10, 0);
  top.castShadow = true;
  top.shadow.mapSize.width = 1024;
  top.shadow.mapSize.height = 1024;
  top.shadow.camera.near = 0.5;
  top.shadow.camera.far = 30;
  top.shadow.camera.left = -8;
  top.shadow.camera.right = 8;
  top.shadow.camera.top = 8;
  top.shadow.camera.bottom = -8;
  top.shadow.bias = -0.001;

  const front = new THREE.DirectionalLight(0xf0f4ff, 0.3);
  front.position.set(0, 2, 8);

  const side = new THREE.DirectionalLight(0xfff8f0, 0.2);
  side.position.set(6, 3, 2);

  scene.add(ambient, top, front, side);

  return { update(t) {} };
}
`,
}

const lightingNeon: ThreeComponent = {
  id: 'lighting-neon',
  name: 'Neon Pulse',
  category: 'lighting',
  description: 'Dark scene with pulsing colored point lights drawn from the palette. Cyberpunk/club aesthetic.',
  tags: ['neon', 'pulse', 'colorful', 'dark', 'cyberpunk', 'glow', 'point-lights'],
  buildCode: `
function buildLightingNeon(scene, camera, palette, rand, DURATION) {
  const ambient = new THREE.AmbientLight(0x050510, 0.1);
  scene.add(ambient);

  const positions = [
    [-4, 3, 2],
    [4, 2, -2],
    [0, -2, 4],
    [-3, -1, -3],
  ];

  const lights = positions.slice(0, Math.min(palette.length, 4)).map((pos, i) => {
    const light = new THREE.PointLight(new THREE.Color(palette[i % palette.length]), 2.5, 18, 2);
    light.position.set(pos[0], pos[1], pos[2]);
    scene.add(light);
    return { light, baseIntensity: 2.5, phase: i * (Math.PI / 2) };
  });

  return {
    update(t) {
      lights.forEach(({ light, baseIntensity, phase }) => {
        light.intensity = baseIntensity * (0.7 + 0.3 * Math.sin(t * 2 + phase));
      });
    }
  };
}
`,
}

const lightingCinematic: ThreeComponent = {
  id: 'lighting-cinematic',
  name: 'Cinematic Soft Box',
  category: 'lighting',
  description: 'RectAreaLight key + warm fill + cool rim. Soft box look for product shots and cinematic scenes.',
  tags: ['cinematic', 'softbox', 'area-light', 'product', 'professional', 'studio'],
  buildCode: `
function buildLightingCinematic(scene, camera, palette, rand, DURATION) {
  // RectAreaLight needs uniform library — import inline
  const script = document.createElement('script');
  script.type = 'module';
  script.textContent = \`
    import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
    RectAreaLightUniformsLib.init();
  \`;
  document.head.appendChild(script);

  // Key — large soft area light from above-left
  const key = new THREE.RectAreaLight(0xfff8f0, 5, 6, 3);
  key.position.set(-4, 6, 4);
  key.lookAt(0, 0, 0);

  // Fill — warm, opposite side
  const fill = new THREE.DirectionalLight(0xffe8d0, 0.5);
  fill.position.set(5, 3, 2);

  // Rim — cool backlight for edge separation
  const rim = new THREE.DirectionalLight(0xd0e0ff, 0.8);
  rim.position.set(0, 4, -8);

  // Shadow caster (RectAreaLight doesn't cast shadow maps)
  const shadowLight = new THREE.DirectionalLight(0xffffff, 0.3);
  shadowLight.position.set(-4, 8, 4);
  shadowLight.castShadow = true;
  shadowLight.shadow.mapSize.set(2048, 2048);
  shadowLight.shadow.bias = -0.001;

  const ambient = new THREE.AmbientLight(0xffffff, 0.15);

  scene.add(key, fill, rim, shadowLight, ambient);

  return { update(t) {} };
}
`,
}

const lightingSunset: ThreeComponent = {
  id: 'lighting-sunset',
  name: 'Sunset Warm',
  category: 'lighting',
  description: 'Warm directional with long shadows and orange/purple tints. Golden hour aesthetic.',
  tags: ['sunset', 'warm', 'golden-hour', 'orange', 'purple', 'long-shadows'],
  buildCode: `
function buildLightingSunset(scene, camera, palette, rand, DURATION) {
  const ambient = new THREE.AmbientLight(0x1a1025, 0.2);

  // Low-angle warm key (sunset direction)
  const key = new THREE.DirectionalLight(0xff9040, 1.6);
  key.position.set(-8, 2, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -15;
  key.shadow.camera.right = 15;
  key.shadow.camera.top = 15;
  key.shadow.camera.bottom = -15;
  key.shadow.bias = -0.001;

  // Purple sky fill from above
  const skyFill = new THREE.HemisphereLight(0x6040a0, 0xff8060, 0.4);

  // Warm rim from behind
  const rim = new THREE.DirectionalLight(0xff6030, 0.5);
  rim.position.set(3, 1, -8);

  scene.add(ambient, key, skyFill, rim);

  return { update(t) {} };
}
`,
}

// ── Camera Components ─────────────────────────────────────────────────────────

const cameraOrbitSlow: ThreeComponent = {
  id: 'camera-orbit-slow',
  name: 'Slow Orbit',
  category: 'camera',
  description: 'Camera orbits the origin at a gentle pace, revealing all sides of the subject.',
  tags: ['orbit', 'slow', 'rotate', 'revolve', 'circle'],
  buildCode: `
function buildCameraOrbitSlow(scene, camera, palette, rand, DURATION) {
  const radius = camera.position.length() || 10;
  const startAngle = 0;

  return {
    update(t) {
      const angle = startAngle + t * 0.35;
      camera.position.x = Math.cos(angle) * radius;
      camera.position.z = Math.sin(angle) * radius;
      camera.lookAt(0, 0, 0);
    }
  };
}
`,
}

const cameraPullback: ThreeComponent = {
  id: 'camera-pullback',
  name: 'Pull Back Reveal',
  category: 'camera',
  description: 'Camera starts close and pulls back to reveal the full composition. Great for openers.',
  tags: ['pullback', 'reveal', 'zoom-out', 'opener', 'dolly'],
  buildCode: `
function buildCameraPullback(scene, camera, palette, rand, DURATION) {
  const startZ = 3;
  const endZ = camera.position.z || 12;
  const startY = camera.position.y || 2;

  return {
    update(t) {
      const progress = Math.min(t / (DURATION * 0.6), 1);
      const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      camera.position.z = startZ + (endZ - startZ) * ease;
      camera.position.y = startY * (1 - ease * 0.3);
      camera.lookAt(0, 0, 0);
    }
  };
}
`,
}

const cameraTopDown: ThreeComponent = {
  id: 'camera-top-down',
  name: 'Top-Down Overhead',
  category: 'camera',
  description: 'Fixed overhead camera looking straight down. Good for floor plans, maps, layouts.',
  tags: ['top-down', 'overhead', 'bird-eye', 'flat', 'plan'],
  buildCode: `
function buildCameraTopDown(scene, camera, palette, rand, DURATION) {
  camera.position.set(0, 15, 0.001); // 0.001 prevents gimbal lock
  camera.lookAt(0, 0, 0);
  camera.up.set(0, 0, -1);

  return { update(t) {} };
}
`,
}

const cameraIsometric: ThreeComponent = {
  id: 'camera-isometric',
  name: 'Isometric Fixed',
  category: 'camera',
  description: 'Fixed isometric angle at 45-degrees. Classic game/diagram perspective.',
  tags: ['isometric', 'fixed', 'iso', 'game', 'diagram', '45-degree'],
  buildCode: `
function buildCameraIsometric(scene, camera, palette, rand, DURATION) {
  const dist = 12;
  camera.position.set(dist, dist * 0.8, dist);
  camera.lookAt(0, 0, 0);

  return { update(t) {} };
}
`,
}

const cameraDollyIn: ThreeComponent = {
  id: 'camera-dolly-in',
  name: 'Dolly In',
  category: 'camera',
  description: 'Camera starts far and moves in close to the subject. Creates focus and intimacy.',
  tags: ['dolly', 'push-in', 'zoom', 'close-up', 'approach'],
  buildCode: `
function buildCameraDollyIn(scene, camera, palette, rand, DURATION) {
  const startZ = 18;
  const endZ = 5;
  const startY = 5;
  const endY = 3;

  return {
    update(t) {
      const progress = Math.min(t / (DURATION * 0.8), 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      camera.position.z = startZ + (endZ - startZ) * ease;
      camera.position.y = startY + (endY - startY) * ease;
      camera.lookAt(0, 0, 0);
    }
  };
}
`,
}

const cameraCraneUp: ThreeComponent = {
  id: 'camera-crane-up',
  name: 'Crane Up',
  category: 'camera',
  description: 'Camera rises vertically while looking at the origin. Reveals scene from low to high angle.',
  tags: ['crane', 'rise', 'vertical', 'reveal', 'ascend'],
  buildCode: `
function buildCameraCraneUp(scene, camera, palette, rand, DURATION) {
  const startY = 1;
  const endY = 12;
  const radius = camera.position.length() > 0.1 ? Math.sqrt(camera.position.x ** 2 + camera.position.z ** 2) : 10;

  return {
    update(t) {
      const progress = Math.min(t / (DURATION * 0.85), 1);
      const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      camera.position.y = startY + (endY - startY) * ease;
      camera.lookAt(0, 0, 0);
    }
  };
}
`,
}

const cameraPath: ThreeComponent = {
  id: 'camera-path',
  name: 'Smooth Path',
  category: 'camera',
  description: 'Camera follows a smooth CatmullRomCurve3 path through the scene. Cinematic flythrough.',
  tags: ['path', 'flythrough', 'cinematic', 'curve', 'spline', 'smooth'],
  buildCode: `
function buildCameraPath(scene, camera, palette, rand, DURATION) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-8, 3, 8),
    new THREE.Vector3(-2, 5, 4),
    new THREE.Vector3(4, 4, 2),
    new THREE.Vector3(8, 3, -4),
    new THREE.Vector3(4, 2, -8),
  ]);

  return {
    update(t) {
      const progress = Math.min(t / DURATION, 0.98);
      const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      camera.position.copy(curve.getPointAt(ease));
      camera.lookAt(0, 0, 0);
    }
  };
}
`,
}

// ── Object Components ─────────────────────────────────────────────────────────

const objectFloatingSphere: ThreeComponent = {
  id: 'object-floating-sphere',
  name: 'Floating Sphere',
  category: 'object',
  description: 'A sphere with a gentle floating animation and slow rotation. Minimal, elegant.',
  tags: ['sphere', 'float', 'bob', 'rotate', 'minimal', 'elegant'],
  buildCode: `
function buildObjectFloatingSphere(scene, camera, palette, rand, DURATION) {
  const geo = new THREE.SphereGeometry(1.5, 64, 64);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette[0]),
    roughness: 0.35,
    metalness: 0.1,
  });
  const sphere = new THREE.Mesh(geo, mat);
  sphere.castShadow = true;
  sphere.receiveShadow = false;
  sphere.position.y = 0;
  scene.add(sphere);

  const baseY = 0;
  const floatAmp = 0.3;
  const floatFreq = 0.7;

  return {
    update(t) {
      sphere.position.y = baseY + Math.sin(t * floatFreq * Math.PI * 2) * floatAmp;
      sphere.rotation.y = t * 0.4;
      sphere.rotation.x = t * 0.15;
    }
  };
}
`,
}

const objectDnaHelix: ThreeComponent = {
  id: 'object-dna-helix',
  name: 'DNA Double Helix',
  category: 'object',
  description: 'Rotating double helix built from spheres and connecting tubes. Science/biotech aesthetic.',
  tags: ['dna', 'helix', 'biology', 'science', 'biotech', 'rotating', 'double-helix'],
  buildCode: `
function buildObjectDnaHelix(scene, camera, palette, rand, DURATION) {
  const group = new THREE.Group();
  scene.add(group);

  const strandMat0 = new THREE.MeshStandardMaterial({ color: new THREE.Color(palette[0]), roughness: 0.4, metalness: 0.1 });
  const strandMat1 = new THREE.MeshStandardMaterial({ color: new THREE.Color(palette[1 % palette.length]), roughness: 0.4, metalness: 0.1 });
  const bridgeMat  = new THREE.MeshStandardMaterial({ color: new THREE.Color(palette[2 % palette.length]), roughness: 0.6 });

  const steps = 20;
  const helixRadius = 1.2;
  const helixHeight = 6;
  const sphereR = 0.12;

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const angle = t * Math.PI * 4; // 2 full turns
    const y = (t - 0.5) * helixHeight;

    // Strand A
    const sA = new THREE.Mesh(new THREE.SphereGeometry(sphereR, 12, 12), strandMat0);
    sA.position.set(Math.cos(angle) * helixRadius, y, Math.sin(angle) * helixRadius);
    sA.castShadow = true;
    group.add(sA);

    // Strand B (180 offset)
    const sB = new THREE.Mesh(new THREE.SphereGeometry(sphereR, 12, 12), strandMat1);
    sB.position.set(Math.cos(angle + Math.PI) * helixRadius, y, Math.sin(angle + Math.PI) * helixRadius);
    sB.castShadow = true;
    group.add(sB);

    // Bridge every other step
    if (i % 2 === 0) {
      const posA = sA.position;
      const posB = sB.position;
      const dir = new THREE.Vector3().subVectors(posB, posA);
      const len = dir.length();
      const mid = new THREE.Vector3().addVectors(posA, posB).multiplyScalar(0.5);

      const bridgeGeo = new THREE.CylinderGeometry(0.04, 0.04, len, 8);
      const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
      bridge.position.copy(mid);
      bridge.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      bridge.castShadow = true;
      group.add(bridge);
    }
  }

  return {
    update(t) {
      group.rotation.y = t * 0.5;
    }
  };
}
`,
}

const objectBarChart3D: ThreeComponent = {
  id: 'object-bar-chart-3d',
  name: '3D Bar Chart',
  category: 'object',
  description: 'Animated bars rising from a floor. Accepts implicit data via palette for coloring.',
  tags: ['bar', 'chart', 'data', 'visualization', 'histogram', 'graph', '3d'],
  buildCode: `
function buildObjectBarChart3D(scene, camera, palette, rand, DURATION) {
  const data = [0.4, 0.75, 0.55, 0.9, 0.6, 0.8, 0.45];
  const barW = 0.5;
  const barGap = 0.2;
  const maxH = 4;
  const floorY = -2;

  const bars = data.map((value, i) => {
    const targetH = value * maxH;
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette[i % palette.length]),
      roughness: 0.45,
      metalness: 0.05,
    });
    const geo = new THREE.BoxGeometry(barW, 1, barW); // height=1, scaled later
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const xPos = (i - (data.length - 1) / 2) * (barW + barGap);
    mesh.position.set(xPos, floorY, 0);
    mesh.scale.y = 0.001; // start flat
    scene.add(mesh);

    return { mesh, targetH, xPos, delay: i * 0.12 };
  });

  // Floor grid plane
  const floorGeo = new THREE.PlaneGeometry(8, 3);
  const floorMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(palette[palette.length - 1] || '#333333'), roughness: 1 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
  floor.receiveShadow = true;
  scene.add(floor);

  const riseDuration = DURATION * 0.5;

  return {
    update(t) {
      bars.forEach(({ mesh, targetH, xPos, delay }) => {
        const localT = Math.max(0, t - delay);
        const progress = Math.min(localT / riseDuration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        const currentH = Math.max(0.001, ease * targetH);
        mesh.scale.y = currentH;
        mesh.position.y = floorY + currentH / 2;
      });
    }
  };
}
`,
}

const objectAtom: ThreeComponent = {
  id: 'object-atom',
  name: 'Atom Model',
  category: 'object',
  description: 'Nucleus with orbiting electron rings at different angles. Science/tech aesthetic.',
  tags: ['atom', 'electron', 'nucleus', 'orbit', 'science', 'chemistry', 'physics'],
  buildCode: `
function buildObjectAtom(scene, camera, palette, rand, DURATION) {
  const group = new THREE.Group();
  scene.add(group);

  // Nucleus
  const nucleusMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette[0]),
    roughness: 0.3,
    metalness: 0.2,
    emissive: new THREE.Color(palette[0]),
    emissiveIntensity: 0.15,
  });
  const nucleus = new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 32), nucleusMat);
  nucleus.castShadow = true;
  group.add(nucleus);

  // Orbital rings
  const ringAngles = [0, Math.PI / 3, -Math.PI / 3];
  const electrons = [];

  ringAngles.forEach((tilt, i) => {
    const ringMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette[(i + 1) % palette.length]),
      roughness: 0.6,
      metalness: 0,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.02, 8, 64),
      ringMat
    );
    ring.rotation.x = Math.PI / 2;
    ring.rotation.z = tilt;
    group.add(ring);

    // Electron on this ring
    const eMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette[(i + 1) % palette.length]),
      roughness: 0.2,
      metalness: 0.1,
      emissive: new THREE.Color(palette[(i + 1) % palette.length]),
      emissiveIntensity: 0.5,
    });
    const electron = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), eMat);
    electron.castShadow = true;
    group.add(electron);

    electrons.push({ electron, tilt, speed: 1.2 + i * 0.4, radius: 1.5 });
  });

  return {
    update(t) {
      nucleus.rotation.y = t * 0.8;

      electrons.forEach(({ electron, tilt, speed, radius }) => {
        const angle = t * speed;
        // Orbit in XZ plane then tilt
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        // Apply tilt rotation around X axis
        electron.position.set(
          x,
          z * Math.sin(tilt),
          z * Math.cos(tilt)
        );
      });

      group.rotation.y = t * 0.15;
    }
  };
}
`,
}

const objectGearPair: ThreeComponent = {
  id: 'object-gear-pair',
  name: 'Interlocking Gears',
  category: 'object',
  description: 'Two gears meshing and counter-rotating. Mechanical/engineering aesthetic.',
  tags: ['gear', 'mechanical', 'engineering', 'rotate', 'machine', 'cog', 'industry'],
  buildCode: `
function buildObjectGearPair(scene, camera, palette, rand, DURATION) {
  function makeGear(teeth, outerR, innerR, thickness, mat) {
    const shape = new THREE.Shape();
    const toothDepth = outerR - innerR;
    const toothW = (2 * Math.PI * innerR) / (teeth * 2.5);

    for (let i = 0; i < teeth; i++) {
      const angle = (i / teeth) * Math.PI * 2;
      const nextAngle = ((i + 1) / teeth) * Math.PI * 2;
      const midAngle = (angle + nextAngle) / 2;

      if (i === 0) {
        shape.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
      } else {
        shape.lineTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
      }
      shape.lineTo(Math.cos(angle + toothW * 0.5 / innerR) * outerR, Math.sin(angle + toothW * 0.5 / innerR) * outerR);
      shape.lineTo(Math.cos(midAngle - toothW * 0.5 / innerR) * outerR, Math.sin(midAngle - toothW * 0.5 / innerR) * outerR);
    }
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  const mat0 = new THREE.MeshStandardMaterial({ color: new THREE.Color(palette[0]), roughness: 0.3, metalness: 0.7 });
  const mat1 = new THREE.MeshStandardMaterial({ color: new THREE.Color(palette[1 % palette.length]), roughness: 0.3, metalness: 0.7 });

  const gear1 = makeGear(16, 1.5, 1.1, 0.35, mat0);
  gear1.position.set(-1.8, 0, 0);
  scene.add(gear1);

  const gear2 = makeGear(10, 1.0, 0.72, 0.35, mat1);
  gear2.position.set(1.4, 0, 0);
  scene.add(gear2);

  // Axle hubs
  const hubMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(palette[2 % palette.length]), roughness: 0.5, metalness: 0.5 });
  [gear1, gear2].forEach(g => {
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 20), hubMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = 0.17;
    g.add(hub);
  });

  // Gear ratio: 16 teeth : 10 teeth = 1 : 1.6
  const ratio = 16 / 10;

  return {
    update(t) {
      gear1.rotation.z = -t * 0.8;
      gear2.rotation.z = t * 0.8 * ratio;
    }
  };
}
`,
}

const objectBuildingBlocks: ThreeComponent = {
  id: 'object-building-blocks',
  name: 'Assembling Building Blocks',
  category: 'object',
  description: 'Cubes fly in and assemble into a structure over the animation duration.',
  tags: ['blocks', 'assemble', 'cubes', 'build', 'construct', 'modular'],
  buildCode: `
function buildObjectBuildingBlocks(scene, camera, palette, rand, DURATION) {
  const layout = [
    // [x, y, z, colorIndex]
    [-1, -1, 0, 0], [0, -1, 0, 1], [1, -1, 0, 0],
    [-1,  0, 0, 2], [0,  0, 0, 0], [1,  0, 0, 2],
    [-1,  1, 0, 1], [0,  1, 0, 2], [1,  1, 0, 1],
    [0, -1, 1, 1], [0,  0, 1, 0], [0,  1, 1, 2],
    [0,  0, 2, 1],
  ];

  const blockSize = 0.85;
  const gap = 0.05;
  const unit = blockSize + gap;

  const blocks = layout.map(([bx, by, bz, ci], i) => {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette[ci % palette.length]),
      roughness: 0.5,
      metalness: 0.05,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(blockSize, blockSize, blockSize), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const targetPos = new THREE.Vector3(bx * unit, by * unit, bz * unit);

    // Start above and far back
    const r = rand();
    const startPos = new THREE.Vector3(
      (r() * 12 - 6),
      8 + r() * 4,
      -8 - r() * 4
    );
    mesh.position.copy(startPos);
    mesh.scale.setScalar(0.01);
    scene.add(mesh);

    return { mesh, startPos, targetPos, delay: i * (DURATION * 0.04) };
  });

  const group = new THREE.Group();
  scene.add(group);
  blocks.forEach(b => group.add(b.mesh));

  return {
    update(t) {
      blocks.forEach(({ mesh, startPos, targetPos, delay }) => {
        const localT = Math.max(0, t - delay);
        const progress = Math.min(localT / (DURATION * 0.25), 1);
        const ease = 1 - Math.pow(1 - progress, 4);

        mesh.position.lerpVectors(startPos, targetPos, ease);
        mesh.scale.setScalar(Math.max(0.01, ease));
      });

      group.rotation.y = t * 0.2;
    }
  };
}
`,
}

const objectSvgExtrude: ThreeComponent = {
  id: 'object-svg-extrude',
  name: 'SVG Extrude',
  category: 'object',
  description: 'Extrudes an SVG file into 3D geometry with PBR materials. Set window.SVG_EXTRUDE_URL before building.',
  tags: ['svg', 'extrude', 'logo', 'brand', '3d', 'text', 'icon', 'vector'],
  buildCode: `
function buildObjectSvgExtrude(scene, camera, palette, rand, DURATION) {
  const svgUrl = window.SVG_EXTRUDE_URL;
  if (!svgUrl) { console.warn('No SVG_EXTRUDE_URL set'); return { update() {} }; }

  const pivot = new THREE.Group();
  scene.add(pivot);
  let loaded = false;

  import('three/addons/loaders/SVGLoader.js').then(({ SVGLoader }) => {
    fetch(svgUrl).then(r => r.text()).then(text => {
      const inner = new THREE.Group();
      const data = new SVGLoader().parse(text);
      let i = 0;
      for (const path of data.paths) {
        const shapes = SVGLoader.createShapes(path);
        for (const shape of shapes) {
          const geo = new THREE.ExtrudeGeometry(shape, {
            depth: 20, bevelEnabled: true,
            bevelThickness: 3, bevelSize: 2,
            bevelSegments: 8, curveSegments: 24,
          });
          const mat = new THREE.MeshStandardMaterial({
            color: palette[i % palette.length],
            metalness: 0.6, roughness: 0.25,
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.castShadow = true;
          inner.add(mesh);
          i++;
        }
      }
      const box = new THREE.Box3().setFromObject(inner);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      inner.position.set(-center.x, -center.y, -center.z);
      const maxDim = Math.max(size.x, size.y, size.z);
      const s = 4 / maxDim;
      pivot.scale.set(s, -s, s);
      pivot.add(inner);
      loaded = true;
    });
  });

  return {
    update(t) {
      if (!loaded) return;
      pivot.rotation.y = t * 0.3;
    }
  };
}
`,
}

const objectTrophyPedestal: ThreeComponent = {
  id: 'object-trophy-pedestal',
  name: 'Trophy Pedestal',
  category: 'object',
  description: 'A pedestal with a spotlight for showcasing other objects. Product display stand.',
  tags: ['pedestal', 'display', 'showcase', 'stand', 'product', 'trophy', 'spotlight'],
  buildCode: `
function buildObjectTrophyPedestal(scene, camera, palette, rand, DURATION) {
  // Base cylinder
  const baseMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette[0]),
    roughness: 0.2,
    metalness: 0.8,
  });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 0.3, 48), baseMat);
  base.position.y = -2.5;
  base.receiveShadow = true;
  base.castShadow = true;
  scene.add(base);

  // Column
  const colMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette[1 % palette.length]),
    roughness: 0.15,
    metalness: 0.9,
  });
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 2.0, 36), colMat);
  column.position.y = -1.35;
  column.castShadow = true;
  scene.add(column);

  // Top platform
  const topMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette[0]),
    roughness: 0.1,
    metalness: 0.9,
  });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.2, 0.2, 48), topMat);
  top.position.y = -0.25;
  top.receiveShadow = true;
  top.castShadow = true;
  scene.add(top);

  // Spotlight from above
  const spot = new THREE.SpotLight(0xffffff, 3, 20, Math.PI / 8, 0.6, 1.5);
  spot.position.set(0, 8, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.target.position.set(0, -0.25, 0);
  scene.add(spot, spot.target);

  return {
    update(t) {
      spot.intensity = 3 + Math.sin(t * 1.5) * 0.3;
    }
  };
}
`,
}

const objectFloatingCards: ThreeComponent = {
  id: 'object-floating-cards',
  name: 'Floating Cards',
  category: 'object',
  description: 'Multiple cards floating and slowly rotating in space. Info displays or feature showcases.',
  tags: ['cards', 'float', 'info', 'panels', 'display', 'features', 'ui'],
  buildCode: `
function buildObjectFloatingCards(scene, camera, palette, rand, DURATION) {
  const cards = [];
  const count = 5;

  for (let i = 0; i < count; i++) {
    const geo = new THREE.BoxGeometry(2, 1.2, 0.05);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette[i % palette.length]),
      roughness: 0.3,
      metalness: 0.1,
    });
    const card = new THREE.Mesh(geo, mat);
    card.castShadow = true;

    const angle = (i / count) * Math.PI * 2;
    const radius = 3.5;
    card.position.set(
      Math.cos(angle) * radius,
      (rand() - 0.5) * 2,
      Math.sin(angle) * radius
    );
    card.lookAt(0, card.position.y, 0);

    scene.add(card);
    cards.push({ mesh: card, angle, baseY: card.position.y, phase: rand() * Math.PI * 2 });
  }

  return {
    update(t) {
      cards.forEach(({ mesh, angle, baseY, phase }) => {
        const a = angle + t * 0.2;
        mesh.position.x = Math.cos(a) * 3.5;
        mesh.position.z = Math.sin(a) * 3.5;
        mesh.position.y = baseY + Math.sin(t * 0.8 + phase) * 0.3;
        mesh.lookAt(0, mesh.position.y, 0);
      });
    }
  };
}
`,
}

const objectHelixParticles: ThreeComponent = {
  id: 'object-helix-particles',
  name: 'Helix Particles',
  category: 'object',
  description: 'Particles arranged in a rotating double-helix pattern. DNA-like or data stream aesthetic.',
  tags: ['helix', 'particles', 'dna', 'spiral', 'data', 'stream'],
  buildCode: `
function buildObjectHelixParticles(scene, camera, palette, rand, DURATION) {
  const count = 120;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const c0 = new THREE.Color(palette[0]);
  const c1 = new THREE.Color(palette[1 % palette.length]);

  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 6;
    const strand = i % 2;
    const r = 1.5;
    const x = Math.cos(t + strand * Math.PI) * r;
    const z = Math.sin(t + strand * Math.PI) * r;
    const y = (i / count) * 8 - 4;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    const c = strand === 0 ? c0 : c1;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({ size: 0.15, vertexColors: true, sizeAttenuation: true });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  return {
    update(t) {
      points.rotation.y = t * 0.3;
      const pos = geo.attributes.position;
      for (let i = 0; i < count; i++) {
        const base = (i / count) * Math.PI * 6;
        const strand = i % 2;
        pos.setX(i, Math.cos(base + strand * Math.PI + t * 0.5) * 1.5);
        pos.setZ(i, Math.sin(base + strand * Math.PI + t * 0.5) * 1.5);
      }
      pos.needsUpdate = true;
    }
  };
}
`,
}

const objectMorphingSphere: ThreeComponent = {
  id: 'object-morphing-sphere',
  name: 'Morphing Sphere',
  category: 'object',
  description: 'A sphere with animated vertex displacement creating organic morphing shapes.',
  tags: ['morph', 'sphere', 'displacement', 'organic', 'blob', 'animate', 'abstract'],
  buildCode: `
function buildObjectMorphingSphere(scene, camera, palette, rand, DURATION) {
  const geo = new THREE.SphereGeometry(1.8, 64, 64);
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(palette[0]),
    roughness: 0.2,
    metalness: 0.6,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  scene.add(mesh);

  // Store original positions
  const origPos = new Float32Array(geo.attributes.position.array);

  return {
    update(t) {
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const ox = origPos[i * 3];
        const oy = origPos[i * 3 + 1];
        const oz = origPos[i * 3 + 2];
        const len = Math.sqrt(ox * ox + oy * oy + oz * oz);
        const nx = ox / len, ny = oy / len, nz = oz / len;

        // Multi-frequency noise displacement
        const d = 0.15 * Math.sin(nx * 4 + t * 1.5)
                + 0.1 * Math.sin(ny * 6 + t * 2.3)
                + 0.08 * Math.sin(nz * 8 + t * 1.8);

        pos.setXYZ(i, ox + nx * d, oy + ny * d, oz + nz * d);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      mesh.rotation.y = t * 0.2;
    }
  };
}
`,
}

// ── Environment Components ────────────────────────────────────────────────────

const envGridFloor: ThreeComponent = {
  id: 'env-grid-floor',
  name: 'Grid Floor',
  category: 'environment',
  description: 'Infinite-looking grid plane below the scene objects. Classic tech/blueprint aesthetic.',
  tags: ['grid', 'floor', 'ground', 'plane', 'tech', 'blueprint', 'base'],
  buildCode: `
function buildEnvGridFloor(scene, camera, palette, rand, DURATION) {
  // Shadow-receiving floor
  const floorGeo = new THREE.PlaneGeometry(30, 30);
  const floorMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette[palette.length - 1] || '#111111'),
    roughness: 1,
    metalness: 0,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.5;
  floor.receiveShadow = true;
  scene.add(floor);

  // Grid helper on top of floor
  const grid = new THREE.GridHelper(30, 30, palette[1] || '#333333', palette[1] || '#222222');
  grid.position.y = -2.49;
  grid.material.transparent = true;
  grid.material.opacity = 0.35;
  scene.add(grid);

  return { update(t) {} };
}
`,
}

const envParticlesBg: ThreeComponent = {
  id: 'env-particles-bg',
  name: 'Drifting Particles',
  category: 'environment',
  description: 'Slowly drifting background particles with seeded positions. Adds depth and atmosphere.',
  tags: ['particles', 'dust', 'stars', 'background', 'atmosphere', 'float', 'drift'],
  buildCode: `
function buildEnvParticlesBg(scene, camera, palette, rand, DURATION) {
  const count = 180;
  const positions = new Float32Array(count * 3);
  const velocities = [];

  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = (rand() - 0.5) * 24;
    positions[i * 3 + 1] = (rand() - 0.5) * 14;
    positions[i * 3 + 2] = (rand() - 0.5) * 16 - 4;
    velocities.push({
      x: (rand() - 0.5) * 0.3,
      y: (rand() - 0.5) * 0.15,
    });
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3));

  const mat = new THREE.PointsMaterial({
    color: new THREE.Color(palette[1] || '#aaaaaa'),
    size: 0.08,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true,
  });

  const particles = new THREE.Points(geo, mat);
  scene.add(particles);

  const posAttr = geo.attributes.position;
  const initialPositions = positions.slice();

  return {
    update(t) {
      for (let i = 0; i < count; i++) {
        posAttr.setX(i, initialPositions[i * 3 + 0] + velocities[i].x * t);
        posAttr.setY(i, initialPositions[i * 3 + 1] + velocities[i].y * t);
      }
      posAttr.needsUpdate = true;
    }
  };
}
`,
}

const envGradientBg: ThreeComponent = {
  id: 'env-gradient-bg',
  name: 'Gradient Background',
  category: 'environment',
  description: 'Gradient sky/background using a large sphere with vertex colors, drawn from palette.',
  tags: ['gradient', 'background', 'sky', 'atmosphere', 'color', 'ambient'],
  buildCode: `
function buildEnvGradientBg(scene, camera, palette, rand, DURATION) {
  // Large sphere with gradient inside
  const geo = new THREE.SphereGeometry(50, 32, 16);

  // Flip normals to render inside the sphere
  geo.index?.array && (geo.index.array); // ensure index exists
  for (let i = 0; i < geo.attributes.normal.count; i++) {
    geo.attributes.normal.setXYZ(
      i,
      -geo.attributes.normal.getX(i),
      -geo.attributes.normal.getY(i),
      -geo.attributes.normal.getZ(i)
    );
  }

  // Use vertex colors for gradient
  const posAttr = geo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);
  const colorTop = new THREE.Color(palette[0]);
  const colorBot = new THREE.Color(palette[1 % palette.length]);

  for (let i = 0; i < posAttr.count; i++) {
    const y = posAttr.getY(i);
    const t = (y + 50) / 100; // 0 = bottom, 1 = top
    const c = colorBot.clone().lerp(colorTop, t);
    colors[i * 3 + 0] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
  const skySphere = new THREE.Mesh(geo, mat);
  scene.add(skySphere);

  return { update(t) {} };
}
`,
}

const envStudioBackdrop: ThreeComponent = {
  id: 'env-studio-backdrop',
  name: 'Studio Backdrop',
  category: 'environment',
  description: 'Curved cyclorama studio backdrop with floor. Clean product photography look.',
  tags: ['studio', 'backdrop', 'cyclorama', 'product', 'clean', 'photography'],
  buildCode: `
function buildEnvStudioBackdrop(scene, camera, palette, rand, DURATION) {
  // Create curved backdrop using LatheGeometry (half revolution)
  const points = [];
  const radius = 15;
  const height = 12;
  // Floor curve up to back wall
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const angle = t * Math.PI * 0.5;
    points.push(new THREE.Vector2(
      radius * Math.cos(angle),
      -3 + (height + 3) * Math.sin(angle)
    ));
  }

  const geo = new THREE.LatheGeometry(points, 64, -Math.PI * 0.6, Math.PI * 1.2);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette[palette.length - 1] || '#f0f0f0'),
    roughness: 0.9,
    metalness: 0,
    side: THREE.BackSide,
  });
  const backdrop = new THREE.Mesh(geo, mat);
  backdrop.receiveShadow = true;
  scene.add(backdrop);

  // Floor plane
  const floorGeo = new THREE.PlaneGeometry(30, 30);
  const floorMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette[palette.length - 1] || '#f0f0f0'),
    roughness: 0.8,
    metalness: 0,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -3;
  floor.receiveShadow = true;
  scene.add(floor);

  return { update(t) {} };
}
`,
}

const envFogAtmosphere: ThreeComponent = {
  id: 'env-fog-atmosphere',
  name: 'Fog Atmosphere',
  category: 'environment',
  description: 'Adds exponential fog for depth and atmosphere. Objects fade into background.',
  tags: ['fog', 'atmosphere', 'depth', 'haze', 'fade', 'mood'],
  buildCode: `
function buildEnvFogAtmosphere(scene, camera, palette, rand, DURATION) {
  const fogColor = new THREE.Color(palette[palette.length - 1] || '#1a1a2e');
  scene.fog = new THREE.FogExp2(fogColor, 0.04);
  scene.background = fogColor;

  return { update(t) {} };
}
`,
}

const envHdriRoom: ThreeComponent = {
  id: 'env-hdri-room',
  name: 'HDRI Room',
  category: 'environment',
  description: 'RoomEnvironment from Three.js addons. Realistic indoor reflections without external HDRI files.',
  tags: ['hdri', 'room', 'environment-map', 'reflections', 'indoor', 'pbr'],
  buildCode: `
function buildEnvHdriRoom(scene, camera, palette, rand, DURATION) {
  // Use the built-in RoomEnvironment for realistic PBR reflections
  // This creates a procedural room with neutral lighting
  const pmrem = new THREE.PMREMGenerator(scene.__renderer || camera.__renderer);

  // Fallback to setupEnvironment approach
  const envScene = new THREE.Scene();
  const roomGeo = new THREE.BoxGeometry(20, 10, 20);
  const roomMat = new THREE.MeshBasicMaterial({
    color: 0xf0f0f0,
    side: THREE.BackSide,
  });
  envScene.add(new THREE.Mesh(roomGeo, roomMat));

  // Light panels
  const panelGeo = new THREE.PlaneGeometry(6, 4);
  const panelMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const topPanel = new THREE.Mesh(panelGeo, panelMat);
  topPanel.position.set(0, 4.9, 0);
  topPanel.rotation.x = Math.PI / 2;
  envScene.add(topPanel);

  const sidePanel = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), panelMat);
  sidePanel.position.set(-9.9, 2, 0);
  sidePanel.rotation.y = Math.PI / 2;
  envScene.add(sidePanel);

  try {
    const envMap = pmrem.fromScene(envScene, 0.04).texture;
    scene.environment = envMap;
    pmrem.dispose();
  } catch(e) {
    console.warn('envHdriRoom: PMREMGenerator failed', e);
  }

  return { update(t) {} };
}
`,
}

// ── Text Components ──────────────────────────────────────────────────────────

const objectTextTitle: ThreeComponent = {
  id: 'object-text-title',
  name: 'Title Text 3D',
  category: 'object',
  description: 'Large 3D title text with subtitle using troika-three-text. Outline, letter spacing, gentle float.',
  tags: ['text', 'title', 'troika', '3d-text', 'headline', 'typography'],
  buildCode: `
function buildObjectTextTitle(scene, camera, palette, rand, DURATION) {
  // Dynamic import since troika is an external module
  let mainText = null, subText = null;
  import('troika-three-text').then(function(mod) {
    const Text = mod.Text;
    mainText = new Text();
    mainText.text = 'TITLE';
    mainText.fontSize = 2.0;
    mainText.anchorX = 'center';
    mainText.anchorY = 'middle';
    mainText.position.set(0, 1.2, 0);
    mainText.color = palette[1 % palette.length];
    mainText.outlineWidth = 0.03;
    mainText.outlineColor = '#000000';
    mainText.letterSpacing = 0.06;
    mainText.sync();
    scene.add(mainText);

    subText = new Text();
    subText.text = 'SUBTITLE';
    subText.fontSize = 0.8;
    subText.anchorX = 'center';
    subText.anchorY = 'middle';
    subText.position.set(0, -0.8, 0);
    subText.color = palette[3 % palette.length];
    subText.outlineWidth = 0.015;
    subText.outlineColor = '#000000';
    subText.letterSpacing = 0.12;
    subText.sync();
    scene.add(subText);
  }).catch(function(e) { console.warn('troika-three-text not available:', e); });

  return {
    update(t) {
      if (mainText) {
        mainText.position.y = 1.2 + Math.sin(t * 0.4) * 0.15;
        mainText.rotation.y = Math.sin(t * 0.15) * 0.1;
      }
      if (subText) {
        subText.position.y = -0.8 + Math.sin(t * 0.4 + 0.5) * 0.1;
        subText.rotation.y = Math.sin(t * 0.15 + 0.3) * -0.08;
      }
    }
  };
}
`,
}

// ── Utility Components ───────────────────────────────────────────────────────

const objectWireframeBox: ThreeComponent = {
  id: 'object-wireframe-box',
  name: 'Wireframe Box',
  category: 'object',
  description: 'Transparent box with glowing edge lines. Tech/AI/architecture aesthetic.',
  tags: ['wireframe', 'edges', 'tech', 'ai', 'architecture', 'box', 'glow', 'line'],
  buildCode: `
function buildObjectWireframeBox(scene, camera, palette, rand, DURATION) {
  const group = new THREE.Group();

  const boxGeo = new THREE.BoxGeometry(2, 2, 2);
  const boxMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(palette[0]),
    transparent: true,
    opacity: 0.08,
    roughness: 0.1,
    metalness: 0.5,
    transmission: 0.6,
  });
  const box = new THREE.Mesh(boxGeo, boxMat);
  group.add(box);

  const edgesGeo = new THREE.EdgesGeometry(boxGeo);
  const edgesMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(palette[1 % palette.length]),
    linewidth: 2,
  });
  const edges = new THREE.LineSegments(edgesGeo, edgesMat);
  group.add(edges);

  // Corner spheres for visual emphasis
  const cornerPositions = [
    [-1,-1,-1],[-1,-1,1],[-1,1,-1],[-1,1,1],
    [1,-1,-1],[1,-1,1],[1,1,-1],[1,1,1]
  ];
  const dotGeo = new THREE.SphereGeometry(0.06, 8, 8);
  const dotMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette[1 % palette.length]),
    emissive: new THREE.Color(palette[1 % palette.length]),
    emissiveIntensity: 0.8,
  });
  cornerPositions.forEach(function(p) {
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(p[0], p[1], p[2]);
    group.add(dot);
  });

  group.castShadow = true;
  scene.add(group);

  return {
    update(t) {
      group.rotation.y = t * 0.3;
      group.rotation.x = Math.sin(t * 0.2) * 0.15;
    }
  };
}
`,
}

// ── Component Registry ────────────────────────────────────────────────────────

/** All available pre-built Three.js components, organized by category. */
export const THREE_COMPONENTS: ThreeComponent[] = [
  // Lighting
  lightingStudio,
  lightingDramatic,
  lightingSoftOverhead,
  lightingNeon,
  lightingCinematic,
  lightingSunset,
  // Camera
  cameraOrbitSlow,
  cameraPullback,
  cameraTopDown,
  cameraIsometric,
  cameraDollyIn,
  cameraCraneUp,
  cameraPath,
  // Objects
  objectFloatingSphere,
  objectDnaHelix,
  objectBarChart3D,
  objectAtom,
  objectGearPair,
  objectBuildingBlocks,
  objectSvgExtrude,
  objectTrophyPedestal,
  objectFloatingCards,
  objectHelixParticles,
  objectMorphingSphere,
  objectTextTitle,
  objectWireframeBox,
  // Environment
  envGridFloor,
  envParticlesBg,
  envGradientBg,
  envStudioBackdrop,
  envFogAtmosphere,
  envHdriRoom,
]

/** Look up a component by id. Returns undefined if not found. */
export function getComponent(id: string): ThreeComponent | undefined {
  return THREE_COMPONENTS.find((c) => c.id === id)
}

/** Filter components by category. */
export function getComponentsByCategory(category: ThreeComponent['category']): ThreeComponent[] {
  return THREE_COMPONENTS.filter((c) => c.category === category)
}

// ── Scene Assembler ───────────────────────────────────────────────────────────

export interface AssembleThreeSceneConfig {
  /** Component id for the lighting rig (from lighting category) */
  lighting: string
  /** Component id for the camera behaviour (from camera category) */
  camera: string
  /** Component ids for scene objects (from object category) */
  objects: string[]
  /** Optional component id for the environment (from environment category) */
  environment?: string
  /** Optional raw JS to append after all components are initialized */
  customCode?: string
  /** Color palette (hex strings) passed to all components */
  palette: string[]
  /** Scene duration in seconds */
  duration: number
  /** The DOM element id that the renderer should append into */
  layerId: string
  /** Enable cinematic post-processing (bloom + output pass). Default: false */
  postProcessing?: boolean | { bloom?: number; dof?: boolean; focusDistance?: number }
}

/**
 * Assembles a complete Three.js scene JS string from component ids.
 *
 * The output is a single JS string ready for injection into the Three.js
 * scene template (inside the <script type="module"> block, after globals
 * are defined). The script:
 * 1. Injects all selected component buildCode functions
 * 2. Creates the renderer and scene using r183 boilerplate
 * 3. Calls each build function and collects their update handles
 * 4. Runs a GSAP timeline onUpdate loop calling every update(t)
 *
 * @param config - Component selection and scene configuration
 * @returns Complete JS string for the scene template
 */
export function assembleThreeScene(config: AssembleThreeSceneConfig): string {
  const { lighting, camera, objects, environment, customCode, palette, duration, layerId, postProcessing } = config

  const componentIds = [lighting, camera, ...(environment ? [environment] : []), ...objects]

  const missing = componentIds.filter((id) => !getComponent(id))
  if (missing.length > 0) {
    throw new Error(`Unknown Three.js component ids: ${missing.join(', ')}`)
  }

  const components = componentIds.map((id) => getComponent(id)!)
  const functionBodies = components.map((c) => c.buildCode.trim()).join('\n\n')

  // Build the call site: call each build function in order
  const callLighting = `const _lighting = ${getFunctionName(lighting)}(scene, camera, _palette, _rand, DURATION);`
  const callCamera = `const _camera = ${getFunctionName(camera)}(scene, camera, _palette, _rand, DURATION);`
  const callEnvironment = environment
    ? `const _env = ${getFunctionName(environment)}(scene, camera, _palette, _rand, DURATION);`
    : ''
  const callObjects = objects
    .map((id, i) => `const _obj${i} = ${getFunctionName(id)}(scene, camera, _palette, _rand, DURATION);`)
    .join('\n  ')

  // Collect all handles for the update loop
  const handles = ['_lighting', '_camera', ...(environment ? ['_env'] : []), ...objects.map((_, i) => `_obj${i}`)]
  const updateCalls = handles.map((h) => `  if (${h} && ${h}.update) ${h}.update(t);`).join('\n')

  const ppEnabled = !!postProcessing
  const ppConfig = typeof postProcessing === 'object' ? postProcessing : {}
  const bloomStrength = ppConfig.bloom ?? 0.35
  const ppImports = ppEnabled
    ? `import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';`
    : ''
  const ppSetup = ppEnabled
    ? `
// ── Post-Processing ──────────────────────────────────────────────────────────
const _composer = new EffectComposer(renderer);
_composer.addPass(new RenderPass(scene, camera));
_composer.addPass(new UnrealBloomPass(new THREE.Vector2(WIDTH, HEIGHT), ${bloomStrength}, 0.4, 0.85));
_composer.addPass(new OutputPass());`
    : ''
  const renderCall = ppEnabled ? '_composer.render();' : 'renderer.render(scene, camera);'

  return `
import * as THREE from 'three';
${ppImports}
const { WIDTH, HEIGHT, DURATION, mulberry32, setupEnvironment } = window;

${functionBodies}

// ── Scene Setup ───────────────────────────────────────────────────────────────

const _palette = ${JSON.stringify(palette)};
const _rand = mulberry32(42);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(WIDTH, HEIGHT);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('${layerId}').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, WIDTH / HEIGHT, 0.1, 1000);
camera.position.set(0, 4, 10);
camera.lookAt(0, 0, 0);

// ── Component Initialisation ──────────────────────────────────────────────────

${callLighting}
${callCamera}
${callEnvironment}
${callObjects}

${customCode ? `// ── Custom Code ──────────────────────────────────────────────────────────────\n${customCode}` : ''}
${ppSetup}

// ── Animation Loop (GSAP timeline — seekable, pausable, exportable) ──────────

const _state = { progress: 0 };
window.__tl.to(_state, {
  progress: 1,
  duration: DURATION,
  ease: 'none',
  onUpdate: function() {
    const t = _state.progress * DURATION;

${updateCalls}

    ${renderCall}
  }
}, 0);

// Initial render so scene is visible while paused
${renderCall}
`.trim()
}

/** Derive the function name from a component id. e.g. 'lighting-studio' → 'buildLightingStudio' */
function getFunctionName(id: string): string {
  return (
    'build' +
    id
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')
  )
}
