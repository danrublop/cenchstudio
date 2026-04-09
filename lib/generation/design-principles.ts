/**
 * Shared design quality bar injected into every generation prompt.
 * Adapted from Impeccable (pbakaus) for video/animation context.
 *
 * THIS IS THE SINGLE SOURCE OF TRUTH for design guidelines.
 * Also mirrored in: .claude/skills/cench/rules/visual-quality.md
 * If you update this file, update the mirror too.
 */

export const DESIGN_PRINCIPLES = `
DESIGN QUALITY BAR (adapted from Impeccable):

The Slop Test: If someone looked at your output and said "AI made this," would they believe it immediately? If yes, redesign. Distinctive output makes people ask "how was this made?" not "which AI made this."

TYPOGRAPHY:
- Use fewer sizes with more contrast. 5-step scale: display (80-160px), heading (36-56px), body (22-32px), label (14-20px), caption (11-14px). Ratio between levels: at least 1.25x.
- Never use overused fonts: Inter, Syne, Space Grotesk, DM Sans, Playfair Display, Montserrat, Roboto, Open Sans, Lato.
- Choose fonts that match the content's tone as a physical object — a museum caption, a hand-lettered sign, a mainframe manual.
- Light text on dark backgrounds reads heavier — reduce weight slightly and increase line-height.

COMPOSITION:
- Do NOT center everything. Asymmetric layouts with left-aligned text feel more designed.
- Create visual hierarchy through 2-3 dimensions simultaneously: size + weight + space.
- Squint Test: blur your eyes. Can you identify the most important element and clear groupings? If everything looks the same weight, redesign.
- Vary spacing — tight groupings next to generous whitespace creates rhythm. Same-padding-everywhere is monotonous.
- Cards are overused. Spacing and alignment create visual grouping naturally. Only use cards when content needs clear boundaries or comparison.
- Break the grid intentionally for emphasis. One off-grid element draws the eye.

COLOR:
- Tint neutrals toward your accent hue. Even 0.005 chroma creates subconscious cohesion.
- 60-30-10 rule: 60% neutral/background, 30% secondary, 10% accent. Accent works because it's rare.
- Never pure black (#000) or pure white (#fff) — always tint toward the scene's mood.
- Never gray text on colored backgrounds — use a darker shade of the background color.
- Never the AI palette: cyan-on-dark, purple-to-blue gradients, neon accents on dark.
- Never gradient text — solid colors only for text.

MOTION:
- Exponential easing only: cubic-bezier(0.16, 1, 0.3, 1) for entrances, cubic-bezier(0.7, 0, 0.84, 0) for exits.
- NEVER bounce or elastic. They feel dated and amateurish.
- Stagger: 50-100ms between items. Cap total stagger under 800ms.
- Exit at 75% of entrance duration.
- Do not animate everything — animation fatigue is real.
- Vary animation directions. Not everything should fade-in-from-below.
- Scene timing: 0-20% bg appears, 20-80% content builds, 80-100% hold (everything visible, viewer absorbs).

CAMERA:
- Every scene should have subtle camera motion. A static camera feels like a PowerPoint slide.
- Default: CenchCamera.kenBurns({ duration: DURATION, endScale: 1.04 }) — barely perceptible zoom.
- For reveals: CenchCamera.presetCinematicPush() — slow forward push.
- For emphasis: CenchCamera.dollyIn({ targetSelector: '#key-element' })

ANTI-PATTERNS (instant AI tells):
- Side-stripe borders on cards (border-left: 4px solid ...)
- Identical card grids (icon + heading + text repeated)
- Hero metric layout (big number, small label, gradient accent)
- Particle background + gradient text hero
- Purple-to-blue gradients on dark backgrounds
- Bounce/elastic easing
`
