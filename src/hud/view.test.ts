import { describe, it, expect } from 'vitest';
import { deriveHudView, formatTokens } from './view';
import type { UsageSnapshot } from '../types/usage';

function snap(partial: Partial<UsageSnapshot>): UsageSnapshot {
  return {
    context_tokens: 0,
    context_limit: null,
    context_pct: null,
    cumulative_output_tokens: 0,
    model: 'claude-opus-4-7',
    ...partial,
  };
}

describe('deriveHudView', () => {
  it('null 스냅샷 → 데이터 없음', () => {
    const v = deriveHudView(null);
    expect(v.hasData).toBe(false);
    expect(v.contextLabel).toBe('—');
    expect(v.tokensLabel).toBe('—');
    expect(v.gaugeWidth).toBe(0);
  });

  it('model null 스냅샷 → 데이터 없음', () => {
    expect(deriveHudView(snap({ model: null })).hasData).toBe(false);
  });

  it('한도 있는 스냅샷 → %·게이지·토큰', () => {
    const v = deriveHudView(snap({ context_tokens: 216_000, context_limit: 1_000_000, context_pct: 21.6 }));
    expect(v.hasData).toBe(true);
    expect(v.contextLabel).toBe('21.6%');
    expect(v.gaugeWidth).toBeCloseTo(21.6);
    expect(v.tokensLabel).toBe('216,000');
  });

  it('한도 미상(pct null) → 토큰은 표시, 게이지/% 는 —', () => {
    const v = deriveHudView(snap({ context_tokens: 50_000, model: 'claude-haiku-4-5' }));
    expect(v.hasData).toBe(true);
    expect(v.contextLabel).toBe('—');
    expect(v.gaugeWidth).toBe(0);
    expect(v.tokensLabel).toBe('50,000');
  });

  it('pct > 100 은 게이지 100으로 클램프', () => {
    const v = deriveHudView(snap({ context_pct: 130, context_limit: 1_000_000 }));
    expect(v.gaugeWidth).toBe(100);
  });

  it('레벨: <75 normal, 75~<90 warn, >=90 critical (§6-3 임박 강조)', () => {
    expect(deriveHudView(snap({ context_pct: 50, context_limit: 1_000_000 })).level).toBe('normal');
    expect(deriveHudView(snap({ context_pct: 75, context_limit: 1_000_000 })).level).toBe('warn');
    expect(deriveHudView(snap({ context_pct: 89.9, context_limit: 1_000_000 })).level).toBe('warn');
    expect(deriveHudView(snap({ context_pct: 90, context_limit: 1_000_000 })).level).toBe('critical');
  });

  it('데이터 없음·한도 미상 → level normal', () => {
    expect(deriveHudView(null).level).toBe('normal');
    expect(deriveHudView(snap({ context_pct: null })).level).toBe('normal');
  });
});

describe('formatTokens', () => {
  it('천단위 구분', () => {
    expect(formatTokens(216_000)).toBe('216,000');
    expect(formatTokens(0)).toBe('0');
  });

  it('비정상 입력 → —', () => {
    expect(formatTokens(Number.NaN)).toBe('—');
    expect(formatTokens(-5)).toBe('—');
  });
});
