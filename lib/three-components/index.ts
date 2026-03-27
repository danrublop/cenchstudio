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

// ── Component Registry ────────────────────────────────────────────────────────

/** All available pre-built Three.js components, organized by category. */
export const THREE_COMPONENTS: ThreeComponent[] = [
  // Lighting
  lightingStudio,
  lightingDramatic,
  lightingSoftOverhead,
  lightingNeon,
  // Camera
  cameraOrbitSlow,
  cameraPullback,
  cameraTopDown,
  cameraIsometric,
  // Objects
  objectFloatingSphere,
  objectDnaHelix,
  objectBarChart3D,
  objectAtom,
  objectGearPair,
  objectBuildingBlocks,
  // Environment
  envGridFloor,
  envParticlesBg,
  envGradientBg,
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
 * 4. Runs a unified rAF loop calling every update(t)
 *
 * @param config - Component selection and scene configuration
 * @returns Complete JS string for the scene template
 */
export function assembleThreeScene(config: AssembleThreeSceneConfig): string {
  const { lighting, camera, objects, environment, customCode, palette, duration, layerId } = config

  const componentIds = [
    lighting,
    camera,
    ...(environment ? [environment] : []),
    ...objects,
  ]

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
  const handles = [
    '_lighting',
    '_camera',
    ...(environment ? ['_env'] : []),
    ...objects.map((_, i) => `_obj${i}`),
  ]
  const updateCalls = handles.map((h) => `  if (${h} && ${h}.update) ${h}.update(t);`).join('\n')

  return `
import * as THREE from 'three';

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

// ── Animation Loop ────────────────────────────────────────────────────────────

const _startTime = performance.now();

function _animate() {
  const t = (performance.now() - _startTime) / 1000;
  if (t > DURATION) {
    renderer.render(scene, camera);
    return;
  }

${updateCalls}

  renderer.render(scene, camera);
  window.__animFrame = requestAnimationFrame(_animate);
}

window.__resume = () => { window.__animFrame = requestAnimationFrame(_animate); };
window.__animFrame = requestAnimationFrame(_animate);
`.trim()
}

/** Derive the function name from a component id. e.g. 'lighting-studio' → 'buildLightingStudio' */
function getFunctionName(id: string): string {
  return 'build' + id
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}
