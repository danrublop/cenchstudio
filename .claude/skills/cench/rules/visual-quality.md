# Visual Quality Guide

Adapted from [Impeccable](https://github.com/pbakaus/impeccable) for video/animation context.
These rules apply to ALL scene types.

---

## The Slop Test

If someone looked at your output and said "AI made this," would they believe it
immediately? If yes, redesign. Distinctive output makes people ask "how was this
made?" not "which AI made this."

---

## Typography

### Font selection — do this BEFORE writing any font name

1. Read the brief. Write 3 concrete words for the visual tone.
   Not "modern" or "elegant" — those are dead categories.
   Try: "warm and mechanical and opinionated" or "calm and clinical and careful"
   or "fast and dense and unimpressed" or "handmade and a little weird."

2. Imagine the font as a physical object the brand could ship: a typewriter ribbon,
   a hand-lettered shop sign, a 1970s mainframe manual, a fabric label inside a coat,
   a museum exhibit caption, a children's book on cheap newsprint.

3. Browse Google Fonts with that object in mind. **Reject the first thing that
   "looks designy"** — that's the trained reflex.

### Banned fonts (reflex fonts — instant AI tells)

Do NOT use: Inter, Syne, Space Grotesk, DM Sans, DM Serif Display, Playfair Display,
Outfit, Plus Jakarta Sans, Instrument Sans, Instrument Serif, Fraunces, Newsreader,
Lora, Crimson Pro, Cormorant, IBM Plex Mono, Montserrat, Open Sans, Roboto, Lato.

These are everywhere. They make every design feel generic.

### Type hierarchy

Use **fewer sizes with more contrast**. A 5-step scale covers most scenes:

| Role    | Size (1920×1080) | Weight  | Use                      |
| ------- | ---------------- | ------- | ------------------------ |
| Display | 80–160px         | 800-900 | Hero text, scene title   |
| Heading | 36–56px          | 700     | Section headings         |
| Body    | 22–32px          | 400-500 | Paragraphs, descriptions |
| Label   | 14–20px          | 500-600 | Tags, metadata, captions |
| Caption | 11–14px          | 400     | Fine print, footnotes    |

The ratio between adjacent levels should be **at least 1.25×**. If your sizes are
48/44/40/36 — that's muddy. Use 80/48/28/16 instead.

### Text on dark backgrounds

Light text on dark reads as heavier. Reduce weight slightly (use 400 instead of 500)
and increase line-height by 0.05-0.1 compared to light-mode equivalents.

---

## Color

### Tinted neutrals

Pure gray (`#808080`) is dead. Add a tiny tint (0.005-0.015 chroma in OKLCH)
toward your scene's accent color. The tint is too subtle to read consciously
but creates subconscious cohesion.

If your accent is red, tint your grays warm. If blue, cool. The point is
cohesion with THIS scene's palette, not a generic "warm = friendly" formula.

### The 60-30-10 rule

- **60%**: Neutral backgrounds, whitespace, base surfaces
- **30%**: Secondary — text, borders, muted elements
- **10%**: Accent — CTAs, highlights, key moments

Accent colors work BECAUSE they're rare. Overuse kills their power.
A scene with 40% accent color has no focal point.

### Banned color patterns

- Never pure black (#000000) or pure white (#ffffff) — always tint
- Never gray text on a colored background — use a darker shade of the bg
- Never cyan-on-dark, purple-to-blue gradients, neon accents on dark — the AI palette
- Never gradient text — solid colors only for text

### Theme from context

Dark is not the default. Light is not the default. Choose based on content:

- Science, tech, night scene → dark
- Medical, wellness, morning → light
- Educational, kids → light
- Data dashboard, monitoring → dark
- Food, lifestyle, editorial → depends on mood

---

## Composition & Spatial Design

### The squint test

Blur your eyes. Can you identify:

- The most important element?
- The second most important?
- Clear groupings?

If everything looks the same weight, you have a hierarchy problem.

### Hierarchy through multiple dimensions

Don't rely on size alone. Combine 2-3:

| Dimension | Strong                   | Weak              |
| --------- | ------------------------ | ----------------- |
| Size      | 3:1 ratio                | <2:1              |
| Weight    | Bold vs Regular          | Medium vs Regular |
| Color     | High contrast            | Similar tones     |
| Position  | Top/left                 | Bottom/right      |
| Space     | Surrounded by whitespace | Crowded           |

### Layout principles

- **Asymmetry over centering.** Left-aligned text with asymmetric layout feels more designed
  than centered everything. Reserve centering for hero moments.
- **Vary spacing.** Tight groupings next to generous whitespace creates rhythm.
  Same-padding-everywhere is monotonous.
- **Cards are overused.** Spacing and alignment create visual grouping naturally.
  Only use cards when content needs clear interaction boundaries or comparison.
- **Break the grid intentionally** for emphasis. One off-grid element draws the eye.

### Safe area

1920×1080 viewport. Keep important content within 100px inset from edges
(x: 100–1820, y: 100–980). Background elements may bleed to edges.
If too many items to fit, reduce count, use smaller text, multi-column, or split scenes.

---

## Motion Design

### Timing (adapted for video at 30fps)

| Duration  | Frames | Use                                         |
| --------- | ------ | ------------------------------------------- |
| 100-150ms | 3-5    | Micro-feedback (color change, subtle shift) |
| 200-350ms | 6-10   | Element entrance                            |
| 350-500ms | 10-15  | Layout change, panel reveal                 |
| 500-800ms | 15-24  | Hero entrance, major reveal                 |

**Exit at 75% of entrance duration.** Exits should feel quicker than entrances.

### Easing — exponential only

| Curve            | Use              | CSS/bezier                       |
| ---------------- | ---------------- | -------------------------------- |
| Ease-out (quart) | Entrances        | `cubic-bezier(0.25, 1, 0.5, 1)`  |
| Ease-out (expo)  | Snappy entrances | `cubic-bezier(0.16, 1, 0.3, 1)`  |
| Ease-in          | Exits            | `cubic-bezier(0.7, 0, 0.84, 0)`  |
| Ease-in-out      | State toggles    | `cubic-bezier(0.65, 0, 0.35, 1)` |

For React scenes, use `Easing.bezier(0.16, 1, 0.3, 1)` as the `easing` option
in `interpolate()`.

**NEVER use bounce or elastic.** They were trendy in 2015 and now feel amateurish.
Real objects decelerate smoothly — they don't bounce when they stop.

### Stagger

50-100ms (2-3 frames) between items. Cap total stagger under 800ms (24 frames).
For 10+ items, reduce per-item delay rather than extending total time.

### Scene timing structure

- 0-20% of duration: background + first elements appear
- 20-60%: main content builds (staggered entrances)
- 60-80%: final elements, emphasis moments
- 80-100%: HOLD — everything visible, viewer absorbs

The final element should finish animating at ~80%. The last 20% is "hold time"
where the complete picture sits for the viewer to read and understand.

### Camera motion (required)

Every scene should have subtle camera movement. A static camera feels like a
PowerPoint slide, not a video.

- **Default**: `CenchCamera.kenBurns({ duration: DURATION, endScale: 1.04 })` —
  slow barely-perceptible zoom that gives the scene breath
- **Reveals**: `CenchCamera.presetCinematicPush()` — slow forward push
- **Emphasis**: `CenchCamera.dollyIn({ targetSelector: '#key-element' })` — zoom into

---

## Anti-Patterns (Instant AI Tells)

These are the most recognizable AI design cliches. Match-and-refuse.

1. **Side-stripe borders** on cards/callouts (`border-left: 4px solid ...`)
2. **Gradient text** — solid colors only for text
3. **Identical card grids** — same-size cards with icon + heading + text repeated endlessly
4. **Hero metric layout** — big number, small label, supporting stats, gradient accent
5. **Centered everything** — especially centered title + centered subtitle + centered button
6. **Bounce/elastic easing** — on anything
7. **Particle background + gradient text hero** — the AI default combination
8. **Purple-to-blue gradients** — especially on dark backgrounds
9. **Overused fonts** — see banned list above
10. **Same animation direction for everything** — not everything should fade-in-from-below

---

## Randomness

NEVER use `Math.random()`. In React scenes, derive "random" values from
the frame number and item index deterministically:

```jsx
const pseudoRandom = (seed) => {
  let s = seed
  s = (s + 0x6d2b79f5) | 0
  s = Math.imul(s ^ (s >>> 15), 1 | s)
  s = (s + Math.imul(s ^ (s >>> 7), 61 | s)) ^ s
  return ((s ^ (s >>> 14)) >>> 0) / 4294967296
}
```

Or use index-based values: `const offset = (i * 137.5) % 360` for evenly-spaced hues.
