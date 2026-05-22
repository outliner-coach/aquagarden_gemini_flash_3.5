import { invoke } from '@tauri-apps/api/core';

// 창 제어는 전부 Rust(window.rs) command를 통한다 — 웹뷰는 OS 창을 직접 만지지 않는다 (CLAUDE.md).
// 비-Tauri 환경(브라우저 캡처/스모크)에서는 invoke 가 실패하므로 전부 graceful 무시.

async function safeInvoke(cmd: string, args?: Record<string, unknown>): Promise<void> {
  try {
    await invoke(cmd, args);
  } catch {
    /* 비-Tauri 환경: 무시 — 어항은 멈추지 않는다 */
  }
}

/** 좌클릭 드래그로 창 이동 시작(프레임리스 위젯). 드래그 임계 초과 시 1회 호출. */
export function startWindowDrag(): Promise<void> {
  return safeInvoke('start_window_drag');
}

export type ResizeDir =
  | 'north'
  | 'south'
  | 'east'
  | 'west'
  | 'north_east'
  | 'north_west'
  | 'south_east'
  | 'south_west';

/** 가장자리/모서리 그립에서 네이티브 리사이즈 시작. */
export function startWindowResize(direction: ResizeDir): Promise<void> {
  return safeInvoke('start_window_resize', { direction });
}

/** "잠깐 숨기기" — 창을 작은 ⋯ 퍽으로 접는다(현재 크기는 Rust가 저장). */
export function collapseWindow(): Promise<void> {
  return safeInvoke('collapse_window');
}

/** 접힌 퍽에서 어항 크기로 복귀. */
export function restoreWindow(): Promise<void> {
  return safeInvoke('restore_window');
}

/** 앱 종료 — 트레이·⌘⌥Q 와 동일 경로. */
export function quitApp(): Promise<void> {
  return safeInvoke('quit_app');
}

/** 투과모드 토글. 켜면 ⋯ 영역(호버홀) 밖에서 클릭이 통과한다. */
export function setPassthrough(enabled: boolean): Promise<void> {
  return safeInvoke('set_passthrough', { enabled });
}

/** ⋯ 버튼의 창 내부 논리좌표 사각형(호버홀)을 Rust에 알린다. */
export function updatePassthroughHole(x: number, y: number, w: number, h: number): Promise<void> {
  return safeInvoke('update_passthrough_hole', { x, y, w, h });
}
