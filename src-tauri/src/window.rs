use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, LogicalSize, Manager, PhysicalSize, State, Window};
use tauri_runtime::ResizeDirection;

// 창 제어는 전부 Rust 에 둔다 — 웹뷰는 OS 창을 직접 만지지 않는다 (CLAUDE.md).
// 이동/리사이즈/접기(퍽)/투과모드(호버홀)를 command 로 노출한다.

#[derive(Default)]
struct Hole {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

/// 투과모드·접기 상태. 투과모드는 창 전체 클릭 통과 + ⋯ 버튼 영역(hole)만 예외(호버홀).
#[derive(Default)]
pub struct WindowState {
    passthrough: AtomicBool,
    hole: Mutex<Hole>,
    saved_size: Mutex<Option<PhysicalSize<u32>>>,
}

fn parse_direction(s: &str) -> Option<ResizeDirection> {
    Some(match s {
        "north" => ResizeDirection::North,
        "south" => ResizeDirection::South,
        "east" => ResizeDirection::East,
        "west" => ResizeDirection::West,
        "north_east" => ResizeDirection::NorthEast,
        "north_west" => ResizeDirection::NorthWest,
        "south_east" => ResizeDirection::SouthEast,
        "south_west" => ResizeDirection::SouthWest,
        _ => return None,
    })
}

/// 좌클릭 드래그로 창을 이동(프레임리스 위젯). 웹뷰가 드래그 임계 초과 시 호출한다.
#[tauri::command]
pub fn start_window_drag(window: Window) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

/// 가장자리/모서리 그립에서 네이티브 리사이즈를 시작한다.
#[tauri::command]
pub fn start_window_resize(window: Window, direction: String) -> Result<(), String> {
    let dir = parse_direction(&direction).ok_or_else(|| format!("unknown direction: {direction}"))?;
    window.start_resize_dragging(dir).map_err(|e| e.to_string())
}

/// 앱 종료 — 인윈도우 메뉴 "종료"용. 트레이·⌘⌥Q 와 동일 경로.
#[tauri::command]
pub fn quit_app(app: AppHandle) {
    app.exit(0);
}

/// 메인 창 표시/숨김 토글 — 트레이 메뉴와 ⌘⌥A 단축키가 공유하는 하드 토글(탈출구).
pub fn toggle_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(true) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

/// "잠깐 숨기기" — 창을 작은 ⋯ 퍽으로 접는다. 현재 크기를 저장해 복귀 시 되돌린다.
#[tauri::command]
pub fn collapse_window(window: Window, state: State<WindowState>) -> Result<(), String> {
    let size = window.inner_size().map_err(|e| e.to_string())?;
    *state.saved_size.lock().unwrap() = Some(size);
    window
        .set_size(LogicalSize::new(64.0, 64.0))
        .map_err(|e| e.to_string())
}

/// 접힌 ⋯ 퍽을 눌러 어항 크기로 복귀한다.
#[tauri::command]
pub fn restore_window(window: Window, state: State<WindowState>) -> Result<(), String> {
    let saved = state.saved_size.lock().unwrap().take();
    match saved {
        Some(size) => window.set_size(size).map_err(|e| e.to_string()),
        None => window
            .set_size(LogicalSize::new(480.0, 320.0))
            .map_err(|e| e.to_string()),
    }
}

/// 투과모드 토글. 켜면 호버홀 워처가 ⋯ 영역 밖에서 클릭을 통과시킨다.
/// 끄면 즉시 입력 수신으로 복귀한다.
#[tauri::command]
pub fn set_passthrough(window: Window, state: State<WindowState>, enabled: bool) -> Result<(), String> {
    state.passthrough.store(enabled, Ordering::Relaxed);
    if !enabled {
        window
            .set_ignore_cursor_events(false)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// ⋯ 버튼의 창 내부 논리좌표 사각형(호버홀)을 갱신한다. 투과모드에서 이 영역만 클릭 가능.
#[tauri::command]
pub fn update_passthrough_hole(state: State<WindowState>, x: f64, y: f64, w: f64, h: f64) {
    let mut hole = state.hole.lock().unwrap();
    hole.x = x;
    hole.y = y;
    hole.w = w;
    hole.h = h;
}

/// 호버홀 워처 — 투과모드일 때 전역 커서 위치를 폴링해, ⋯ 영역 밖이면 클릭 통과(ignore),
/// ⋯ 위면 입력 수신으로 토글한다. 값이 바뀔 때만 set_ignore_cursor_events 호출.
pub fn spawn_passthrough_watcher(app: AppHandle) {
    std::thread::spawn(move || {
        let mut last_ignore: Option<bool> = None;
        loop {
            std::thread::sleep(Duration::from_millis(80));
            let state = app.state::<WindowState>();
            if !state.passthrough.load(Ordering::Relaxed) {
                last_ignore = None;
                continue;
            }
            let Some(window) = app.get_webview_window("main") else {
                continue;
            };
            let (Ok(cursor), Ok(pos), Ok(sf)) = (
                app.cursor_position(),
                window.outer_position(),
                window.scale_factor(),
            ) else {
                continue;
            };
            let (hx, hy, hw, hh) = {
                let h = state.hole.lock().unwrap();
                (
                    pos.x as f64 + h.x * sf,
                    pos.y as f64 + h.y * sf,
                    h.w * sf,
                    h.h * sf,
                )
            };
            let inside =
                cursor.x >= hx && cursor.x <= hx + hw && cursor.y >= hy && cursor.y <= hy + hh;
            let ignore = !inside;
            if last_ignore != Some(ignore) {
                let _ = window.set_ignore_cursor_events(ignore);
                last_ignore = Some(ignore);
            }
        }
    });
}
