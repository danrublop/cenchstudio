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

## Animation

- Use exponential easing (power3.out, power4.out) — NOT bounce or elastic. Bounce feels dated.
- Stagger entrances with 50-150ms delays between items. Cap total stagger under 1s.
- Vary animation directions across elements. Not everything should fade-in-from-below.
- Exit animations ~75% of entrance duration.
- Do not animate everything — animation fatigue is real.

## Variety

- Each generation should feel like a unique creative work, not a template.
- Never default to: centered title with fade-in, particle background, gradient text hero.
- Explore split layouts, diagonal flows, overlapping layers, editorial arrangements.
