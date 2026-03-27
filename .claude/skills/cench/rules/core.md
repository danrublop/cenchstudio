# Core Rules — All Scene Types

These rules apply to every scene regardless of type.

---

## Globals

- Canvas is always **1920x1080** — fill the space deliberately
- Default background: `#181818`
- Default palette: `#181818, #121212, #e84545, #151515, #f0ece0`
- Duration defaults to **8 seconds** unless specified

---

## Randomness — NEVER use Math.random()

Always use the mulberry32 seeded PRNG:

```js
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}
const rand = mulberry32(42);
```

Every scene that uses randomness must include this function and call `rand()` instead of `Math.random()`.

---

## Text rules

- **NEVER animate text character-by-character** — animate the whole element
- Do not use `<foreignObject>` in SVG — use `<text>` elements only
- Pair large display text (80–160px) with smaller annotations (32–56px)

---

## Duration — how long a scene should be

Duration should match how long it takes to **read all visible text aloud**.
Estimate: **150 words per minute** (2.5 words per second).

For each scene, count all visible text (titles, labels, steps, annotations) and calculate:
```
duration = max(6, (wordCount / 2.5) + 3)
```
The +3s padding allows time for visual absorption after the last element appears.

**Scene type minimums:**
- Title cards: 5–7s
- Simple diagrams with labels: 8–12s
- Step-by-step walkthroughs (3+ steps): 12–18s
- Data-heavy scenes (charts, tables, comparisons): 12–18s
- Summary/recap scenes: 10–15s

**If narration will be added later:**
Duration should be set to match narration audio length + 1s padding.
Narration pace: ~150 words per minute. A 30-word narration ≈ 12s scene.

**Key principle:** Viewers need time to read AND understand. A scene with 5 text elements appearing sequentially needs each one visible for at least 1.5–2s before the next appears, plus 2–3s after the last one for the viewer to absorb the complete picture.

## Timing

- Animation must complete within the specified duration
- **Never** assign `--delay: 0` to all elements — stagger deliberately
- Layer order: background 0–20% of duration → midground 20–60% → foreground 60–80% → text 70–90%
- **Final element should finish animating at ~80% of duration** — leave 20% as a "hold" where everything is visible and the viewer absorbs the scene

---

## Safe area

Keep important content within a 100px inset from all edges (i.e., between x=100 and x=1820, y=100 and y=980). Background graphics may bleed to edges.

---

## Fonts

Use system fonts or load from Google Fonts via `<link>` in the HTML head. Safe system fonts: `'Arial'`, `'Georgia'`, `'monospace'`. For a modern look, add:

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
```

Then use `font-family: 'Inter', sans-serif`.

---

## Output format

Output raw code only. No markdown fences. No explanation before or after the code block.
