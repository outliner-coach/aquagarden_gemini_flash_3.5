// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { mountHud } from './index';
import { createUsageStore } from '../usage/store';
import type { UsageSnapshot } from '../types/usage';

// mountHud의 DOM 렌더(레벨별 바 색상·임박 강조) 회귀 테스트(§6-3, Codex 리뷰 제안).
// 순수 파생은 view.test.ts, 여기서는 클래스 토글 전환을 단언한다.

function snap(pct: number | null): UsageSnapshot {
  return {
    context_tokens: 1,
    context_limit: 1_000_000,
    context_pct: pct,
    cumulative_output_tokens: 0,
    model: 'claude-opus-4-7',
  };
}

function el(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

describe('mountHud 렌더(DOM)', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="hud-overlay" class="hud-faint">
        <span id="hud-context-pct"></span>
        <div id="hud-context-bar" class="bg-emerald-500"></div>
        <span id="hud-tokens"></span>
      </div>`;
  });

  it('레벨에 따라 바 색상 토글 + 잔존 색 제거', () => {
    const store = createUsageStore();
    mountHud(store);
    const bar = el('hud-context-bar');

    store.setSnapshot(snap(80)); // warn
    expect(bar.classList.contains('bg-amber-400')).toBe(true);
    expect(bar.classList.contains('bg-emerald-500')).toBe(false);

    store.setSnapshot(snap(95)); // critical
    expect(bar.classList.contains('bg-red-500')).toBe(true);
    expect(bar.classList.contains('bg-amber-400')).toBe(false);

    store.setSnapshot(snap(40)); // normal — 잔존 레드 제거
    expect(bar.classList.contains('bg-emerald-500')).toBe(true);
    expect(bar.classList.contains('bg-red-500')).toBe(false);
  });

  it('critical 시 hud-alert 강조, 벗어나면 해제', () => {
    const store = createUsageStore();
    mountHud(store);
    const overlay = el('hud-overlay');

    store.setSnapshot(snap(95));
    expect(overlay.classList.contains('hud-alert')).toBe(true);

    store.setSnapshot(snap(50));
    expect(overlay.classList.contains('hud-alert')).toBe(false);
  });

  it('데이터 없음/한도 미상 → 강조 없음, 게이지 0', () => {
    const store = createUsageStore();
    mountHud(store);
    store.setSnapshot(snap(null)); // 한도 미상
    expect(el('hud-overlay').classList.contains('hud-alert')).toBe(false);
    expect((el('hud-context-bar') as HTMLElement).style.width).toBe('0%');
  });
});
