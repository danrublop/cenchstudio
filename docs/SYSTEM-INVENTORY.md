# Cench Studio — Complete System Inventory

## Agent Framework

### Agents (6 built-in)

| Agent       | Model (auto) | Role                               | Max Iterations      | Tool Access           |
| ----------- | ------------ | ---------------------------------- | ------------------- | --------------------- |
| Router      | Haiku 4.5    | Classify intent → pick agent       | 1                   | none                  |
| Director    | Sonnet 4.6   | Plan + build multi-scene videos    | 15                  | full                  |
| Planner     | Sonnet 4.6   | Storyboard only → user approval    | 15                  | plan_scenes only      |
| Scene-Maker | Sonnet 4.6   | Build/regenerate single scenes     | 15 (8 as sub-agent) | scene + layer tools   |
| Editor      | Haiku 4.5    | Surgical edits to existing scenes  | 15                  | element + patch tools |
| DoP         | Haiku 4.5    | Global style, palette, transitions | 15                  | style tools           |

### SSE Event Stream (17 events)

| Event                 | Payload                                                      | Purpose                                 |
| --------------------- | ------------------------------------------------------------ | --------------------------------------- |
| `run_start`           | runId                                                        | Correlation ID                          |
| `agent_routed`        | agentType, modelId, routeMethod, focusedSceneType, toolCount | Which agent was picked (before content) |
| `thinking`            | —                                                            | Agent is routing                        |
| `thinking_start`      | —                                                            | Extended thinking block started         |
| `thinking_token`      | token                                                        | Streamed thinking content               |
| `thinking_complete`   | fullThinking                                                 | Thinking block finished                 |
| `token`               | token                                                        | Streamed response text                  |
| `iteration_start`     | iteration, maxIterations                                     | New tool loop iteration                 |
| `tool_start`          | toolName, toolInput                                          | Tool about to execute                   |
| `tool_complete`       | toolName, toolInput, toolResult                              | Tool finished                           |
| `storyboard_proposed` | storyboard                                                   | Plan ready for user review              |
| `preview_update`      | sceneId, changes                                             | Scene HTML regenerated                  |
| `state_change`        | changes, updatedScenes, updatedGlobalStyle                   | World state mutated                     |
| `sub_agent_start`     | subAgentId, index, total, name                               | Sub-agent spawned                       |
| `sub_agent_complete`  | subAgentId, success                                          | Sub-agent finished                      |
| `error`               | error                                                        | Error occurred                          |
| `done`                | agentType, modelId, fullText, usage, toolCalls               | Stream complete                         |

### Orchestration

| Feature               | Details                                                                                |
| --------------------- | -------------------------------------------------------------------------------------- |
| Sub-agent parallelism | Max 3 concurrent SceneMaker sub-agents                                                 |
| Focused prompts       | Sub-agents get scene-type-specific prompt (only their type's guidance)                 |
| Focused tools         | Sub-agents get filtered tools (only their scene type's category)                       |
| Checkpoints           | Save runId, storyboard, completedSceneIds on interrupt → resume later                  |
| Context refresh       | Every 3 tool-bearing iterations, rebuild world state                                   |
| Session compaction    | Summarize + continuation instruction when messages exceed 6000 tokens                  |
| Prompt caching        | Static prompt (persona) cached via Anthropic ephemeral; dynamic (world state) uncached |

### Tool Hook Pipeline

| Hook Type | Trigger                  | Can Do                       |
| --------- | ------------------------ | ---------------------------- |
| Pre-tool  | Before any tool executes | Deny execution, modify args  |
| Post-tool | After tool returns       | Augment result, add warnings |

Built-in hooks: scene existence validation, duration range check (2-60s), slow tool warning (>30s).

### Config Hierarchy

| Priority    | Source      | Location                                 |
| ----------- | ----------- | ---------------------------------------- |
| 1 (highest) | Environment | `process.env.*`                          |
| 2           | Local       | `.cench.local.json` (gitignored)         |
| 3 (lowest)  | Project     | DB (apiPermissions, audioSettings, etc.) |

---

## Tools (92 total)

### Scene Management (7)

| Tool                   | Description                                             |
| ---------------------- | ------------------------------------------------------- |
| `create_scene`         | Create a new scene with name, prompt, duration, bgColor |
| `delete_scene`         | Delete a scene by ID                                    |
| `duplicate_scene`      | Clone an existing scene                                 |
| `reorder_scenes`       | Reorder scenes in the timeline                          |
| `set_scene_duration`   | Set scene duration (2-60s)                              |
| `set_scene_background` | Set scene background color                              |
| `set_transition`       | Set transition between scenes (39 FFmpeg xfade options) |

### Layer Creation & Code Generation (9)

| Tool                   | Scene Types                                    | Description                               |
| ---------------------- | ---------------------------------------------- | ----------------------------------------- |
| `add_layer`            | svg, canvas2d, d3, three, motion, lottie, zdog | Generate visual content via AI prompt     |
| `regenerate_layer`     | all                                            | Re-generate a layer's code from scratch   |
| `patch_layer_code`     | all                                            | Surgically edit existing layer code       |
| `remove_layer`         | all                                            | Remove a layer                            |
| `reorder_layer`        | all                                            | Change layer z-order                      |
| `set_layer_opacity`    | all                                            | Set layer opacity (0-1)                   |
| `set_layer_visibility` | all                                            | Toggle layer visibility                   |
| `set_layer_timing`     | all                                            | Set layer startAt and duration            |
| `set_layer_filter`     | all                                            | Apply CSS filter (blur, brightness, etc.) |

### Canvas2D Templates (1)

| Tool                           | Description                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `apply_canvas_motion_template` | Apply built-in animated background (starfield, particles, waves, rain, fire, EQ bars) — zero LLM cost |

### D3 Chart Tools (4)

| Tool             | Chart Types                                                                                        | Description                                |
| ---------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `generate_chart` | bar, horizontalBar, stackedBar, groupedBar, line, area, pie, donut, scatter, gauge, number, funnel | Create chart via CenchCharts (no LLM cost) |
| `update_chart`   | all                                                                                                | Update chart data, config, layout, timing  |
| `remove_chart`   | —                                                                                                  | Remove a chart layer                       |
| `reorder_charts` | —                                                                                                  | Change chart z-order                       |

### Three.js / 3D Tools (4)

| Tool                       | Description                                                |
| -------------------------- | ---------------------------------------------------------- |
| `three_data_scatter_scene` | 3D scatter plot with instanced spheres                     |
| `create_world_scene`       | Immersive 3D environment (meadow, studio_room, void_space) |
| `list_3d_assets`           | Query CC0 3D model library                                 |
| `search_3d_models`         | Search 3D models by keyword                                |

### Zdog Tools (4)

| Tool                         | Description                                             |
| ---------------------------- | ------------------------------------------------------- |
| `create_zdog_composed_scene` | Deterministic Zdog from reusable assets — zero LLM cost |
| `build_zdog_asset`           | Create reusable Zdog shape hierarchy                    |
| `save_zdog_person_asset`     | Save Zdog person rig to library                         |
| `list_zdog_person_assets`    | List saved Zdog person assets                           |

### Physics Simulation Tools (4)

| Tool                      | Simulations                                                                                                         | Description                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `generate_physics_scene`  | pendulum, double_pendulum, projectile, orbital, wave_interference, double_slit, electric_field, harmonic_oscillator | Live seekable physics simulation    |
| `explain_physics_concept` | —                                                                                                                   | Multi-scene physics education plan  |
| `annotate_simulation`     | —                                                                                                                   | Add callouts at key physics moments |
| `set_simulation_params`   | —                                                                                                                   | Change physics parameters mid-scene |

### Element Editing (7)

| Tool                    | Description                     |
| ----------------------- | ------------------------------- |
| `add_element`           | Add SVG element to scene        |
| `edit_element`          | Modify element properties       |
| `delete_element`        | Remove element                  |
| `move_element`          | Reposition element              |
| `resize_element`        | Resize element                  |
| `reorder_element`       | Change element z-order          |
| `adjust_element_timing` | Change element animation timing |

### AI Media Layer Tools (4)

| Tool                 | Description                                |
| -------------------- | ------------------------------------------ |
| `update_ai_layer`    | Reposition/resize/rotate media layer       |
| `animate_ai_layer`   | Add entrance/exit animation to media layer |
| `crop_image_layer`   | Crop/pan image content                     |
| `use_asset_in_scene` | Reference a project asset in scene code    |

### Image & Stock Tools (3)

| Tool            | Description                                     |
| --------------- | ----------------------------------------------- |
| `search_images` | Search Unsplash for stock photos                |
| `place_image`   | Place image in scene with position/size/opacity |
| `add_watermark` | Add watermark overlay                           |

### Avatar Tools (3)

| Tool                        | Description                                    |
| --------------------------- | ---------------------------------------------- |
| `generate_avatar_narration` | Avatar PIP overlay with narration              |
| `generate_avatar_scene`     | Full-screen avatar presenter scene             |
| `list_avatars`              | List available avatar providers and characters |

### Audio Tools (4)

| Tool                   | Description                     |
| ---------------------- | ------------------------------- |
| `add_narration`        | TTS voiceover with auto-timing  |
| `add_sound_effect`     | SFX at specific timestamp       |
| `add_background_music` | Looping music with auto-ducking |
| `set_audio_layer`      | Direct audio layer control      |

### Video Tools (2)

| Tool                       | Description                        |
| -------------------------- | ---------------------------------- |
| `set_video_layer`          | Background video with trim/opacity |
| `request_screen_recording` | Capture desktop/app recording      |

### Style Tools (4)

| Tool                  | Description                                 |
| --------------------- | ------------------------------------------- |
| `set_global_style`    | Set palette, font, preset across all scenes |
| `set_scene_style`     | Per-scene style override                    |
| `style_scene`         | Apply scene-level style preset              |
| `set_all_transitions` | Set uniform transition for all scene breaks |

### Camera Motion (1)

| Tool                | Presets                                                     | Description              |
| ------------------- | ----------------------------------------------------------- | ------------------------ |
| `set_camera_motion` | kenBurns, cinematicPush, orbit, emphasis, rackFocus, reveal | Animated camera movement |

### Interaction Tools (4)

| Tool                        | Description                          |
| --------------------------- | ------------------------------------ |
| `add_interaction`           | Click/drag/hover handlers            |
| `add_multiple_interactions` | Batch interaction creation           |
| `edit_interaction`          | Modify existing interaction          |
| `connect_scenes`            | Link scenes for branching narratives |

### Planning Tools (2)

| Tool           | Description                                                     |
| -------------- | --------------------------------------------------------------- |
| `plan_scenes`  | Complete storyboard with scene order, types, narration, visuals |
| `verify_scene` | Check if scene has valid visual content                         |

### Parenting (2)

| Tool                 | Description                                  |
| -------------------- | -------------------------------------------- |
| `set_layer_parent`   | Set parent-child relationship between layers |
| `create_group_layer` | Create a group layer for organizing          |

### Template Tools (3)

| Tool               | Description                             |
| ------------------ | --------------------------------------- |
| `pick_template`    | Browse scene templates                  |
| `use_template`     | Apply template to scene                 |
| `save_as_template` | Save current scene as reusable template |

### Timeline NLE Tools (14)

| Tool                  | Description                     |
| --------------------- | ------------------------------- |
| `init_timeline`       | Initialize NLE timeline         |
| `add_track`           | Add timeline track              |
| `place_clip`          | Place clip on track             |
| `move_clip`           | Move clip to new position       |
| `trim_clip`           | Trim clip start/end             |
| `split_clip`          | Split clip at time point        |
| `slip_edit`           | Slip edit (change media offset) |
| `remove_clip`         | Remove clip                     |
| `set_clip_speed`      | Change playback speed           |
| `set_clip_blend_mode` | Set blend mode                  |
| `set_clip_filter`     | Apply visual filter             |
| `remove_clip_filter`  | Remove filter                   |
| `set_keyframe`        | Set animation keyframe          |
| `remove_keyframe`     | Remove keyframe                 |

### Export (2)

| Tool                  | Description                         |
| --------------------- | ----------------------------------- |
| `export_mp4`          | Trigger MP4 render                  |
| `publish_interactive` | Publish as hosted interactive embed |

### Verification (2)

| Tool            | Description                       |
| --------------- | --------------------------------- |
| `capture_frame` | Capture scene screenshot          |
| `verify_scene`  | Validate scene has visual content |

### Utility (2)

| Tool                | Description                           |
| ------------------- | ------------------------------------- |
| `search_lottie`     | Search Lottie animation library       |
| `set_roughness_all` | Set roughness level across all scenes |

---

## API Routes (47)

### Agent System

| Method | Path         | Description                            |
| ------ | ------------ | -------------------------------------- |
| POST   | `/api/agent` | SSE stream — multi-agent orchestration |

### Projects

| Method | Path                 | Description               |
| ------ | -------------------- | ------------------------- |
| GET    | `/api/projects`      | List projects (paginated) |
| POST   | `/api/projects`      | Create project            |
| GET    | `/api/projects/[id]` | Load project with scenes  |
| PATCH  | `/api/projects/[id]` | Update project settings   |

### Scenes

| Method | Path                               | Description                         |
| ------ | ---------------------------------- | ----------------------------------- |
| GET    | `/api/scene?projectId=X`           | List scenes (no code)               |
| GET    | `/api/scene?projectId=X&sceneId=Y` | Single scene (full code)            |
| POST   | `/api/scene`                       | Create scene in project             |
| PATCH  | `/api/scene`                       | Update layer code + regenerate HTML |

### Code Generation

| Method | Path                   | Input            | Output                               |
| ------ | ---------------------- | ---------------- | ------------------------------------ |
| POST   | `/api/generate`        | prompt, palette  | SVG code                             |
| POST   | `/api/generate-canvas` | prompt, palette  | Canvas2D JS                          |
| POST   | `/api/generate-d3`     | prompt, palette  | { sceneCode, styles, suggestedData } |
| POST   | `/api/generate-three`  | prompt, palette  | { sceneCode }                        |
| POST   | `/api/generate-motion` | prompt, palette  | { sceneCode, styles, htmlContent }   |
| POST   | `/api/generate-lottie` | prompt, palette  | Lottie JSON                          |
| POST   | `/api/generate-image`  | prompt, provider | Image URL                            |
| POST   | `/api/generate-video`  | prompt           | Veo3 video URL                       |
| POST   | `/api/generate-avatar` | script, config   | Avatar video URL                     |

### Audio

| Method | Path                   | Description              |
| ------ | ---------------------- | ------------------------ |
| POST   | `/api/tts`             | Text-to-speech synthesis |
| GET    | `/api/tts/voices`      | List TTS voices          |
| POST   | `/api/tts/talkinghead` | TalkingHead avatar       |
| POST   | `/api/sfx`             | Sound effect search      |
| POST   | `/api/music/search`    | Music search             |
| GET    | `/api/audio-settings`  | Audio provider config    |

### Assets & Media

| Method   | Path                        | Description           |
| -------- | --------------------------- | --------------------- |
| POST     | `/api/upload`               | File upload           |
| GET/POST | `/api/projects/[id]/assets` | Project media library |
| POST     | `/api/remove-background`    | Background removal    |
| GET      | `/api/lottie/search`        | Lottie search         |
| GET      | `/api/list-avatars`         | Avatar provider list  |

### Avatar Configs

| Method       | Path                                      | Description           |
| ------------ | ----------------------------------------- | --------------------- |
| GET/POST     | `/api/projects/[id]/avatar-configs`       | Avatar configs CRUD   |
| PATCH/DELETE | `/api/projects/[id]/avatar-configs/[cid]` | Single config         |
| POST         | `/api/projects/[id]/avatar/generate`      | Generate avatar video |

### Export & Publish

| Method | Path                 | Description                |
| ------ | -------------------- | -------------------------- |
| POST   | `/api/export`        | SSE stream — MP4 render    |
| POST   | `/api/export/reveal` | Reveal animation export    |
| POST   | `/api/publish`       | Publish interactive embed  |
| POST   | `/api/build`         | SSE stream — project build |

### Conversations

| Method    | Path                               | Description               |
| --------- | ---------------------------------- | ------------------------- |
| GET/POST  | `/api/conversations`               | List/create conversations |
| GET/PATCH | `/api/conversations/[id]`          | Conversation details      |
| GET/POST  | `/api/conversations/[id]/messages` | Messages CRUD             |

### Analytics & Permissions

| Method   | Path                   | Description           |
| -------- | ---------------------- | --------------------- |
| POST     | `/api/analytics`       | Log event             |
| POST     | `/api/analytics/track` | Track interaction     |
| GET      | `/api/analytics/[id]`  | Project analytics     |
| GET      | `/api/usage`           | Token usage stats     |
| GET/POST | `/api/permissions`     | Permission management |
| PATCH    | `/api/generation-log`  | Update generation log |

---

## Scene Types (10)

| Type           | Best For                                                   | Renderer               | Animation              |
| -------------- | ---------------------------------------------------------- | ---------------------- | ---------------------- |
| `motion`       | **Default.** Typography, layouts, cards, steps, explainers | DOM + GSAP             | window.\_\_tl timeline |
| `canvas2d`     | Hand-drawn, particles, generative art, procedural          | Canvas 2D + rAF        | requestAnimationFrame  |
| `svg`          | **Rare.** Vector path draw-on only                         | SVG + CSS              | CSS @keyframes + GSAP  |
| `d3`           | Charts, graphs, data visualization                         | D3 v7 + SVG            | d3.transition + GSAP   |
| `three`        | 3D objects, products, spatial concepts                     | Three.js r183 WebGL    | rAF + GSAP             |
| `3d_world`     | Immersive environments with objects & panels               | Three.js + HTML panels | Keyframe camera paths  |
| `zdog`         | Pseudo-3D, isometric, flat-shaded illustration             | Zdog v1 + Canvas       | rAF + lerp             |
| `lottie`       | Icon animations, micro-loops                               | lottie-web 5.12.2      | Lottie keyframes       |
| `avatar_scene` | Full-screen presenter, talking head                        | 3D avatar + DOM        | Lip sync + gestures    |
| `physics`      | Live physics simulations with equations                    | Canvas + MathJax       | Deterministic sim      |

---

## Style Presets (9)

| Preset              | Background | Font    | Roughness | Renderer | Character             |
| ------------------- | ---------- | ------- | --------- | -------- | --------------------- |
| `whiteboard`        | #fffef9    | Caveat  | 1.5       | canvas2d | Hand-drawn marker     |
| `chalkboard`        | #2d4a3e    | Caveat  | 2.5       | canvas2d | White chalk on green  |
| `blueprint`         | #1e3a5f    | DM Mono | 0         | motion   | Technical diagram     |
| `clean`             | #ffffff    | Georgia | 0         | motion   | Minimal, polished     |
| `data-story`        | #0f0f13    | DM Mono | 0.3       | auto     | Dark, chart-optimized |
| `newspaper`         | #f5f0e0    | Georgia | 0.5       | motion   | Editorial, monochrome |
| `neon`              | #0a0a0f    | DM Mono | 0.8       | canvas2d | Glowing neon          |
| `kraft`             | #c4a882    | Caveat  | 2.0       | canvas2d | Brown paper, artisan  |
| `threeblueonebrown` | #0d1117    | Inter   | 0         | canvas2d | Math visualization    |

---

## Transitions (39)

| Category     | Transitions                                                                   |
| ------------ | ----------------------------------------------------------------------------- |
| Basic        | none, crossfade, dissolve, fade-black, fade-white                             |
| Wipe         | wipe-left, wipe-right, wipe-up, wipe-down, wipe-tl, wipe-tr, wipe-bl, wipe-br |
| Slide        | slide-left, slide-right, slide-up, slide-down                                 |
| Smooth       | smooth-left, smooth-right, smooth-up, smooth-down                             |
| Shape        | circle-open, circle-close, radial, vert-open, horz-open                       |
| Cover/Reveal | cover-left, cover-right, reveal-left, reveal-right                            |
| Diagonal     | diag-tl, diag-tr, diag-bl, diag-br                                            |
| Depth        | zoom-in, distance                                                             |

---

## Permission-Gated APIs (13)

| API                                        | Cost Estimate          | Default      |
| ------------------------------------------ | ---------------------- | ------------ |
| heygen                                     | $0.10–$1.00/video      | always_ask   |
| veo3                                       | $0.50–$2.00/clip       | always_ask   |
| imageGen (flux/ideogram/recraft/SD/DALL-E) | $0.003–$0.08/image     | always_ask   |
| backgroundRemoval                          | ~$0.01                 | always_allow |
| elevenLabs                                 | $0.01–$0.10/segment    | always_ask   |
| googleTts                                  | ~$0.004/100 chars      | always_ask   |
| openaiTts                                  | $0.015–$0.030/1K chars | always_ask   |
| geminiTts                                  | $0.01–$0.02/1K chars   | always_ask   |
| googleImageGen                             | $0.02–$0.04/image      | always_ask   |
| freesound                                  | Free                   | always_allow |
| pixabay                                    | Free                   | always_allow |
| falAvatar                                  | $0.04–$0.15/scene      | always_ask   |
| unsplash                                   | Free                   | always_allow |

---

## Models

### Anthropic

| Model             | Tier           | Use                                 |
| ----------------- | -------------- | ----------------------------------- |
| claude-haiku-4-5  | budget         | Router, Editor, DoP                 |
| claude-sonnet-4-6 | auto (default) | Director, SceneMaker, Planner       |
| claude-opus-4-6   | premium        | Director, SceneMaker (premium tier) |

### OpenAI

| Model       | Tier    | Default  |
| ----------- | ------- | -------- |
| gpt-4o-mini | budget  | disabled |
| gpt-4o      | auto    | disabled |
| gpt-4.1     | premium | disabled |
| o1, o3-mini | —       | disabled |

### Google

| Model            | Tier   | Default  |
| ---------------- | ------ | -------- |
| gemini-2.5-flash | budget | disabled |
| gemini-2.5-pro   | auto   | disabled |

---

## Audio Providers (12)

| Category | Provider        | Requires Key       |
| -------- | --------------- | ------------------ |
| TTS      | elevenlabs      | ELEVENLABS_API_KEY |
| TTS      | openai-tts      | OPENAI_API_KEY     |
| TTS      | gemini-tts      | GEMINI_API_KEY     |
| TTS      | google-tts      | GOOGLE_TTS_API_KEY |
| TTS      | openai-edge-tts | no                 |
| TTS      | puter           | no                 |
| TTS      | web-speech      | no                 |
| SFX      | elevenlabs-sfx  | ELEVENLABS_API_KEY |
| SFX      | freesound       | FREESOUND_API_KEY  |
| SFX      | pixabay         | PIXABAY_API_KEY    |
| Music    | pixabay-music   | PIXABAY_API_KEY    |
| Music    | freesound-music | FREESOUND_API_KEY  |

---

## Media Providers (11)

| Category | Provider          | Requires Key   |
| -------- | ----------------- | -------------- |
| Video    | veo3              | GOOGLE_AI_KEY  |
| Image    | googleImageGen    | GOOGLE_AI_KEY  |
| Image    | imageGen (FAL)    | FAL_KEY        |
| Image    | dall-e            | OPENAI_API_KEY |
| Avatar   | heygen            | HEYGEN_API_KEY |
| Avatar   | talkinghead       | no (free)      |
| Avatar   | musetalk          | FAL_KEY        |
| Avatar   | fabric            | FAL_KEY        |
| Avatar   | aurora            | FAL_KEY        |
| Utility  | backgroundRemoval | no             |
| Utility  | unsplash          | no             |

---

## Database Tables (24+)

| Table             | Purpose                             |
| ----------------- | ----------------------------------- |
| users             | User accounts                       |
| userMemory        | Cross-session agent learnings       |
| projects          | Video projects + settings           |
| projectAssets     | Media library per project           |
| scenes            | Video scenes with config            |
| layers            | Scene layers with generated code    |
| sceneEdges        | Scene graph connections             |
| sceneNodes        | Scene graph node positions          |
| interactions      | Interactive elements                |
| assets            | Built-in + user canvas assets       |
| threeDComponents  | 3D component library                |
| sceneTemplates    | Reusable scene templates            |
| snapshots         | Undo/redo stack                     |
| apiSpend          | API cost tracking                   |
| publishedProjects | Published interactive embeds        |
| analyticsEvents   | User interaction tracking           |
| conversations     | Chat conversations                  |
| messages          | Chat messages with tool calls       |
| mediaCache        | Persistent media cache (hash-keyed) |
| generatedMedia    | API generation result cache         |
| generationLogs    | Detailed generation audit logs      |
| avatarConfigs     | Avatar configurations               |
| avatarVideos      | Generated avatar videos             |
| timelineTracks    | NLE timeline tracks                 |
| timelineClips     | NLE timeline clips                  |

---

## Skill Files

| File                                     | Content                                                |
| ---------------------------------------- | ------------------------------------------------------ |
| `.claude/skills/cench/SKILL.md`          | Main skill definition, planning template, API examples |
| `.claude/skills/cench/rules/core.md`     | Universal rules for all scene types                    |
| `.claude/skills/cench/rules/svg.md`      | SVG rules (viewBox, CSS animations, GSAP)              |
| `.claude/skills/cench/rules/canvas2d.md` | Canvas2D rules (drawing tools, rAF, mulberry32)        |
| `.claude/skills/cench/rules/motion.md`   | Motion rules (GSAP timeline, flexbox, CSS)             |
| `.claude/skills/cench/rules/d3.md`       | D3 rules (CenchCharts, raw D3, seek/scrub)             |
| `.claude/skills/cench/rules/three.md`    | Three.js rules (materials, lighting, environments)     |
| `.claude/skills/cench/rules/zdog.md`     | Zdog rules (shapes, coordinates, person rig)           |
