import { describe, expect, it } from 'vitest';
import { colors, targetLightSettingsForMode, transparentClearAlpha } from './lighting';

describe('lighting clarity presets', () => {
  it('day 팔레트는 밝기보다 맑은 청록 분리감을 우선한다', () => {
    expect(colors.day).toEqual({
      ambient: 0xd8eaff,
      dirLight: 0xffffff,
      topLight: 0xf8ffff,
      fog: 0x173940,
      bg: 0x07181d,
    });
  });

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
});
