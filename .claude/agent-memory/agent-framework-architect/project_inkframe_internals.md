---
name: Cench Studio Editor Internals
description: Data model, store structure, scene types, and API routes in the Cench Studio codebase
type: project
---

## State Management
- Single Zustand store at `lib/store.ts` with `persist` middleware
- Main store type: `VideoStore`
- Key state: `scenes: Scene[]`, `selectedSceneId`, `globalStyle: GlobalStyle`, `project: Project`
- Chat/agent state added: `chatMessages`, `isChatOpen`, `isAgentRunning`, `agentOverride`, etc.

## Scene Data Model (`lib/types.ts`)
- `Scene` has: `id`, `name`, `prompt`, `summary`, `svgContent`, `sceneType`, `duration`, `bgColor`
- Layer types on Scene: `svgObjects: SvgObject[]`, `aiLayers: AILayer[]`, `textOverlays: TextOverlay[]`
- `videoLayer: VideoLayer`, `audioLayer: AudioLayer` (one each per scene)
- `interactions: InteractionElement[]` for interactive mode
- `sceneType`: `'svg' | 'canvas2d' | 'motion' | 'd3' | 'three' | 'lottie'`
- Code fields: `svgContent` (for svg), `canvasCode` (canvas2d), `sceneCode` (motion/d3/three), `lottieSource`, `sceneHTML` (generated)

## SvgObject
- `{ id, prompt, svgContent, x, y, width, opacity, zIndex }`
- Positions in % of canvas (0-100)
- Primary object tracked via `scene.primaryObjectId`

## AI Layer Types
- `AvatarLayer` (HeyGen), `Veo3Layer`, `ImageLayer`, `StickerLayer`
- All have `status: MediaLayerStatus = 'pending' | 'generating' | 'removing-bg' | 'ready' | 'error'`

## API Routes (`app/api/`)
- `/api/generate` — SVG generation
- `/api/generate-canvas` — Canvas2D code gen
- `/api/generate-motion` — Motion/CSS animation
- `/api/generate-d3` — D3 chart
- `/api/generate-three` — Three.js
- `/api/generate-lottie` — Lottie overlay
- `/api/scene` — Save/retrieve scene HTML (POST saves HTML to disk)
- `/api/agent` — New SSE streaming agent endpoint
- `/api/publish`, `/api/export` — Publishing/export

## HTML Generation
- `lib/sceneTemplate.ts` exports `generateSceneHTML(scene: Scene): string`
- Called server-side and in store to rebuild scene HTML after changes
- Canvas HTML always 1920x1080, uses `__pause`/`__resume` stubs
- Zdog supported via `(scene.sceneType as string) === 'zdog'` guard (not in SceneType union — do NOT modify types.ts)
- Three.js template upgraded to r183 importmap (ES modules), includes MATERIALS presets and mulberry32

## 3D Enhancement System (added 2026-03-26)
- `lib/three-components/index.ts` — Pre-built Three.js component library
  - 4 lighting rigs, 4 camera behaviours, 6 object components, 3 environment components
  - `ThreeComponent` interface: { id, name, category, description, tags, buildCode }
  - `assembleThreeScene(config)` — composes components into a complete scene JS string
  - Component buildCode functions are self-contained, signature: `buildXxx(scene, camera, palette, rand, DURATION)`
- `lib/generation/prompts.ts` — `ZDOG_SYSTEM_PROMPT` added, outputs raw JS (like canvas2d)
- `lib/generation/generate.ts` — 'zdog' case added to both switch blocks, returns raw text
- `lib/sceneTemplate.ts` — `generateZdogHTML` added; loads Zdog from CDN, canvas id=`zdog-canvas`

## Key Patterns
- `saveSceneHTML(sceneId)`: calls `/api/scene` POST then bumps `sceneHtmlVersion` to trigger PreviewPlayer refresh
- `sceneHtmlVersion: number` — increment triggers iframe re-render in PreviewPlayer
- Seeded PRNG: `mulberry32(seed)` — NEVER use Math.random() in generated code
- Text: NEVER animate character by character

**Why:** These patterns are load-bearing for the editor. Agent-generated code that violates them causes visible glitches.
**How to apply:** Always use these patterns when modifying scene generation or tool execution code.
