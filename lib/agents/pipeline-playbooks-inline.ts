// ── Inline playbook definitions ──────────────────────────────────────────────
//
// The authoritative playbook source is `.claude/skills/cench/pipelines/*.md`.
// Next.js serverless builds (Vercel) don't bundle the `.claude/` directory,
// so we also keep a typed inline copy here. The loader in
// `pipeline-playbooks.ts` prefers the on-disk version when it exists (local
// dev, self-hosted deployments) and falls back to these definitions when the
// directory is unavailable in the serverless bundle.
//
// Keep this list in sync with the markdown files. Body content is the core
// guidance only; the on-disk version is canonical when present.

import type { Playbook } from './pipeline-playbooks'

export const INLINE_PLAYBOOKS: Playbook[] = [
  {
    id: 'talking-head',
    label: 'Talking Head Explainer',
    matchHints: ['talking head', 'avatar explains', 'presenter walks through', 'tutorial narrated'],
    recommendedDurationSeconds: [45, 90],
    sceneCount: [3, 5],
    requires: ['tts', 'avatar'],
    compatiblePlaybooks: ['clean', 'corporate', 'pastel_edu'],
    body: [
      'Structure: open on the presenter, diagram-heavy middle beats with presenter in PIP, demo / proof, wrap full-frame with CTA.',
      'Renderer mix: React scenes with avatar PIP for intro/outro, Motion/D3 for diagram scenes.',
      'Audio: TTS narration (prefer ElevenLabs for aligned captions). Duck music when presenter speaks.',
      'Captions: always generate SRT + VTT.',
      'Capability checks: avatar provider + TTS provider required.',
    ].join('\n\n'),
    sourcePath: '(inline)',
  },
  {
    id: 'animated-explainer',
    label: 'Animated Explainer',
    matchHints: ['explain how X works', 'infographic video', 'concept explainer', 'whiteboard style'],
    recommendedDurationSeconds: [45, 120],
    sceneCount: [4, 7],
    requires: [],
    compatiblePlaybooks: ['whiteboard', 'pastel_edu', 'clean', 'chalkboard', 'threeblueonebrown'],
    body: [
      'Structure: hook → definition → how it works → data beat → comparison → resolution → optional CTA.',
      'Renderer mix: Motion for intro/outro/typography, D3 for data, Canvas2D for hand-drawn energy.',
      'Avoid 3+ consecutive Motion scenes when alternatives fit the content.',
      'Captions always on — explainers get re-shared and watched muted.',
    ].join('\n\n'),
    sourcePath: '(inline)',
  },
  {
    id: 'tutoring',
    label: 'Tutoring / Concept Lesson',
    matchHints: [
      'teach me',
      'lesson on',
      'walk me through',
      'help me understand',
      'tutor lesson',
      'concept lesson',
      'explain for beginner',
    ],
    recommendedDurationSeconds: [60, 180],
    sceneCount: [3, 6],
    requires: ['tts'],
    compatiblePlaybooks: ['clean', 'chalkboard', 'whiteboard', 'feynman', 'science_journal'],
    body: [
      'Pedagogy first — comprehension over polish. Scene = knowledge point; target 3–5 scenes, hard cap 7.',
      'Pick ONE pedagogical pattern for the whole lesson: Socratic probe (abstract/why), Worked example (math/procedural), Analogy-first (unfamiliar technical), Historical narrative (discoveries).',
      'Every scene name starts with "Objective: <single concept>". Scene N+1 may only rely on concepts from scenes 1..N — no forward references.',
      'After every scene, call BOTH verify_scene AND verify_scene_pedagogy. On pedagogy fail, revise once and proceed — do not loop.',
      'Default styles: clean, chalkboard, whiteboard, feynman, science_journal. Avoid decorative presets that fight legibility.',
      'TTS is required; captions always on. One subtle chime on the takeaway line is the SFX ceiling during explanation.',
      'Every scene ends with an explicit "So, …" takeaway — the one sentence the viewer keeps. Final scene must synthesize, not just recap.',
    ].join('\n\n'),
    sourcePath: '(inline)',
  },
  {
    id: 'podcast-repurpose',
    label: 'Podcast → Short-Form Video',
    matchHints: ['turn this podcast into', 'clip a podcast', 'podcast highlight', 'audio to video'],
    recommendedDurationSeconds: [30, 90],
    sceneCount: [2, 5],
    requires: ['tts'],
    compatiblePlaybooks: ['clean', 'newspaper', 'dark'],
    body: [
      'Structure: hook quote → speaker + context → main argument with word-level captions → callout → attribution card.',
      'Aspect ratio: 9:16 for TikTok/Reels/Shorts — default platformProfile accordingly.',
      'Audio: use the source podcast directly, do NOT synthesise new TTS.',
      'Captions: mandatory, large, high-contrast, aligned at word level.',
      'Never overlay background music — the source audio is the soundtrack.',
    ].join('\n\n'),
    sourcePath: '(inline)',
  },
]
