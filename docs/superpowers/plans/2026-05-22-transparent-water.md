# Transparent Water Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved B-direction glass-edge transparent aquarium so the desktop shows through the water while fish, substrate, bubbles, caustics, and edges remain prominent.

**Architecture:** Keep the existing Tauri transparent window and Three.js scene structure. Make transparency a rendering and material contract: renderer alpha is preserved, clear color alpha is transparent, water/glass materials use low opacity, and postprocessing passes through sampled alpha instead of painting an opaque matte.

**Tech Stack:** Tauri v2, Vite, TypeScript, Three.js, Vitest, ESLint.

---

## File Structure

- Modify `src/main.ts`: create the WebGL renderer with alpha support and initialize clear alpha from lighting constants.
- Modify `src/scene/aquascape.ts`: export a small material preset contract and use it for glass, water surface, and bubbles.
- Create `src/scene/aquascape.test.ts`: lock the transparent water material values.
- Modify `src/scene/lighting.ts`: expose transparent clear alpha, add `clearAlpha` to target light settings, reduce fog density, and keep caustics visible.
- Modify `src/scene/lighting.test.ts`: lock transparent-friendly light settings.
- Modify `src/scene/postfx.ts`: export the grade fragment shader and preserve `c.a` in `gl_FragColor`.
- Modify `src/scene/postfx.test.ts`: lock lower matte-prone defaults and shader alpha preservation.

## Task 1: Material Preset Contract

**Files:**
- Modify: `src/scene/aquascape.ts:186-268`
- Create: `src/scene/aquascape.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/scene/aquascape.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { aquariumMaterialPresets } from './aquascape';

describe('transparent water material presets', () => {
  it('keeps the water volume nearly transparent while preserving aquarium cues', () => {
    expect(aquariumMaterialPresets.glass.opacity).toBeCloseTo(0.035);
    expect(aquariumMaterialPresets.waterSurface.opacity).toBeCloseTo(0.075);
    expect(aquariumMaterialPresets.bubbles.opacity).toBeCloseTo(0.78);
  });

  it('keeps transparent materials physically glass-like', () => {
    expect(aquariumMaterialPresets.glass.transmission).toBeGreaterThanOrEqual(0.8);
    expect(aquariumMaterialPresets.waterSurface.transmission).toBeGreaterThanOrEqual(0.9);
    expect(aquariumMaterialPresets.bubbles.transmission).toBeGreaterThanOrEqual(0.9);
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npm run test -- src/scene/aquascape.test.ts
```

Expected: FAIL because `aquariumMaterialPresets` is not exported from `src/scene/aquascape.ts`.

- [ ] **Step 3: Add and use the material presets**

Add near the top of `src/scene/aquascape.ts`, after the tank dimension exports:

```ts
export const aquariumMaterialPresets = {
  glass: {
    opacity: 0.035,
    roughness: 0.04,
    metalness: 0.05,
    transmission: 0.82,
    ior: 1.5,
  },
  waterSurface: {
    opacity: 0.075,
    roughness: 0.04,
    metalness: 0.55,
    transmission: 0.94,
    ior: 1.33,
  },
  bubbles: {
    opacity: 0.78,
    roughness: 0.0,
    metalness: 0.08,
    transmission: 0.95,
    ior: 1.1,
  },
} as const;
```

Change the bubble material in `spawnBubbles()` to:

```ts
const bubbleMat = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: aquariumMaterialPresets.bubbles.opacity,
  roughness: aquariumMaterialPresets.bubbles.roughness,
  metalness: aquariumMaterialPresets.bubbles.metalness,
  transmission: aquariumMaterialPresets.bubbles.transmission,
  ior: aquariumMaterialPresets.bubbles.ior,
});
```

Change the glass material in `buildAquascape()` to:

```ts
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0xe0f7fa,
  transparent: true,
  opacity: aquariumMaterialPresets.glass.opacity,
  roughness: aquariumMaterialPresets.glass.roughness,
  metalness: aquariumMaterialPresets.glass.metalness,
  transmission: aquariumMaterialPresets.glass.transmission,
  ior: aquariumMaterialPresets.glass.ior,
  side: THREE.BackSide,
});
```

Change the water material in `buildAquascape()` to:

```ts
const waterMat = new THREE.MeshPhysicalMaterial({
  color: 0x9eefff,
  transparent: true,
  opacity: aquariumMaterialPresets.waterSurface.opacity,
  roughness: aquariumMaterialPresets.waterSurface.roughness,
  metalness: aquariumMaterialPresets.waterSurface.metalness,
  transmission: aquariumMaterialPresets.waterSurface.transmission,
  ior: aquariumMaterialPresets.waterSurface.ior,
  side: THREE.DoubleSide,
});
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run:

```bash
npm run test -- src/scene/aquascape.test.ts
```

Expected: PASS.

## Task 2: Transparent Renderer and Lighting Contract

**Files:**
- Modify: `src/main.ts:255-262`
- Modify: `src/scene/lighting.ts:43-69,187-210`
- Modify: `src/scene/lighting.test.ts`

- [ ] **Step 1: Write the failing lighting test**

Update `src/scene/lighting.test.ts` imports:

```ts
import { colors, targetLightSettingsForMode, transparentClearAlpha } from './lighting';
```

Update the second test body to assert transparent-friendly values:

```ts
it('조명 강도와 포그 밀도는 투명 데스크탑 어항의 선명도를 보존한다', () => {
  expect(transparentClearAlpha).toBe(0);
  expect(targetLightSettingsForMode('day')).toMatchObject({
    ambientIntensity: 1.12,
    dirIntensity: 1.18,
    topIntensity: 4.8,
    fogDensity: 0.018,
    causticIntensity: 0.62,
    clearAlpha: 0,
  });
  expect(targetLightSettingsForMode('dusk')).toMatchObject({
    ambientIntensity: 0.86,
    fogDensity: 0.024,
    clearAlpha: 0,
  });
  expect(targetLightSettingsForMode('night')).toMatchObject({
    ambientIntensity: 0.68,
    fogDensity: 0.03,
    clearAlpha: 0,
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npm run test -- src/scene/lighting.test.ts
```

Expected: FAIL because `transparentClearAlpha`, `clearAlpha`, and the new fog/caustic values do not exist yet.

- [ ] **Step 3: Implement transparent light settings**

In `src/scene/lighting.ts`, add after the `colors` export:

```ts
export const transparentClearAlpha = 0;
```

Extend `TargetLightSettings`:

```ts
clearAlpha: number;
```

Update `targetLightSettingsForMode()` return values:

```ts
fogDensity: mode === 'day' ? 0.018 : mode === 'dusk' ? 0.024 : 0.03,
causticIntensity: mode === 'day' ? 0.62 : mode === 'dusk' ? 0.42 : 0.4,
clearAlpha: transparentClearAlpha,
```

Update the clear color write in `Lighting.update()`:

```ts
const clear = renderer.getClearColor(new THREE.Color());
renderer.setClearColor(clear.lerp(t.bgColor, lerpSpeed), t.clearAlpha);
```

- [ ] **Step 4: Enable renderer alpha in the app entrypoint**

Update the import in `src/main.ts`:

```ts
import { Lighting, colors, transparentClearAlpha, type LightMode } from './scene/lighting';
```

Update renderer creation and initial clear:

```ts
const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
  powerPreference: 'high-performance',
});
```

```ts
renderer.setClearColor(colors.day.bg, transparentClearAlpha);
```

- [ ] **Step 5: Run the focused test to verify it passes**

Run:

```bash
npm run test -- src/scene/lighting.test.ts
```

Expected: PASS.

## Task 3: PostFX Alpha Preservation

**Files:**
- Modify: `src/scene/postfx.ts:18-83`
- Modify: `src/scene/postfx.test.ts`

- [ ] **Step 1: Write the failing postfx test**

Update `src/scene/postfx.test.ts` imports:

```ts
import { bloomDefaults, gradeDefaults, gradeFragmentShader, toneMappingExposure } from './postfx';
```

Update the first defaults test:

```ts
it('비네팅과 그레인은 투명 위젯 가장자리에 어두운 사각형을 만들지 않도록 낮게 유지한다', () => {
  expect(gradeDefaults).toEqual({
    vignette: 0.06,
    grain: 0.003,
    saturation: 1.08,
    warm: 0.0,
  });
});
```

Add this test:

```ts
it('grade shader는 렌더 타깃 alpha를 그대로 보존한다', () => {
  expect(gradeFragmentShader).toContain('gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a);');
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npm run test -- src/scene/postfx.test.ts
```

Expected: FAIL because the defaults still have the old values and `gradeFragmentShader` is not exported.

- [ ] **Step 3: Implement lower matte-prone defaults and exported shader**

Update `gradeDefaults` in `src/scene/postfx.ts`:

```ts
export const gradeDefaults = {
  vignette: 0.06,
  grain: 0.003,
  saturation: 1.08,
  warm: 0.0,
};
```

Replace the inline `fragmentShader` template with an exported constant:

```ts
export const gradeFragmentShader = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float uFrame;
  uniform float uVignette;
  uniform float uGrain;
  uniform float uSaturation;
  uniform float uWarm;
  varying vec2 vUv;

  void main() {
    vec4 c = texture2D(tDiffuse, vUv);

    float luma = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    c.rgb = mix(vec3(luma), c.rgb, uSaturation);

    c.r += uWarm;
    c.g += uWarm * 0.5;
    c.b -= uWarm * 0.7;

    vec2 q = vUv - 0.5;
    float vig = smoothstep(0.9, 0.25, length(q));
    c.rgb *= mix(1.0, vig, uVignette);

    float n = fract(sin(dot(vUv * 1024.0 + uFrame, vec2(12.9898, 78.233))) * 43758.5453);
    c.rgb += (n - 0.5) * uGrain;

    gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a);
  }
`;
```

Then set the shader object field:

```ts
fragmentShader: gradeFragmentShader,
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run:

```bash
npm run test -- src/scene/postfx.test.ts
```

Expected: PASS.

## Task 4: Full Verification and Visual Check

**Files:**
- No code changes unless verification reveals a defect in Tasks 1-3.

- [ ] **Step 1: Run the full unit test suite**

Run:

```bash
npm run test
```

Expected: PASS for all Vitest files.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS with no ESLint errors.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS and `dist/` updates locally only.

- [ ] **Step 4: Generate deterministic visual captures**

Run:

```bash
npm run capture
```

Expected: capture script completes and writes ignored images under `phases/0-mvp/captures/`.

- [ ] **Step 5: Inspect front/day capture for the B-direction look**

Open or inspect the generated `front_day` capture. Acceptance:

- The scene does not read as a solid blue-green rectangle.
- Fish, substrate, bubbles, caustics, glass edge, and surface cue are more prominent than the water tint.
- HUD and menu behavior are unchanged by these rendering edits.

## Self-Review

- Spec coverage: Task 1 covers layer-level water/glass/bubble transparency, Task 2 covers renderer alpha and fog/caustic atmosphere, Task 3 covers postprocessing alpha preservation, and Task 4 covers build plus visual verification.
- Deferred-text scan: No deferred implementation markers remain; every code change step includes concrete snippets and exact commands.
- Type consistency: `aquariumMaterialPresets`, `transparentClearAlpha`, `clearAlpha`, and `gradeFragmentShader` are introduced before subsequent tasks reference them.
