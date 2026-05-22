# Transparent Water Design

## Goal

Make Aquagarden feel like a real aquarium sitting inside the user's desktop. The water volume should be almost transparent so the desktop remains visible through it, while the substrate, fish, plants, bubbles, caustics, surface line, and glass edges stay visually present.

The selected direction is **B. glass-edge transparent water**: remove the filled water-box feeling, keep subtle aquarium cues, and avoid reducing the whole canvas opacity as the primary effect.

## Current Context

The app already uses a transparent, frameless Tauri window:

- `src-tauri/tauri.conf.json` sets `transparent: true`, `decorations: false`, `alwaysOnTop: true`, and `shadow: false`.
- `src/styles.css` keeps the page background transparent.
- `src/main.ts` currently creates a `THREE.WebGLRenderer` without explicit alpha and clears to an opaque scene background color.
- `src/scene/aquascape.ts` owns the glass shell, substrate, water surface, plants, rocks, fish habitat, and bubbles.
- `src/scene/lighting.ts` owns fog, clear color, and caustic overlays.
- `src/scene/postfx.ts` owns bloom, output, and grading.
- The menu opacity slider currently applies CSS opacity to the whole canvas, which dims fish and bottom details together with the water.

## Design

### Rendering Contract

The renderer should preserve canvas alpha:

- Create `THREE.WebGLRenderer` with `alpha: true`.
- Use a transparent clear color for live rendering, so the desktop can show through empty and water-filled regions.
- Keep capture mode deterministic, but allow captures to run with the same transparent-scene defaults unless a script later needs a matte background.

### Scene Layers

`aquascape.ts` should make the aquarium readable through edge and highlight cues rather than through a filled blue-green volume:

- Glass shell: lower fill opacity, keep edge/specular perception through material properties.
- Water surface: reduce plane opacity and increase reliance on a thin surface highlight.
- Bubbles: keep or slightly increase visibility because bubbles are a key "there is water here" cue.
- Substrate, rocks, wood, plants, fish, shrimp, and snails: keep opaque and saturated enough to remain the visual anchors.

### Lighting and Atmosphere

`lighting.ts` should stop the background and fog from painting a solid rectangle over the desktop:

- Use transparent clear alpha in renderer updates instead of treating `colors[mode].bg` as an opaque matte.
- Reduce day fog density and keep dusk/night atmospheric but not opaque.
- Keep caustics visible on the substrate and rocks, since they sell the aquarium illusion without filling the whole water volume.

### Postprocessing

`postfx.ts` should preserve transparency:

- Bloom remains limited to highlights.
- Grade pass must not force alpha to 1.0. It should pass through the sampled alpha from `tDiffuse`.
- Vignette and grain should affect visible pixels only and avoid creating a visible dark rectangle around the widget.

### Existing Opacity Slider

The opacity slider stays in place. It remains a whole-widget dimmer for users who want the aquarium quieter, but the default visual strategy should be layer-level transparency so fish and bottom details do not fade just because the water is clear.

## Error Handling

If a browser or GPU path does not preserve alpha through postprocessing, the scene should still render normally with an opaque-looking fallback rather than failing. The implementation should avoid new external assets or network dependencies.

## Testing

Unit tests should cover stable numeric presets where practical:

- PostFX defaults should remain low enough to avoid visible matte/vignette rectangles.
- Lighting presets should assert reduced fog and transparent-friendly values.
- Aquascape material presets should be exportable or otherwise testable for glass, water, and bubble opacity.

Manual and scripted verification:

- Run `npm run test`, `npm run lint`, and `npm run build`.
- Capture at least a front/day frame with the existing capture workflow or browser screenshot.
- Inspect that the desktop or checker background is visible through the water region while fish, substrate, bubbles, and caustics remain prominent.

## Acceptance Criteria

- The aquarium no longer appears as a solid colored rectangle.
- The water body is nearly transparent in day mode.
- Glass edges, surface line, bubbles, and caustics still communicate "aquarium" rather than loose objects floating on the desktop.
- Fish and substrate remain more visually prominent than the water tint.
- Existing controls, click-through behavior, collapse behavior, and HUD remain unchanged.

## Out of Scope

- New UI controls for water transparency presets.
- New image assets or downloaded textures.
- Major scene composition changes to plants, rocks, fish movement, or HUD layout.
