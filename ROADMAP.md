# Cench Studio — Fully Agentic Editor Roadmap

## Vision

Build an Electron editor where the AI agent has full NLE control — all clips on one timeline, real footage mixed with generated scenes, different styles in one project, frame-accurate editing.

## Current State

Cench already has a powerful agent (92+ tools, 7 renderer types, avatar/TTS/physics/3D/data-viz) but is limited by a **scene-centric** model where each scene is an isolated iframe. The Path 2 Electron export engine (Pixi + WebCodecs) renders deterministically but only for export, not preview.

---

## Gap 1: Visual Feedback for Agent ← START HERE

**Problem**: Agent generates content blind — can't see the rendered result to verify layout, timing, or quality.

**Solution**: Add `capture_frame` tool that seeks a scene iframe to a given time, captures the rendered output as a base64 image, and returns it to the agent.

**Files**:

- `lib/agents/tools.ts` — add capture_frame tool schema
- `lib/agent-tools.ts` — add tool definition
- `lib/agents/tool-executor.ts` — implement capture via iframe seek + canvas capture
- `app/api/agent/route.ts` — wire tool into agent endpoint

**Depends on**: Scene iframe bridge (already built in `lib/export2/pixi-mp4.ts`), playback controller seek protocol.

---

## Gap 2: Continuous Timeline Preview

**Problem**: Each scene plays in its own iframe. No cross-scene preview.

**Solution**: Adapt the Path 2 Pixi compositor for real-time preview — same layer stack, lower resolution, frame-skipping when behind. Single canvas for the full timeline.

**Files**:

- `lib/export2/pixi-mp4.ts` — extract compositor into reusable module
- `components/PreviewPlayer.tsx` — replace per-scene iframe with continuous Pixi canvas
- `lib/store.ts` — add master playback state (global time, play/pause across scenes)

**Depends on**: Gap 1 (capture_frame validates compositor output).

---

## Gap 3: Clip-on-Timeline Model

**Problem**: Scenes are atomic, sequential units. Can't place clips at arbitrary times on parallel tracks.

**Solution**: Add `Clip` and `Track` types alongside existing Scene model. Each clip references a source (scene, video file, image, audio). Tracks are ordered layers. The compositor reads clips active at current time.

**Types**:

```typescript
type Clip = {
  id: string
  trackId: string
  sourceType: 'scene' | 'video' | 'image' | 'audio' | 'title'
  sourceId: string // scene ID, file path, etc.
  startTime: number // position on timeline (seconds)
  duration: number
  trimStart: number // source in-point
  trimEnd: number | null // source out-point
  speed: number // playback rate
  opacity: number
  position: { x: number; y: number }
  scale: { x: number; y: number }
  filters: ClipFilter[]
  keyframes: Keyframe[]
}

type Track = {
  id: string
  name: string
  type: 'video' | 'audio' | 'overlay'
  clips: Clip[]
  muted: boolean
  locked: boolean
}
```

**Files**:

- `lib/types.ts` — add Clip, Track, Timeline types
- `lib/store.ts` — add track/clip CRUD operations
- `components/timeline/` — multi-track timeline UI
- `lib/agent-tools.ts` — add clip/track agent tools

**Depends on**: Gap 2 (compositor reads from clip model).

---

## Gap 4: Multi-Video Compositing

**Problem**: One video layer per scene.

**Solution**: Extend Pixi compositor to decode and composite multiple video sources per frame. Each video clip on a video track gets its own WebDemuxer + VideoDecoder + Sprite.

**Files**:

- `lib/export2/pixi-mp4.ts` — multi-source video decode pool
- `lib/compositor/video-pool.ts` — new: manages N video decoders

**Depends on**: Gap 3 (clip model tells compositor which videos are active).

---

## Gap 5: Trim / Split / Speed

**Problem**: Basic trimStart/trimEnd only, no split, no speed ramps.

**Solution**: Clip model already has trim + speed fields. Add:

- Split: create two clips from one at a time point
- Speed ramps: keyframes on the speed property
- Timestamp remapping in compositor: `sourceTime = integral(speed, 0, clipTime)`

**Files**:

- `lib/store.ts` — splitClip, setClipSpeed operations
- `lib/compositor/time-remap.ts` — new: speed ramp integration
- `lib/agents/tools.ts` — split_clip, set_clip_speed tool schemas

**Depends on**: Gap 3 (clip model).

---

## Gap 6: Keyframe Animation

**Problem**: Only preset animations, no frame-level control.

**Solution**: Keyframes stored per-clip per-property. Compositor interpolates at render time. Easing curves (linear, ease-in, ease-out, cubic-bezier).

**Types**:

```typescript
type Keyframe = {
  time: number // relative to clip start
  property: string // 'x' | 'y' | 'scale' | 'opacity' | 'rotation'
  value: number
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | [number, number, number, number]
}
```

**Files**:

- `lib/types.ts` — Keyframe type (on Clip)
- `lib/compositor/interpolate.ts` — new: keyframe interpolation engine
- `lib/agents/tools.ts` — set_keyframe, remove_keyframe tools

**Depends on**: Gap 3 (keyframes live on clips).

---

## Gap 7: Visual Effects

**Problem**: No per-clip filters, blend modes, or masks.

**Solution**: Pixi.js already has filter infrastructure. Map clip filters to Pixi filters (BlurFilter, ColorMatrixFilter, etc.). Blend modes via Pixi's `blendMode` property.

**Files**:

- `lib/compositor/filters.ts` — new: filter factory
- `lib/export2/pixi-mp4.ts` — apply filters per sprite per frame

**Depends on**: Gap 3 (filters live on clips).

---

## Dependency Graph

```
Gap 1: Visual Feedback  ← START
  │
  ▼
Gap 2: Continuous Preview
  │
  ▼
Gap 3: Clip/Track Model ─── foundation for everything below
  │
  ├─► Gap 4: Multi-Video Compositing
  ├─► Gap 5: Trim / Split / Speed
  ├─► Gap 6: Keyframe Animation
  └─► Gap 7: Visual Effects
```
