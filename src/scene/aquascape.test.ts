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
