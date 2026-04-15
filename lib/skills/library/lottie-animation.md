---
id: lottie-animation
name: Lottie Animation
category: animation
tags: [lottie, bodymovin, json, vector, animation, keyframes, easing]
sceneType: lottie
complexity: complex
requires: []
description: Lottie JSON animations rendered by lottie-web (bodymovin 5.12.2). For complex vector animations with precise keyframe control.
parameters:
  - name: frameRate
    type: number
    default: 30
    description: Animation frame rate
  - name: width
    type: number
    default: 1920
    description: Canvas width
  - name: height
    type: number
    default: 1080
    description: Canvas height
---

## Lottie Scenes

- Generates Lottie JSON (not SVG) — rendered by lottie-web (bodymovin 5.12.2)
- Canvas: w=1920, h=1080, fr=30
- CRITICAL: Every animated keyframe (except the last) MUST have bezier easing handles:
  `"i": {"x":[0.42],"y":[0]}, "o": {"x":[0.58],"y":[1]}` (1D properties)
  `"i": {"x":[0.42,0.42,0.42],"y":[0,0,0]}, "o": {"x":[0.58,0.58,0.58],"y":[1,1,1]}` (3D: position/scale/anchor)
  Without these, lottie-web throws renderFrameError and nothing renders.
- Shape types: el (ellipse), rc (rect), sr (star), sh (bezier path), fl (fill), st (stroke), gr (group)
- Timeline integration is automatic (built into template)
- For pre-made Lottie animations, use search_lottie tool + CenchMotion.lottieSync() instead of generating raw Lottie JSON

## When to Use Lottie

- Complex vector animations with precise timing
- Animations that need to loop seamlessly
- When you have After Effects-style layer composition
- Icon and illustration animations

## Gotchas

- Missing easing handles is the #1 crash cause — ALWAYS include them
- Raw Lottie JSON is verbose — prefer search_lottie + CenchMotion.lottieSync for pre-built
- No interactivity support within Lottie — combine with motion scene for interactive elements
