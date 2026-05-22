# Aquagarden Handoff Plan

## Current State

- Branch: `codex/calm-clarity`
- Latest pushed implementation commit: `e1f397b feat(scene): tune calm motion and clarity`
- Latest pushed documentation commit: `d44c95b docs: add calm clarity handoff`
- Remote branch: `origin/codex/calm-clarity`
- PR URL to open: `https://github.com/outliner-coach/aquagarden_gemini_flash_3.5/pull/new/codex/calm-clarity`
- Worktree should be clean after pulling this branch.

## What Changed

- Calm fish motion:
  - `src/scene/fauna/fish.ts` now has `fishMotionProfiles` and `turnSlowdownForDot()`.
  - Fish speed, steering lerp, turn lerp, tail frequency, and tail amplitude are species-specific.
  - Tetra flock steering is buffered with `flockSteer.lerp(...)`.
  - Tail wag tempo follows actual velocity so slow fish do not look frantic.
- Clearer visual direction:
  - `src/scene/lighting.ts` exposes `targetLightSettingsForMode()` and uses a clearer teal day palette.
  - `src/scene/postfx.ts` exposes `gradeDefaults`, `bloomDefaults`, and `toneMappingExposure`.
  - Vignette and grain are reduced; Bloom is tightened.
  - Plant and tetra stripe colors were nudged brighter without returning to neon/flat lime.
- Usage mood:
  - `src/scene/mood.ts` warning/critical fog and speed effects are softer so high usage does not ruin the aquarium.
- Tests:
  - Added `src/scene/fauna/fish.test.ts`, `src/scene/lighting.test.ts`, `src/scene/postfx.test.ts`.
  - Updated `src/scene/mood.test.ts`.
- Planning doc:
  - `gemini_plan.md` now matches actual implemented values.

## Verification Already Run

- `npm run test` — passed, 51 tests.
- `npm run lint` — passed.
- `npm run build` — passed with only the known Vite chunk-size warning.
- `cd src-tauri && source "$HOME/.cargo/env" && cargo test` — passed.
- `CAPTURE_PHASE=3-calm-clarity CAPTURE_STEP=motion-clarity npm run capture` — passed.
- `npm run dev` — app launched after clearing a stale `vite` process on port 1420.

## Artifacts To Inspect

- `phases/3-calm-clarity/captures/motion-clarity/front_day.png`
- `phases/3-calm-clarity/captures/motion-clarity/gpu_front_day.png`
- `phases/3-calm-clarity/captures/motion-clarity/clip_front_day.webm`
- Compare against `phases/2-polish/captures/refine2/front_day.png` and the live original if needed.

## Recommended Next Steps

1. Ask the user for visual signoff on the current app and capture artifacts.
2. Open a PR from `codex/calm-clarity` to `main`.
3. If the user says high-usage mode still feels too disruptive, add a capture path or fixture for 80/95% context pct before tuning further.

## Useful Commands

- Run app: `npm run dev`
- Stop app: `Ctrl-C` in the dev terminal, or `⌘⌥Q` in the app.
- Frontend tests: `npm run test`
- Lint: `npm run lint`
- Build: `npm run build`
- Rust tests: `cd src-tauri && source "$HOME/.cargo/env" && cargo test`
- Capture: `CAPTURE_PHASE=3-calm-clarity CAPTURE_STEP=motion-clarity npm run capture`
