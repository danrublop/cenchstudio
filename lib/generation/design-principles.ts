/**
 * Shared design quality bar injected into every generation prompt.
 * Adapted from Impeccable (pbakaus) for video/animation context.
 *
 * THIS IS THE SINGLE SOURCE OF TRUTH for design guidelines.
 * Also mirrored in: .claude/skills/cench/rules/visual-quality.md
 * If you update this file, update the mirror too.
 */

// ── Aspect-ratio-specific layout rules ──────────────────────────────────────

const LANDSCAPE_LAYOUT_RULES = `
ASPECT RATIO: Landscape (16:9)
- Full layout pattern library available. Side-by-side layouts encouraged.
- Hero text: 80-160px. Content can span full width.
- HERO-SPLIT works especially well — 60/40 text-visual split.
- OFFSET-GRID for comparisons using the wide canvas.
`

const PORTRAIT_LAYOUT_RULES = `
ASPECT RATIO: Portrait (9:16 or 4:5)
- Stack EVERYTHING vertically. Never use side-by-side columns — not enough width.
- Maximum 3 text blocks per scene (even less space than landscape).
- Hero text: 60-100px (narrower viewport demands smaller type).
- Full-width cards only, max 2 per scene.
- Increase vertical spacing between groups to 64px minimum.
- Available layout patterns: STACK-BREATHE, STAT-ANCHOR (vertical), FOCAL-POINT.
- Do NOT use: HERO-SPLIT, OFFSET-GRID, EDITORIAL-COLUMN (they need horizontal space).
`

const SQUARE_LAYOUT_RULES = `
ASPECT RATIO: Square (1:1)
- Center-biased layouts are acceptable (unlike landscape where asymmetry is preferred).
- Maximum 4 visual elements per scene.
- Hero text: 64-96px.
- Consider radial or circular compositions — the square frame naturally draws the eye to center.
- Available layout patterns: FOCAL-POINT, STACK-BREATHE, HERO-SPLIT (use 50/50 split).
- STAT-ANCHOR works centered in square format.
`

// ── Main design principles ──────────────────────────────────────────────────

export function getDesignPrinciples(dims?: { width: number; height: number }): string {
  const W = dims?.width ?? 1920
  const H = dims?.height ?? 1080
  const isPortrait = H > W
  const isSquare = Math.abs(W - H) < 100 // treat near-square as square
  const scale = W / 1920

  // Scale spacing values proportionally
  const safeArea = Math.round(80 * scale)
  const groupGap = Math.round(48 * scale)
  const innerGap = Math.round(16 * scale)
  const titleGapMin = Math.round(64 * scale)
  const titleGapMax = Math.round(96 * scale)
  const cardPaddingMin = Math.round(32 * scale)
  const cardPaddingMax = Math.round(48 * scale)
  const minGap = Math.round(24 * scale)
  const sectionGap = Math.round(120 * scale)

  const aspectRules = isPortrait ? PORTRAIT_LAYOUT_RULES : isSquare ? SQUARE_LAYOUT_RULES : LANDSCAPE_LAYOUT_RULES

  return `
DESIGN QUALITY BAR (adapted from Impeccable):

The Slop Test: If someone looked at your output and said "AI made this," would they believe it immediately? If yes, redesign. Distinctive output makes people ask "how was this made?" not "which AI made this."

TYPOGRAPHY:
- VIDEO TEXT MUST BE LARGE. This is video, not a webpage — viewers watch on phones, embedded players, TVs across a room. Text that looks fine in a code editor is unreadable in a video.
- 4-step scale for video (at 1920×1080): display (100-180px), heading (48-72px), body (32-42px), label (24-32px). NOTHING below 24px. Ratio between levels: at least 1.5×.
- The absolute minimum readable text in video is 24px at 1920×1080. If you're tempted to use a smaller size, remove the text instead — it won't be read.
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

CONTENT DENSITY (hard limits — do not exceed):
- Maximum 5 text blocks per scene (1 title + up to 4 supporting elements).
- Maximum 4 list/bullet items visible simultaneously. Longer lists → split across scenes.
- Maximum 3 cards or containers per scene. Prefer 1-2 for visual impact.
- If a scene has more than 6 distinct visual elements, remove or combine until 5 or fewer.
- One "hero element" per scene that occupies 40-60% of viewport area.
- Body text: maximum 3 lines per text block (~50 words). Cut ruthlessly.
- Bullet points: maximum 8 words per bullet. If longer, rewrite.
- These limits exist because viewers watch, not read. Less content = more retention.

SPACING SYSTEM (viewport: ${W}×${H}px):
- Viewport edge safe area: ${safeArea}px inset from all edges minimum.
- Gap between content groups (e.g. title block vs. body block): ${groupGap}px minimum.
- Gap between elements within a group (e.g. heading and subheading): ${innerGap}px minimum.
- Title-to-first-content gap: ${titleGapMin}-${titleGapMax}px — this breathing room is what separates good from amateur.
- Card/container internal padding: ${cardPaddingMin}-${cardPaddingMax}px.
- Minimum gap between any two elements: ${minGap}px. Never less.
- Whitespace target: at least 40% of the viewport should be empty space. If your layout feels dense, remove elements — don't shrink them.
- Between sections or conceptual groups: ${sectionGap}px+ vertical gap.

ELEMENT SIZING:
- Hero/display text: at least ${isPortrait ? '72' : '100'}px, spanning 50%+ of viewport width.
- Heading text: at least ${isPortrait ? '40' : '48'}px.
- Body text: at least ${isPortrait ? '28' : '32'}px. This is the FLOOR — body text below this is unreadable in video.
- Labels, list items, annotations: at least ${isPortrait ? '22' : '24'}px. Nothing smaller, ever.
- Heading-to-body font size ratio: at least 1.5× (e.g. 72px heading, 36px body — not 48px/36px).
- Icons and illustrations: ${Math.round(140 * scale)}-${Math.round(400 * scale)}px. Below ${Math.round(140 * scale)}px they become unreadable.
- Data visualizations: minimum ${Math.round(500 * scale)}px wide, ${Math.round(300 * scale)}px tall.
- Interactive elements (pills, badges, tags): at least 24px text, 48px height minimum.
- Decorative elements: never larger than the primary content element.
- If text won't fit at these sizes, you have too much text. Cut content, don't shrink type.
- COMMON MISTAKE: Using 16-20px for secondary text. That's web sizing, not video sizing. Scale everything up.

LAYOUT PATTERNS (choose one per scene — do not improvise from scratch):

HERO-SPLIT: Large text left (60% width), visual/illustration right (40%). Text left-aligned. Visual can bleed to edge. Best for: introductions, key statements, definitions.

STACK-BREATHE: Full-width text blocks stacked vertically with ${Math.round(80 * scale)}px+ gaps. No containers or cards. Let whitespace do the grouping. Best for: single concepts, quotes, definitions.

OFFSET-GRID: 2-column asymmetric grid (55/45 or 65/35 split). Items intentionally DON'T align horizontally — the offset creates visual interest. Best for: comparisons, before/after, two related concepts.

FOCAL-POINT: One large central element (60%+ of viewport) with 2-3 small annotations positioned around it with subtle leader lines or arrows. Best for: diagrams, anatomy, feature highlights.

TIMELINE-FLOW: Horizontal or vertical flow with connected nodes. Maximum 4 nodes per scene. Best for: processes, history, step-by-step sequences.

STAT-ANCHOR: One massive number/metric (${Math.round(120 * scale)}px+) anchored to the left or top third, with supporting context text in smaller type beside or below it. NOT centered. Best for: data points, key statistics, impact numbers.

EDITORIAL-COLUMN: Single narrow text column (max ${Math.round(600 * scale)}px wide) offset to the left third, with a full-bleed background color, image, or illustration filling the rest. Best for: narrative text, storytelling.

SCATTER-ORGANIC: Elements placed at intentional but non-grid positions, varying in size. Connected by subtle lines, shared color, or proximity. Best for: mind maps, ecosystem overviews, relationship diagrams.
${aspectRules}
`
}

/** Backward-compatible static export (uses default 1920×1080 landscape). */
export const DESIGN_PRINCIPLES = getDesignPrinciples()
