# Pipeline Playbooks

Pre-baked scene-flow templates the agent loads when the user's request matches a known pattern. Each playbook is a markdown file named `{slug}.md` with a YAML front-matter header.

These are **agent-internal guidance**, not user-facing product SKUs. The agent picks a playbook to ground its storyboard decisions (scene count, pacing, media layer choices) and explains its choice to the user. The user can still ask for something totally different — playbooks are defaults, not locks.

## Playbook shape

```yaml
---
id: talking-head
label: Talking Head Explainer
matchHints:
  - 'explain X using a presenter'
  - 'avatar narrates'
  - 'talking head'
recommendedDurationSeconds: [45, 90]
sceneCount: [3, 5]
requires:
  - tts
  - avatar
---
# Talking Head Explainer

...markdown body with scene-by-scene guidance...
```

The body is free-form markdown. The agent reads both the YAML header (for matching + capability pre-check) and the body (for scene-by-scene guidance) and uses them when orchestrating a run.

## Currently defined

- `talking-head.md` — avatar-led tutorial / explainer
- `animated-explainer.md` — motion+D3 narrative explainer
- `podcast-repurpose.md` — turn long-form audio into short-form clips
