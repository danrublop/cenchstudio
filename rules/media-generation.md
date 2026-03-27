# AI Media Generation

## Permission Gate
ALWAYS call request_permission() before any of these tools:
- generate_avatar (HeyGen)
- generate_veo3_video
- generate_image
- generate_sticker
- remove_background (if standalone)

Never call the actual generation tool without receiving permission first.
Wait for the permission_response event before proceeding.
If denied, offer alternatives using existing tools.

## When to use each tool

### generate_avatar
Use when: user wants a presenter, narrator, explainer character,
spokesperson, or talking head in a scene.
Always ask: what should the avatar say? (need script)
Duration: scene duration should match script speaking time.
~150 words per minute for natural pacing.

### generate_veo3_video
Use when: user wants cinematic footage, atmospheric backgrounds,
abstract motion, b-roll, product shots, or nature scenes.
NOT for: anything with text, diagrams, or explanations.
Enhance the user's prompt cinematically before calling.
Duration: 5 or 8 seconds only. Set loop: true for longer scenes.

### generate_image
Use when: user wants a specific photo, illustration, or graphic
that doesn't exist in the asset library.
Choose model based on content type:
- For text-containing images: ideogram-v3
- For illustrations: recraft-v3
- For photos: flux-1.1-pro or stable-diffusion-3
- For fast iteration: flux-schnell

### generate_sticker
Use when: user wants a floating illustrated element with no background.
Always use removeBackground: true.
Prefer recraft-v3 model for clean illustration edges.
Stickers animate in by default (pop scale effect).
NEVER use photorealistic style for stickers — illustrations have
cleaner edges after background removal.

## Compositing strategy
Generated media works best as layers:
- Veo video: bottom layer (background)
- Canvas2D diagram: middle layer (main content)
- Stickers: above diagrams
- Avatar: top layer, positioned to side of content
- HTML text: always top layer

## Async generation
HeyGen and Veo take minutes. Tell the user:
"This will take 2-5 minutes. You can continue working on other scenes."
Never block the conversation waiting — the system will notify when ready.
Image generation (fal.ai) is near-instant (3-15 seconds).
