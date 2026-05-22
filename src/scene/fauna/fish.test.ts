import { describe, expect, it } from 'vitest';
import { fishMotionProfiles, turnSlowdownForDot } from './fish';

describe('fish motion profiles', () => {
  it('물멍용 종별 속도·관성·꼬리 템포를 고정한다', () => {
    expect(fishMotionProfiles.betta).toEqual({
      baseSpeed: 0.8,
      steeringLerp: 0.055,
      turnLerp: 0.035,
      tailFreq: 3.4,
      tailAmp: 0.34,
    });
    expect(fishMotionProfiles.tetra).toEqual({
      baseSpeed: 2.0,
      steeringLerp: 0.07,
      turnLerp: 0.045,
      tailFreq: 8.5,
      tailAmp: 0.22,
    });
    expect(fishMotionProfiles.corydoras).toEqual({
      baseSpeed: 1.2,
      steeringLerp: 0.06,
      turnLerp: 0.04,
      tailFreq: 6.5,
      tailAmp: 0.2,
    });
  });

  it('큰 방향 전환일수록 최대 32%까지 순항 속도를 낮춘다', () => {
    expect(turnSlowdownForDot(1)).toBeCloseTo(1);
    expect(turnSlowdownForDot(0)).toBeCloseTo(0.84);
    expect(turnSlowdownForDot(-1)).toBeCloseTo(0.68);
  });
});
