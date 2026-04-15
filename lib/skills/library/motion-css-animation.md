---
id: motion-css-animation
name: Motion / GSAP Animation
category: animation
tags: [motion, gsap, css, animation, anime, splittext, drawsvg, morphsvg, cenchmotion, timeline]
sceneType: motion
complexity: medium
requires: []
description: Motion scenes with GSAP 3.14 timeline, CenchMotion component library, SplitText, DrawSVG, MorphSVG. Best for layout-heavy explainers with text reveals and element animations.
parameters:
  - name: timelineMode
    type: string
    default: gsap
    description: Animation engine
    enum: [gsap, css-only]
---

## Motion Scenes

- All animation timing MUST go through window.__tl (GSAP master timeline)
- Use progress-based animation: GSAP tweens a proxy 0→1, onUpdate drives all element changes
- NEVER use standalone anime() timelines, setTimeout, or requestAnimationFrame
- Use flexbox/grid for layout — NEVER position:absolute with pixel values (causes overflow)
- Use clamp(), vw/vh, percentages for responsive sizing
- CSS @keyframes for entrance animations so content shows before play is pressed
- Do NOT redeclare template globals (DURATION, WIDTH, HEIGHT, PALETTE, etc.)

## CenchMotion Component Library (available in all scene types)

All scenes load CenchMotion — pre-built GSAP animation components. Use these instead of writing raw GSAP for common patterns:

GSAP 3.14 with ALL plugins (SplitText, DrawSVG, MorphSVG, MotionPath, TextPlugin, CustomEase) is loaded automatically. All free, no license concerns.

### TEXT ANIMATIONS — always use SplitText via CenchMotion:
```js
CenchMotion.textReveal('.title', { style: 'chars', tl })          // character stagger
CenchMotion.textReveal('.subtitle', { style: 'words', tl })       // word stagger
CenchMotion.textReveal('.headline', { style: 'mask', tl })        // cinematic mask reveal
CenchMotion.textReveal('.code', { style: 'typewriter', tl })      // typing effect
CenchMotion.textReveal('.intro', { style: 'scatter', tl })        // chars fly in from random positions
```

### ELEMENT REVEALS:
```js
CenchMotion.fadeUp('.element', { tl, delay: 0.3 })
CenchMotion.staggerIn('.cards .card', { tl, stagger: 0.1, from: 'start', direction: 'up' })
CenchMotion.scaleIn('.icon', { tl, ease: 'back.out(1.7)' })
CenchMotion.slideIn('.panel', { from: 'right', tl })
CenchMotion.floatIn('.card', { direction: 'up', tl })
CenchMotion.flipReveal('.card', { axis: 'Y', tl })
```

### NUMBERS & PROGRESS:
```js
CenchMotion.countUp('#revenue', { to: 2400000, format: ',.0f', prefix: '$', tl })
CenchMotion.countUp('#growth', { to: 47, suffix: '%', tl })
CenchMotion.countUp('#users', { to: 1200000, format: '.2s', tl })         // → 1.2M
CenchMotion.progressBar('.bar', { to: 73, tl })
```

### SVG (DrawSVG, MorphSVG, MotionPath — all free):
```js
CenchMotion.drawPath('.chart-line path', { tl })
CenchMotion.morphShape('#icon', { to: '#icon-target', tl })
CenchMotion.pathFollow('.arrow', { path: '#flow-path', tl })
```

### HIGHLIGHT:
```js
CenchMotion.highlightReveal('.keyword', { color: '#FFE066', style: 'background', tl })
```

### PRE-MADE LOTTIE ILLUSTRATIONS:
```js
// First: search_lottie("checkmark success") → get URL
// Then: CenchMotion.lottieSync('#lottie-wrap', { src: url, tl, delay: 0.3 })
```

For custom animations not covered by CenchMotion, write GSAP directly — all plugins are available.
