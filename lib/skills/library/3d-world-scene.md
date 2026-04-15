---
id: 3d-world-scene
name: 3D World Scene
category: 3d
tags: [3d, world, environment, immersive, camera-path, meadow, studio, void, panels]
sceneType: 3d_world
complexity: complex
requires: []
description: Immersive 3D environments with placed objects, floating text panels, and animated camera paths. Use create_world_scene tool.
parameters:
  - name: environment
    type: string
    default: meadow
    description: 3D environment preset
    enum: [meadow, studio_room, void_space]
  - name: minDuration
    type: number
    default: 4
    description: Minimum scene duration in seconds
---

## 3D World Scenes

Use `create_world_scene` instead of `add_layer`:
- Call `list_3d_assets` first to find valid asset IDs
- Provide camera_path with at least start and end keyframes
- Place panels for HTML/text content that floats in the 3D space
- Match objects to environment: nature assets in meadow, furniture in studio_room
- Minimum 4-second duration — 3D worlds need time to establish

Environments: meadow (outdoor), studio_room (indoor), void_space (dark/abstract).

## When to Use 3D Worlds

- Immersive product showcases or virtual tours
- Architectural or spatial storytelling
- Content that benefits from depth and camera movement
- Abstract concept visualization in 3D space

## Camera Path Tips

- Always include at least start and end keyframes
- Smooth curves work better than sharp turns
- Use easing for cinematic feel
- Keep camera movement purposeful — don't rotate just because you can
