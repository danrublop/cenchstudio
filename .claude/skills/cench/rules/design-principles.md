# Design Quality Bar

> Mirror of `lib/generation/design-principles.ts` — the single source of truth.
> If that file changes, update this mirror too.

These principles apply to ALL scene types.

---

## The Slop Test

If someone looked at your output and said "AI made this," would they believe it immediately? If yes, redesign. Distinctive output makes people ask "how was this made?" not "which AI made this."

## Composition

- Do NOT center everything. Use asymmetric layouts, off-center placement, rule-of-thirds positioning.
- Create visual hierarchy: one dominant element, 2-3 supporting elements at smaller scale, fine details.
- Vary spacing — tight groupings next to generous whitespace creates rhythm. Same-padding-everywhere is monotonous.
- Squint Test: blur your eyes. Can you identify the most important element and clear groupings? If everything looks the same weight, redesign.

## Typography

- Use the project font with clear weight hierarchy: 700+ for headlines, 400-500 for body.
- Use real size contrast between levels (e.g., 120px / 48px / 28px — not 48 / 44 / 40).

## Color

- Do NOT default to the AI palette: cyan-on-dark, purple-to-blue gradients, neon accents on dark backgrounds.
- Avoid pure black (#000000) and pure white (#ffffff) — tint toward the scene's color mood.
- 60-30-10 rule: 60% neutral/background, 30% secondary, 10% accent. Accent works because it's rare.
- Never use gray text on a colored background — use a darker shade of the background color instead.

## Motion

- Exponential easing only: `cubic-bezier(0.16, 1, 0.3, 1)` for entrances, `cubic-bezier(0.7, 0, 0.84, 0)` for exits.
- NEVER bounce or elastic. They feel dated and amateurish.
- NEVER linear easing on spatial movement (position) — it looks robotic.
- Stagger: 50-100ms between items. Cap total stagger under 800ms.
- Exit at 75% of entrance duration.
- Do not animate everything — animation fatigue is real.
- Vary animation directions. Not everything should fade-in-from-below.
- Scene timing: 0-20% bg appears, 20-80% content builds, 80-100% hold (everything visible, viewer absorbs).
- Two-property sweet spot: pair position+opacity for entrances, scale+color for emphasis.
- Stagger secondary elements 50-100ms after the primary action for depth.

## Motion Personalities (from `lib/motion/easing.ts`)

Use `choose_motion_style` tool to get the right easing for a scene's emotion.
Four personalities define consistent animation feel:

| Personality   | Duration  | Easing feel             | Overshoot | Best for                            |
| ------------- | --------- | ----------------------- | --------- | ----------------------------------- |
| **Playful**   | 150-300ms | Bouncy back-out         | 10-20%    | Kids, social, games, celebrations   |
| **Premium**   | 350-600ms | Smooth power3.out       | None      | Fashion, finance, luxury, calm      |
| **Corporate** | 200-400ms | Predictable ease-in-out | Minimal   | Enterprise, dashboards, educational |
| **Energetic** | 100-250ms | Snappy back-out(2.0)    | 15-30%    | Sports, marketing, gaming, urgency  |

## Emotion-to-Motion (match motion to the scene's emotional intent)

- Joy / success: upward arcs, elastic settle, 150-250ms, expanding scale.
- Urgency / warning: sharp direct paths, fast 100-150ms, angular movement.
- Trust / professionalism: smooth curves, medium 300-400ms, no overshoot, predictable.
- Elegance / premium: slow controlled curves, 400-600ms, subtle deceleration.
- Growth / progress: upward paths, expanding scale, sequential reveal.
- Calm / reflection: gentle floating drift, 500-1000ms, sine easing.
- Energy / excitement: quick snappy transitions, 100-200ms, dramatic direction changes.

## Easing Presets (available in all scenes)

**React scenes**: `Easing.bezier(0.16, 1, 0.3, 1)` in `interpolate()`.
**Motion/GSAP scenes**: `CenchMotion.easing.entrance.premium` (named presets).
**Lottie scenes**: easing handles from `choose_motion_style` output.

## Variety

- Each generation should feel like a unique creative work, not a template.
- Never default to: centered title with fade-in, particle background, gradient text hero.
- Explore split layouts, diagonal flows, overlapping layers, editorial arrangements.
