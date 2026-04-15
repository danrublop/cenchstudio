---
id: threejs-3d-scene
name: Three.js 3D Scene
category: 3d
tags: [three, threejs, 3d, webgl, scene, camera, mesh, material, environment]
sceneType: three
complexity: complex
requires: []
description: Three.js r183 3D scenes with PBR materials, environments, and camera animation. For immersive 3D content, data scatter plots, and WebGL effects.
parameters:
  - name: environment
    type: string
    default: track_rolling_topdown
    description: Stage environment ID
  - name: camera
    type: string
    default: perspective
    description: Camera type
    enum: [perspective, orthographic]
---

## Three.js Scenes

- Use **Three.js r183** via ES modules: `import * as THREE from 'three';` and read `WIDTH, HEIGHT, PALETTE, DURATION, MATERIALS, mulberry32, setupEnvironment, applyCenchThreeEnvironment, updateCenchThreeEnvironment` from `window`.
- Set `window.__threeCamera = camera` for editor camera moves.
- **Stage environment:** call `applyCenchThreeEnvironment('track_rolling_topdown', scene, renderer, camera)` once (rolling track lanes backdrop). Each frame call `updateCenchThreeEnvironment(window.__tl?.time?.() ?? t)` so marbles scrub with the timeline.
- The only built-in stage id is `track_rolling_topdown` (rolling track lanes). Older ids in saved scenes fall back to it at runtime.
- **3D scatter plots:** use tool `three_data_scatter_scene` with `studioEnvironmentId` + `points[{x,y,z}]` for a Cortico-style 3D scatter implemented in vanilla Three.js — no React.
- Add hero content (models, meshes, story motion) on top of the environment; do not delete group `__cenchEnvRoot`.
- Prefer `MeshStandardMaterial` / `MeshPhysicalMaterial`; use `setupEnvironment(scene, renderer)` for PBR reflections when the scene is studio-like and you are not using a conflicting full-sky env.

## When to Use Three.js

- 3D product showcases, architectural walkthroughs
- Data scatter plots in 3D space
- Particle systems with GPU acceleration
- Immersive environments and camera flyovers
- WebGL shader effects

## Gotchas

- NEVER use CapsuleGeometry (not available in r183)
- Always set `window.__threeCamera` for editor integration
- Don't delete `__cenchEnvRoot` group when using environments
