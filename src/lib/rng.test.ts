import { describe, it, expect } from 'vitest';
import { random, seedRng } from './rng';

function sequence(seed: number, n: number): number[] {
  seedRng(seed);
  return Array.from({ length: n }, () => random());
}

describe('rng', () => {
  it('동일 시드는 동일 시퀀스를 낸다 (결정론)', () => {
    expect(sequence(1337, 16)).toEqual(sequence(1337, 16));
  });

  it('다른 시드는 다른 시퀀스를 낸다', () => {
    expect(sequence(1337, 16)).not.toEqual(sequence(42, 16));
  });

  it('출력은 [0, 1) 범위', () => {
    seedRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = random();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('시드 0도 멈추지 않고 진행한다', () => {
    expect(sequence(0, 8)).toEqual(sequence(0, 8));
    expect(new Set(sequence(0, 8)).size).toBeGreaterThan(1);
  });
});
