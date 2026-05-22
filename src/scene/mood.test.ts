import { describe, it, expect } from 'vitest';
import { usageMood } from './mood';

describe('usageMood (§6-2 사용량→어항 연동)', () => {
  it('한도 미상·비정상 → 평온(변화 없음)', () => {
    expect(usageMood(null)).toEqual({ fogDensityMul: 1, fishSpeedMul: 1 });
    expect(usageMood(Number.NaN)).toEqual({ fogDensityMul: 1, fishSpeedMul: 1 });
  });

  it('여유(<60) → 평온', () => {
    expect(usageMood(0)).toEqual({ fogDensityMul: 1, fishSpeedMul: 1 });
    expect(usageMood(59.9)).toEqual({ fogDensityMul: 1, fishSpeedMul: 1 });
  });

  it('점유율이 오를수록 포그↑·속도↓ (단조)', () => {
    const calm = usageMood(30);
    const warn = usageMood(70);
    const near = usageMood(85);
    const crit = usageMood(98);
    // 포그 밀도 배수는 단조 증가
    expect(warn.fogDensityMul).toBeGreaterThan(calm.fogDensityMul);
    expect(near.fogDensityMul).toBeGreaterThan(warn.fogDensityMul);
    expect(crit.fogDensityMul).toBeGreaterThan(near.fogDensityMul);
    // 물고기 속도 배수는 단조 감소
    expect(warn.fishSpeedMul).toBeLessThan(calm.fishSpeedMul);
    expect(near.fishSpeedMul).toBeLessThan(warn.fishSpeedMul);
    expect(crit.fishSpeedMul).toBeLessThan(near.fishSpeedMul);
  });

  it('경계값: 60·80·95 에서 단계 전환 (fog·speed 둘 다)', () => {
    expect(usageMood(60).fogDensityMul).toBeCloseTo(1.08);
    expect(usageMood(80).fogDensityMul).toBeCloseTo(1.18);
    expect(usageMood(95).fogDensityMul).toBeCloseTo(1.32);
    expect(usageMood(60).fishSpeedMul).toBeCloseTo(0.94);
    expect(usageMood(80).fishSpeedMul).toBeCloseTo(0.86);
    expect(usageMood(95).fishSpeedMul).toBeCloseTo(0.76);
  });
});
