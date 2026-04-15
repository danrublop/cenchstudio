# Avatar System Rules

Read this when generating scenes that include a talking avatar presenter or narrator.

## Providers

The project's configured avatar provider determines quality and cost (auto-selected):

| Provider    | Type                     | Cost             | Notes                              |
| ----------- | ------------------------ | ---------------- | ---------------------------------- |
| talkinghead | Free 3D in-browser       | Free             | Three.js character, lip-synced     |
| musetalk    | Photorealistic (FAL.ai)  | ~$0.04/scene     | Requires source face image         |
| fabric      | Photorealistic (FAL.ai)  | ~$0.08-0.15      | 480p/720p, requires face image     |
| aurora      | Photorealistic (FAL.ai)  | ~$0.05/scene     | Requires source face image         |
| heygen      | Premium API              | ~$0.10-1.00      | HeyGen avatar library              |

Provider is configured per-project in Settings > Media Gen. You do not choose the provider
in the tool call — the project config decides.

## Tools

### `generate_avatar_narration` — PIP overlay

Adds a talking avatar as a picture-in-picture overlay on an existing scene.

| Parameter       | Required | Description                                           |
| --------------- | -------- | ----------------------------------------------------- |
| sceneId         | yes      | Target scene ID                                       |
| text            | yes      | What the avatar says (natural, conversational)        |
| placement       | no       | `pip_bottom_right` (default), `pip_bottom_left`, `pip_top_right`, `fullscreen` |
| avatarConfigId  | no       | Specific config ID (omit for project default)         |
| sourceImageUrl  | no       | Face image URL (FAL providers only)                   |

**Use when**: the avatar supplements other visual content — charts, animations, diagrams with a narrator.

### `generate_avatar_scene` — Full presenter scene

Creates a dedicated scene where the avatar IS the main visual focus.

| Parameter        | Required | Description                                          |
| ---------------- | -------- | ---------------------------------------------------- |
| sceneId          | yes      | Target scene ID                                      |
| narration_script | yes      | Object: `{ mood, view, lines[], position }`          |
| content_panels   | no       | Array: `{ html, position, revealAt, exitAt }`        |
| backdrop         | no       | CSS background for the scene                         |
| avatar_position  | no       | `left` (default), `right`, `center`                  |
| avatar_size      | no       | % of viewport width (default 40)                     |
| avatar_config_id | no       | Specific config (omit for project default)           |

**narration_script structure**:
```json
{
  "mood": "happy",
  "view": "upper",
  "lipsyncHeadMovement": true,
  "eyeContact": 0.7,
  "position": "fullscreen_left",
  "lines": [
    { "text": "Welcome to this tutorial!", "mood": "happy", "gesture": "wave" },
    { "text": "Let me show you the data.", "gesture": "index", "lookAt": { "x": 1200, "y": 500 } }
  ]
}
```

**Use when**: the avatar IS the content — tutorials, walkthroughs, talking-head videos.

## Decision matrix

| Scenario                                         | Tool                         |
| ------------------------------------------------ | ---------------------------- |
| Data viz / chart with narrator in corner          | `generate_avatar_narration`  |
| Animation with a presenter adding trust           | `generate_avatar_narration`  |
| Step-by-step tutorial led by a presenter          | `generate_avatar_scene`      |
| Corporate spokesperson delivering a message       | `generate_avatar_scene`      |
| Abstract concept scene, no person needed          | No avatar                    |
| Data-heavy scene with complex visuals             | `generate_avatar_narration` (PIP) or no avatar |
| Scene under 5 seconds                             | No avatar                    |

**Do NOT add an avatar unless the user asks for one.** Many explainer videos work better
without a presenter — clean animation only. Ask if unsure.

## Mood guide

| Mood     | When to use                                            |
| -------- | ------------------------------------------------------ |
| neutral  | Calm, professional — default for corporate/serious     |
| happy    | Warm, engaging — intros, positive results, celebrations |
| sad      | Empathetic, slower — serious topics, problems          |
| angry    | Intense, urgent — warnings (use sparingly)             |
| fear     | Concerned, alert — risks, security issues              |
| surprise | Excited, wide-eyed — reveals, unexpected data          |

## Gesture guide

Use in `narration_script.lines[].gesture`:

| Gesture   | Semantic meaning                                        |
| --------- | ------------------------------------------------------- |
| handup    | "Here's the key point", emphasis, "let me explain"      |
| index     | Pointing at content panel, "look at this"               |
| thumbup   | Approval, "exactly right", positive reinforcement       |
| thumbdown | "Avoid this", cautioning, negative results              |
| shrug     | Uncertainty, "it depends", acknowledging complexity     |
| ok        | Compact agreement, "perfect", "got it"                  |
| side      | "On the other hand", "alternatively"                    |
| wave      | Greeting at scene start, farewell at scene end          |

`gestureHand`: `left` or `right` — default right.

## Look controls

- `lookCamera: true` — direct eye contact. Use for key statements, calls to action.
- `lookAt: { x, y }` — avatar glances at a screen position. Use when referencing content panels.
- Alternate between camera and content for natural engagement.

## TalkingHead models (free provider)

Models are selected via project avatar config, not per-tool-call.

| Model ID      | Description                                    | Source  |
| ------------- | ---------------------------------------------- | ------- |
| brunette      | Female presenter (default for "friendly")      | Local   |
| mpfb          | Male professional (default for "professional") | Local   |
| brunette_t    | Compact/lightweight brunette variant           | CDN     |
| avaturn       | Avaturn community sample                       | CDN     |
| avatarsdk     | AvatarSDK community sample                     | CDN     |

Local models require GLB files in `public/avatars/`. CDN variants always work.

## Avatar + React composition

Avatars are composited as **HTML overlays** (`scene.aiLayers`), NOT as React bridge components.
This means:

- A React scene can use `<ThreeJSLayer>`, `<Canvas2DLayer>`, `<D3Layer>`, etc. alongside a PIP avatar
- The avatar renders on top of the scene content as a separate HTML layer
- Avatar timing is TTS-driven (audio duration), independent of React's `useCurrentFrame()`

**PIP avatars are true overlays** — do NOT redesign scene content to accommodate them.
The scene should use the full viewport as normal. The avatar is a small circle in one corner;
it is acceptable for it to partially overlap content. NEVER add extra padding, margins,
`maxWidth` restrictions, or reserved columns in scene code to "make room" for a PIP avatar.
That defeats the purpose of an overlay and breaks the layout.

Only `avatar_scene` (full presenter mode) uses a split layout with a dedicated avatar column.

Design scene animations to complement avatar speech duration (match `scene.duration`).
