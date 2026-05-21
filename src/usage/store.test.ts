import { describe, it, expect, vi } from 'vitest';
import { createUsageStore } from './store';
import type { UsageSnapshot } from '../types/usage';

const ready: UsageSnapshot = {
  context_tokens: 216_000,
  context_limit: 1_000_000,
  context_pct: 21.6,
  cumulative_output_tokens: 5_000,
  model: 'claude-opus-4-7',
};

const noData: UsageSnapshot = {
  context_tokens: 0,
  context_limit: null,
  context_pct: null,
  cumulative_output_tokens: 0,
  model: null,
};

describe('UsageStore', () => {
  it('초기 스냅샷은 null(데이터 없음)', () => {
    expect(createUsageStore().snapshot).toBeNull();
  });

  it('setSnapshot이 상태를 갱신하고 구독자에 알린다', () => {
    const store = createUsageStore();
    const fn = vi.fn();
    store.subscribe(fn);

    store.setSnapshot(ready);

    expect(store.snapshot).toEqual(ready);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('빈 스냅샷(model null) 수신 시 데이터 없음으로 전이', () => {
    const store = createUsageStore();
    store.setSnapshot(ready);

    store.setSnapshot(noData);

    expect(store.snapshot?.model).toBeNull();
  });

  it('구독 해제 후에는 알림이 오지 않는다', () => {
    const store = createUsageStore();
    const fn = vi.fn();
    const off = store.subscribe(fn);

    off();
    store.setSnapshot(ready);

    expect(fn).not.toHaveBeenCalled();
  });
});
