import { invoke } from '@tauri-apps/api/core';

// 창 제어는 전부 Rust(window.rs) command를 통한다 — 웹뷰는 OS 창을 직접 만지지 않는다 (CLAUDE.md).

/**
 * 클릭 통과(mouse passthrough) 토글.
 * 기본값은 입력 수신(enabled=false) — 일할 때만 통과로 바꾸는 모델 (ADR-006).
 */
export async function setClickThrough(enabled: boolean): Promise<void> {
  await invoke('set_click_through', { enabled });
}
