import { describe, it, expect } from 'vitest';
import { deriveFraming, MIN_DISTANCE, MAX_DISTANCE } from './framing';

// 미세 구도(기준 영역·여백)는 AESTHETIC 게이트가 본다. 여기서는 함수의 계약
// (유한·클램프·정사각이 가장 멀다·양끝 줌인·연속성·기질 하단 고정·폴백)만 단언한다.
// 거동: 정사각/가로 기본이 가장 줌아웃, 세로일수록·넓은 바일수록 줌인(비단조).

describe('deriveFraming', () => {
  it('모든 합당한 비율에서 유한하고 클램프 범위 안의 거리', () => {
    for (const a of [0.3, 0.44, 0.57, 1, 1.5, 2, 4, 8]) {
      const { distance } = deriveFraming(a);
      expect(Number.isFinite(distance)).toBe(true);
      expect(distance).toBeGreaterThanOrEqual(MIN_DISTANCE);
      expect(distance).toBeLessThanOrEqual(MAX_DISTANCE);
    }
  });

  it('정사각~중간 가로(a=1~1.8)는 기본 거리(가장 줌아웃)로 고정', () => {
    const d1 = deriveFraming(1.0).distance;
    const d15 = deriveFraming(1.5).distance;
    expect(d1).toBeCloseTo(MAX_DISTANCE, 5);
    expect(d15).toBeCloseTo(MAX_DISTANCE, 5);
  });

  it('세로(a<1)일수록 줌인 — 거리가 기본보다 가까워진다', () => {
    const d1 = deriveFraming(1.0).distance;
    const d057 = deriveFraming(0.57).distance;
    const d044 = deriveFraming(0.44).distance;
    expect(d057).toBeLessThan(d1);
    expect(d044).toBeLessThanOrEqual(d057);
  });

  it('넓은 바(큰 aspect)일수록 줌인 — 폭을 채우며 가까워진다', () => {
    const d15 = deriveFraming(1.5).distance;
    const d25 = deriveFraming(2.5).distance;
    const d4 = deriveFraming(4).distance;
    expect(d25).toBeLessThan(d15);
    expect(d4).toBeLessThan(d25);
  });

  it('전 구간 불연속 없음(작은 비율 변화 → 작은 거리 변화)', () => {
    let prev = deriveFraming(0.3).distance;
    for (let a = 0.35; a <= 6; a += 0.05) {
      const d = deriveFraming(a).distance;
      expect(Math.abs(d - prev)).toBeLessThan(1.0);
      prev = d;
    }
  });

  it('기질 하단 고정 — 가까울수록(줌인) 타깃이 낮아진다', () => {
    const tNormal = deriveFraming(1.5).targetY;
    const tWide = deriveFraming(4).targetY;
    const tTall = deriveFraming(0.44).targetY;
    expect(tWide).toBeLessThan(tNormal);
    expect(tTall).toBeLessThan(tNormal);
  });

  it('비정상 입력(0·음수·NaN)은 정사각(aspect=1)으로 폴백', () => {
    const base = deriveFraming(1);
    expect(deriveFraming(0).distance).toBeCloseTo(base.distance, 5);
    expect(deriveFraming(-2).distance).toBeCloseTo(base.distance, 5);
    expect(deriveFraming(Number.NaN).targetY).toBeCloseTo(base.targetY, 5);
  });
});
