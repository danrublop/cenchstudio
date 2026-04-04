# Custom Avatar Pipeline for Cench Studio

## Why custom avatars are needed

The current dev avatars have licensing restrictions:

- `brunette.glb` -- CC BY-NC 4.0 -- **non-commercial only**, must be replaced before shipping
- `mpfb.glb` -- CC0 (public domain) -- safe for commercial use, but generic Blender character with limited blend shapes (13 vs 72)

For production, Cench needs commercial-licensed GLB files with full Mixamo rigs and ARKit/Oculus viseme blend shapes.

## Requirements for a compatible avatar

Every avatar used with TalkingHead.js must have:

1. **Mixamo-compatible skeleton** -- bone hierarchy rooted at an `Armature` node
   - Key bones: `Hips`, `Spine`, `Spine1`, `Spine2`, `Neck`, `Head`, `LeftArm`, `RightArm`, etc.
   - Bones may use `mixamorig` prefix (e.g., `mixamorigHips`) -- TalkingHead handles both

2. **ARKit blend shapes** (52 shapes) -- for facial expressions:
   `browDownLeft`, `browDownRight`, `eyeBlinkLeft`, `eyeBlinkRight`, `jawOpen`, `mouthSmileLeft`, `mouthSmileRight`, etc.

3. **Oculus viseme blend shapes** -- for lip sync:
   `viseme_sil`, `viseme_PP`, `viseme_FF`, `viseme_TH`, `viseme_DD`, `viseme_kk`, `viseme_CH`, `viseme_SS`, `viseme_nn`, `viseme_RR`, `viseme_aa`, `viseme_E`, `viseme_I`, `viseme_O`, `viseme_U`

4. **Additional blend shapes**: `mouthOpen`, `mouthSmile`, `eyesClosed`, `eyesLookUp`, `eyesLookDown`

5. **File format**: GLB (binary glTF), not VRM, FBX, or OBJ

## Pipeline: Create a custom avatar

### Option A -- Avaturn (recommended, commercial license available)

1. Go to avaturn.me -- create a realistic avatar
2. Export as GLB with "Mixamo rig" option selected
3. Ensure morph targets include ARKit + Oculus visemes during export
4. Download and place in `public/avatars/`
5. Update CHARACTER_MAP in `lib/sceneTemplate.ts`

Avaturn's paid plan includes commercial licensing. Free plan is non-commercial only.

### Option B -- Blender + MPFB (free, CC0 output)

1. Install Blender (free) + MPFB2 extension (free, MIT)
2. Generate a human character in MPFB2
3. Rig with Mixamo: upload to mixamo.com -> auto-rig -> download FBX
4. Import FBX back into Blender, convert to GLB
5. Add ARKit + Oculus viseme blend shapes (shape keys) -- this is the hard part
   See: https://github.com/met4citizen/TalkingHead (Appendix A) for the full list
6. Export as GLB from Blender

This produces CC0 output. Time investment: ~4-8 hours for someone new to Blender.

### Option C -- Mixamo for rigging only (royalty-free)

Mixamo animations are royalty-free for commercial use, but character models from Mixamo (Adobe Fuse) are not. Use Mixamo only for rigging, not character creation.

1. Create character elsewhere (Blender, MetaHuman, purchased model)
2. Upload to mixamo.com -> auto-rig -> adds the Mixamo skeleton
3. Download rigged character as FBX
4. Import to Blender -> export as GLB
5. Add viseme blend shapes in Blender (required for lip sync)

## Testing a new avatar

```js
// In browser console after loading the avatar scene:
// Check if model loads without errors
// Expected: 3D model visible, no "Armature not found" error
// If lips don't move: check morph target count (need viseme_* shapes)
```

Common errors:

- `"Avatar object Armature not found"` -- skeleton root is named differently. Check the GLB in https://gltf.report or Blender to find the actual root bone name.
- Model loads but no lip sync -- missing Oculus viseme blend shapes. Need at least: `viseme_sil`, `viseme_aa`, `viseme_E`, `viseme_I`, `viseme_O`, `viseme_U`.

## Replacing the dev avatars

Once you have commercial-licensed GLBs:

1. Place in `public/avatars/`
2. Update CHARACTER_MAP in `lib/sceneTemplate.ts`
3. Remove the license warning comments
4. Delete `brunette.glb` (CC BY-NC, not for production)
5. Keep `mpfb.glb` as a fallback if desired (CC0)

## Current avatar file inventory

| File           | Size  | License      | Morph Targets | Status                            |
| -------------- | ----- | ------------ | ------------- | --------------------------------- |
| `brunette.glb` | 4.5MB | CC BY-NC 4.0 | 72            | Dev only                          |
| `mpfb.glb`     | 35MB  | CC0          | 13            | Commercial safe, limited lip-sync |
