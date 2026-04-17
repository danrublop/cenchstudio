---
id: animated-explainer
label: Animated Explainer
matchHints:
  - 'explain how X works'
  - 'infographic video'
  - 'concept explainer'
  - 'whiteboard style'
recommendedDurationSeconds: [45, 120]
sceneCount: [4, 7]
requires: []
compatible_playbooks:
  - whiteboard
  - pastel_edu
  - clean
  - chalkboard
  - threeblueonebrown
---

# Animated Explainer

Use this when the user wants to explain a concept, system, or process without a presenter on camera. Typography, diagrams, and data viz carry the meaning.

## Structure

1. **Hook** (6–8s). One sharp framing question or stat. Big type. No chart yet.
2. **Define the thing** (8–12s). Motion layout: headline + 2–3 supporting points revealed with stagger.
3. **How it works** (10–18s). Diagram-first beat. Canvas2D for hand-drawn flows, D3 for structured diagrams, SVG only when the scene needs a literal pen-drawing effect.
4. **Data beat** (12–20s). D3 chart — bar / line / scatter depending on what the argument demands. Numbers big, annotations short.
5. **Comparison or counter-example** (10–15s). Side-by-side motion layout, or a second D3 chart.
6. **Resolution / implication** (8–12s). One clear takeaway. Return to big type. Optional light flourish.
7. **Optional call-to-action** (6s).

## Defaults

- **Renderer mix:** Motion for intro/outro/typography beats. D3 for any data. Canvas2D for hand-drawn energy when the style preset suggests it. Avoid Three.js unless the concept is inherently 3D.
- **Duration:** use the word-count formula. Target 60–90s total.
- **Transitions:** crossfade between ideas, slide between steps of the same idea.
- **Style:** Default to `clean` or `whiteboard`. Heavy use of whitespace. One palette across the video.
- **Audio:** TTS narration preferred but not required. Light background music. SFX on reveals is fine but don't overuse.
- **Captions:** Always on — explainers get re-shared and watched muted.

## Capability checks before building

- TTS optional — if none is configured, drop narration and lean on on-screen text.
- D3 tools must be active for the data beat. If not, swap for a Motion layout and ask the user if they'd like data viz tools enabled.

## Failure modes to avoid

- Don't let scene type become monotonous — 3+ consecutive Motion scenes is boring even if the content is different.
- Don't write long paragraphs on screen — if you're reaching for >3 lines of text, that's narration, not a caption.
- Don't drop a chart in without setup; always open a data beat with 1 line of framing text.
