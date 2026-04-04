# Zdog Scene Rules

## What Zdog is

Zdog renders pseudo-3D using 2D canvas/SVG drawing.
The visual result looks like flat vector illustration with 3D depth.
Perfect for whiteboard-style 3D: molecules, gears, globes, org charts.

Zdog is a global object (loaded via CDN).

## Basic setup

```js
const canvas = document.getElementById('{layerId}-canvas')
const illo = new Zdog.Illustration({
  element: canvas,
  zoom: 4,
  dragRotate: false, // ALWAYS false — WVC has no mouse events
  resize: false,
  width: WIDTH,
  height: HEIGHT,
})
```

dragRotate MUST be false. If true, Zdog initializes expecting mouse
events that don't exist in headless Chrome during WVC export.

## Coordinate system

Origin: center of canvas (0, 0)
x: positive = right
y: positive = DOWN (opposite to standard math)
z: positive = toward camera

At zoom=4: a shape at diameter=40 appears ~160px wide on screen.

## Available shapes

```js
new Zdog.Ellipse({ addTo, diameter, stroke, color, fill, translate, rotate })
new Zdog.Rect({ addTo, width, height, stroke, color, fill, translate, rotate })
new Zdog.RoundedRect({ addTo, width, height, cornerRadius, stroke, color })
new Zdog.Polygon({ addTo, radius, sides, stroke, color, fill })
new Zdog.Shape({ addTo, path: [{x,y,z},...], stroke, color, closed, fill })
new Zdog.Cylinder({ addTo, diameter, length, stroke, color, fill, backface })
new Zdog.Cone({ addTo, diameter, length, stroke, color })
new Zdog.Box({ addTo, width, height, depth, stroke, color, fill,
               leftFace, rightFace, topFace, bottomFace, frontFace, rearFace })
new Zdog.Hemisphere({ addTo, diameter, stroke, color, fill, backface })
```

## Groups (use for rotating sets of shapes together)

```js
const group = new Zdog.Anchor({ addTo: illo, translate, rotate, scale });
// Add shapes to group:
new Zdog.Ellipse({ addTo: group, ... })
```

## Animation loop

```js
const startTime = performance.now()
function animate(timestamp) {
  const elapsed = (timestamp - startTime) / 1000
  if (elapsed > DURATION) return

  illo.rotate.y = elapsed * 0.5 // slow spin
  illo.updateRenderGraph()
  requestAnimationFrame(animate)
}
requestAnimationFrame(animate)
```

## Animate shapes in (lerp toward target position)

Start shapes offscreen or at scale 0, lerp to final position:

```js
shape.translate.y += (targetY - shape.translate.y) * 0.05
```

## Colors

Use PALETTE array:

```js
color: PALETTE[0]
fill: PALETTE[1]
stroke: PALETTE[2]
```

## Text

Zfont (Zdog's text system) requires loading a font file — complex.
INSTEAD: Use a separate HTML overlay layer for any text labels.
The agent should automatically add an html layer when Zdog needs labels.

## What works well in Zdog

- Rotating molecular/atomic models (Hemisphere + Cylinder)
- 3D bar charts (Box shapes of varying height)
- Spinning globes (Ellipse rings on a sphere)
- Gears (Polygon + Cylinder)
- Network diagrams (Ellipse nodes + Shape connectors)
- Product boxes (Box with different face colors)
- Solar system / orbital models (Ellipse rings + Sphere)

## Max shapes

Keep total shape count under 30 for smooth performance in headless Chrome.
Complex scenes: use Anchor groups to manage visual complexity
without adding more individual shapes.

## HTML template

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 100%; height: 100vh; overflow: hidden; background: {{BG_COLOR}}; }
      canvas { display: block; width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <canvas id="zdog-canvas" width="1920" height="1080"></canvas>
    <script src="https://unpkg.com/zdog@1/dist/zdog.dist.min.js"></script>
    <script>
      const WIDTH = 1920, HEIGHT = 1080;
      const PALETTE = {{PALETTE}};
      const DURATION = {{DURATION}};
      window.__animFrame = null;
      window.__pause  = () => { cancelAnimationFrame(window.__animFrame); };
      window.__resume = () => {};

      {{SCENE_CODE}}
    </script>
  </body>
</html>
```

## Zdog Studio Assets

The `build_zdog_asset` tool saves shape hierarchies (characters, items, props) as reusable assets.

### Shape format

Each shape has: `id`, `type`, `parentId?`, `name`, `properties`, `transforms`.

**Types:** Ellipse, Rect, RoundedRect, Polygon, Shape, Anchor, Group, Box, Cylinder, Cone, Hemisphere

**Properties:** stroke, color, fill, diameter, width, height, depth, length, cornerRadius, sides, radius, quarters, closed, visible, backface, path (Shape only), face colors (Box only)

**Transforms:** `{ translate: {x,y,z}, rotate: {x,y,z}, scale: number }`

### Person rig pattern

```
hips (Shape, path [-3,3], stroke 4) → y:5
  spine (Anchor) → rotate.x: TAU/8
    chest (Shape, path [-1.5,1.5], stroke 9) → y:-6.5
      head (Shape, stroke 12) → y:-9.5
        eyes (Ellipse × 2, quarters 2)
        mouth (Ellipse)
        hair (Shape × N)
      arms (Shape → Shape → Shape) × 2
    legs (Shape → RoundedRect) × 2
```

### Coordinate system

- x: right, y: DOWN, z: toward camera
- Use Anchor/Group as invisible hierarchy nodes
- stroke gives shapes their rounded 3D depth
