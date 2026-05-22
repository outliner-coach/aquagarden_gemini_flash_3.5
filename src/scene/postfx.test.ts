import { describe, expect, it } from 'vitest';
import { bloomDefaults, gradeDefaults, toneMappingExposure } from './postfx';

describe('postfx clarity presets', () => {
  it('비네팅과 그레인은 물멍 화면을 흐리지 않도록 낮게 유지한다', () => {
    expect(gradeDefaults).toEqual({
      vignette: 0.15,
      grain: 0.006,
      saturation: 1.12,
      warm: 0.0,
    });
  });

  it('Bloom은 발광 요소만 은은하게 잡는 값으로 제한한다', () => {
    expect(bloomDefaults).toEqual({
      strength: 0.42,
      radius: 0.38,
      threshold: 1.05,
    });
    expect(toneMappingExposure).toBe(1.08);
  });
});
