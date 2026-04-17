---
id: talking-head
label: Talking Head Explainer
matchHints:
  - 'talking head'
  - 'avatar explains'
  - 'presenter walks through'
  - 'tutorial narrated'
recommendedDurationSeconds: [45, 90]
sceneCount: [3, 5]
requires:
  - tts
  - avatar
compatible_playbooks:
  - clean
  - corporate
  - pastel_edu
---

# Talking Head Explainer

Use this when the user wants a person (avatar) to walk through a topic or product. The presenter is the primary visual anchor; scene content floats near them.

## Structure

1. **Open on the presenter** (8–10s). Avatar introduces the problem or hook. Title card animates in alongside.
2. **Context / setup** (10–15s). Presenter stays in a corner PIP; a motion or D3 scene in the main area illustrates the concept.
3. **Core explanation** (15–25s). Presenter may appear again briefly to reinforce a key point, or stay hidden during a diagram-heavy beat.
4. **Demo / proof** (10–15s). Show the actual thing — product screen, chart, simulation.
5. **Wrap** (6–10s). Presenter returns full-frame for a call to action.

## Defaults

- **Renderer mix:** React scenes with avatar PIP overlay for 1, 3, 5. Motion/D3 for 2, 4.
- **Duration:** `max(6, wordCount / 2.5 + 3)` per scene. Target 60–75s total.
- **Transitions:** crossfade between presenter beats, slide-left on diagram-heavy cuts.
- **Audio:** TTS for narration (prefer ElevenLabs for aligned captions). Light background music ducked when presenter speaks.
- **Captions:** Always generate SRT + VTT — talking-head content is the classic case where viewers watch muted.

## Capability checks before building

- Avatar provider configured (HeyGen, fal-avatar, Aurora, MuseTalk, Fabric, or TalkingHead).
- TTS provider configured. Warn the user if only client-only TTS (web-speech, puter) is available — the avatar will have mouth movement but silent MP4 export.

## Failure modes to avoid

- Don't leave the presenter on screen for 60s straight; cut to supporting visuals regularly.
- Don't autoplay background music over a talking-head scene without ducking — it fights the narration.
- Keep on-screen text short; the presenter is reading the meaningful content.
