import { describe, expect, it } from 'vitest';
import { bloomDefaults, gradeDefaults, gradeFragmentShader, toneMappingExposure } from './postfx';

describe('postfx clarity presets', () => {
  it('비네팅과 그레인은 투명 위젯 가장자리에 어두운 사각형을 만들지 않도록 낮게 유지한다', () => {
    expect(gradeDefaults).toEqual({
      vignette: 0.06,
      grain: 0.003,
      saturation: 1.08,
      warm: 0.0,
    });
  });

  it('grade shader는 렌더 타깃 alpha를 그대로 보존한다', () => {
    expect(gradeFragmentShader).toContain('gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a);');
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
