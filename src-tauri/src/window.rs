use tauri::Window;

/// 클릭 통과(mouse passthrough) 토글.
/// 창 제어는 Rust에만 둔다 (CLAUDE.md). 기본값은 입력 수신 — 시작 시 호출하지 않는다 (ADR-006).
#[tauri::command]
pub fn set_click_through(window: Window, enabled: bool) -> Result<(), String> {
    window
        .set_ignore_cursor_events(enabled)
        .map_err(|e| e.to_string())
}
