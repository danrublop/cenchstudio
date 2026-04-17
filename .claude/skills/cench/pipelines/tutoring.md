---
id: tutoring
label: Tutoring / Concept Lesson
matchHints:
  - teach me
  - lesson on
  - walk me through
  - help me understand
  - tutor lesson
  - concept lesson
  - explain for beginner
recommendedDurationSeconds: [60, 180]
sceneCount: [3, 6]
requires:
  - tts
compatible_playbooks:
  - clean
  - chalkboard
  - whiteboard
  - feynman
  - science_journal
---

# Tutoring / Concept Lesson

Use this when the user's goal is COMPREHENSION — "teach me X", "walk me through Y", "help me understand Z for a beginner." This is pedagogy first. If the user wanted polish over understanding they would have asked for an explainer.

## Core rule: scene = knowledge point

Target 3–5 scenes. Hard cap 7. One learning objective per scene; split the scene if there are two. Name each scene `Objective: <single concept>`. Scene N+1 may only rely on concepts established in scenes 1..N — no forward references.

## Pedagogical pattern (pick ONE for the whole lesson)

Mixing patterns fragments the mental model. Decide upfront.

- **Socratic probe** — abstract/philosophical topics ("why does X exist"). Open with a question the viewer has but cannot yet articulate; answer it progressively.
- **Worked example** — procedural, math, algorithmic topics (gradient descent, SQL joins, binary search). Walk one concrete instance end-to-end, generalize in the final scene.
- **Analogy-first** — unfamiliar technical concepts where the viewer lacks scaffolding (TCP handshake, OAuth, neural nets). Open in a domain they know (mailing envelopes, dinner parties); swap pieces of the analogy for the real thing over successive scenes.
- **Historical narrative** — discoveries, paradigm shifts (relativity, mRNA vaccines). Follow the human arc: problem → failed attempts → breakthrough → implications.

Defaults: math/algorithm → worked example; network/crypto/OS → analogy-first; "why do we X" / ethics → Socratic; "history of X" → narrative; when unclear → analogy-first.

## Structure template

1. **Calibrate + hook** (6–10s). State what the viewer will walk away with. If audience level is uncertain, pick `beginner` and proceed — do not ask the viewer to choose.
2. **Anchor concept** (10–14s). Introduce the single core idea with the chosen pedagogical pattern. Use concrete visuals — a labeled diagram, a worked step, a historical photo.
3. **Build** (12–18s each, 1–3 of these). Each scene teaches ONE additional concept that depends on the prior. Narration closes with an explicit "So, …" takeaway.
4. **Synthesize** (10–14s). Assemble the pieces into the final mental model. This is the climactic scene.
5. **Takeaway card** (6–8s). One sentence summarizing the whole lesson; the viewer should be able to quote this from memory.

## Signature verification loop

After every scene, the Tutor MUST call BOTH `verify_scene` (structural) and `verify_scene_pedagogy` (rubric). The pedagogy rubric checks:

- Scene name begins with `Objective:` AND the objective's keywords appear in narration/visuals
- Visuals support the claim (not decorative)
- Complexity matches the audience level (beginner → avoid jargon; advanced → skip remedial content)
- A concrete takeaway is present (either explicit keywords, or closers like "So, …", "In short, …", "The key is …")

On pedagogy fail: revise ONCE with `patch_layer_code` or extend narration / duration. Do not loop more than once per scene — an imperfect scene is better than infinite verify-revise cycles.

## Defaults

- **Renderer mix:** React + Motion for typography and step lists. D3 for any quantitative claim. Canvas2D for hand-drawn energy on whiteboard/chalkboard presets. Three.js only when the concept is inherently spatial.
- **Duration:** teaching scenes run 8–18s; use `duration = max(8, (wordCount / 2.5) + 4)`. Last animation completes at ~75% of duration; the remaining 25% holds the takeaway.
- **Style:** `clean`, `chalkboard`, `whiteboard`, `feynman`, `science_journal` — all teaching-friendly. Avoid `neon`, `retro_terminal`, `newspaper` unless the topic itself demands them.
- **Audio:** TTS narration is the pedagogical spine. No SFX during explanation; one subtle chime on the takeaway line is the ceiling. Background music should be instrumental and dip aggressively during narration.
- **Captions:** always on — learners re-watch and pause, and reading reinforces comprehension.

## Capability checks

- TTS is required. If none is configured, ask the user to enable one before building — heavy on-screen text is NOT equivalent to narrated teaching.
- Research tools are strongly recommended. Any citation of a specific fact, date, or statistic should be grounded — if the provider list is empty, keep to concepts the agent can reason about natively and avoid attributed claims.

## Failure modes to avoid

- Two objectives in one scene — always split.
- Forward references ("we'll get to that later") — signals poor scaffolding.
- Analogies that drift. Commit to the chosen analogy across the full lesson; switching analogies mid-lesson resets the viewer's mental model.
- Jargon dump on beginner audiences. If the verifier flags complexity, simplify immediately.
- A "recap" scene that does not actually synthesize — the final scene must be the one sentence the viewer keeps.
