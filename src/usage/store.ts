import type { UsageSnapshot } from '../types/usage';

// 사용량 반응 스토어 + Rust IPC 구독 클라이언트.
// FS 접근은 하지 않는다 — 유일한 입력원은 Rust(usage.rs)의 이벤트다 (CLAUDE.md, ADR-002).

/** 프론트가 구독하는 사용량 이벤트 이름(Rust `USAGE_EVENT`와 일치). */
export const USAGE_EVENT = 'usage://snapshot';

/**
 * 경량 반응 스토어. UI 프레임워크 없이 EventTarget 기반으로 구현한다 (ADR-004).
 * 구독자는 `change` 시점에 `snapshot`을 다시 읽어 렌더한다.
 */
export class UsageStore extends EventTarget {
  private current: UsageSnapshot | null = null;

  /** 최신 스냅샷. 아직 이벤트를 못 받았으면 null( = 데이터 없음). */
  get snapshot(): UsageSnapshot | null {
    return this.current;
  }

  /** 새 스냅샷을 반영하고 구독자에게 변경을 알린다. */
  setSnapshot(snapshot: UsageSnapshot): void {
    this.current = snapshot;
    this.dispatchEvent(new Event('change'));
  }

  /** 변경 구독. 해제 함수를 반환한다. */
  subscribe(listener: () => void): () => void {
    this.addEventListener('change', listener);
    return () => this.removeEventListener('change', listener);
  }
}

export function createUsageStore(): UsageStore {
  return new UsageStore();
}

/**
 * Tauri 이벤트를 구독해 스토어에 흘려보낸다. 구독 해제 함수를 반환한다.
 *
 * Tauri 런타임이 없으면(브라우저 미리보기·결정론적 캡처) 조용히 null을 반환한다 —
 * 사용량 읽기 실패는 어항을 멈추지 않는다 (ADR-009). tauri API는 동적 import 하여
 * 비-Tauri 환경의 모듈 로드/테스트에 영향을 주지 않는다.
 */
export async function startUsageSubscription(store: UsageStore): Promise<(() => void) | null> {
  try {
    const { listen } = await import('@tauri-apps/api/event');
    return await listen<UsageSnapshot>(USAGE_EVENT, (event) => {
      store.setSnapshot(event.payload);
    });
  } catch {
    return null;
  }
}
