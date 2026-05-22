use serde_json::json;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{
    AppHandle, LogicalSize, Manager, Monitor, PhysicalPosition, PhysicalSize, State, WebviewWindow,
    Window,
};
use tauri_plugin_store::StoreExt;
use tauri_runtime::ResizeDirection;

const POS_STORE_FILE: &str = "settings.json";
const POS_KEY: &str = "window-position";
const EDGE_MARGIN: f64 = 24.0; // 우하단 안전영역 여백(논리px, 모니터 배율로 환산)

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
    last_pos_save: Mutex<Option<Instant>>, // 위치 영속화 스로틀(드래그 중 과다 디스크 쓰기 방지)
    last_pos: Mutex<Option<(i32, i32)>>,   // 최신 창 좌표(트레일링 저장용 — 드래그 끝/포커스 상실 시 flush)
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

/// 좌상단 점이 어느 모니터 사각형 안에 있는지 — 위젯이 화면 안에서 잡히는지의 판정.
fn point_in_any_monitor(monitors: &[Monitor], x: i32, y: i32) -> bool {
    monitors.iter().any(|m| {
        let p = m.position();
        let s = m.size();
        x >= p.x && x < p.x + s.width as i32 && y >= p.y && y < p.y + s.height as i32
    })
}

/// 주 모니터(없으면 첫 모니터) 우하단 안전 영역 좌표 — 화면 밖으로 사라진 위젯의 회수 지점.
fn primary_safe_position(window: &WebviewWindow) -> Option<PhysicalPosition<i32>> {
    let mon = window
        .primary_monitor()
        .ok()
        .flatten()
        .or_else(|| window.available_monitors().ok().and_then(|m| m.into_iter().next()))?;
    let mp = mon.position();
    let ms = mon.size();
    let win = window.outer_size().ok()?;
    let margin = (EDGE_MARGIN * mon.scale_factor()) as i32;
    let x = (mp.x + ms.width as i32 - win.width as i32 - margin).max(mp.x);
    let y = (mp.y + ms.height as i32 - win.height as i32 - margin).max(mp.y);
    Some(PhysicalPosition::new(x, y))
}

/// 저장된 창 위치를 복원하되, 어느 모니터 안에도 없으면(모니터 분리 등) 주 모니터
/// 우하단 안전 영역으로 강제 재배치한다(§4-4 — 화면 밖으로 사라진 위젯 유실 방지).
/// 저장값 부재·읽기 실패는 graceful — 현재 위치를 검증만 한다(어항은 멈추지 않는다).
pub fn restore_window_position(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let saved: Option<PhysicalPosition<i32>> = app
        .store(POS_STORE_FILE)
        .ok()
        .and_then(|s| s.get(POS_KEY))
        .and_then(|v| {
            // try_from 으로 손상된 설정값의 wraparound 차단(Codex 리뷰).
            let x = i32::try_from(v.get("x")?.as_i64()?).ok()?;
            let y = i32::try_from(v.get("y")?.as_i64()?).ok()?;
            Some(PhysicalPosition::new(x, y))
        });
    let monitors = window.available_monitors().unwrap_or_default();
    let candidate = saved.or_else(|| window.outer_position().ok());

    if let Some(pos) = candidate {
        if point_in_any_monitor(&monitors, pos.x, pos.y) {
            let _ = window.set_position(pos);
            return;
        }
    }
    if let Some(safe) = primary_safe_position(&window) {
        let _ = window.set_position(safe);
    }
}

/// 창 이동 시 위치를 영속화한다(스로틀: 드래그 중 과다 디스크 쓰기 방지). 다음 세션 복원에 쓴다.
/// 최신 좌표는 항상 메모리에 보관해, 스로틀로 마지막 이동이 누락돼도 flush 로 보강한다(Codex 리뷰).
pub fn persist_window_position(app: &AppHandle, x: i32, y: i32) {
    let state = app.state::<WindowState>();
    if let Ok(mut p) = state.last_pos.lock() {
        *p = Some((x, y));
    }
    {
        let Ok(mut last) = state.last_pos_save.lock() else {
            return;
        };
        if last.is_some_and(|t| t.elapsed() < Duration::from_millis(400)) {
            return;
        }
        *last = Some(Instant::now());
    }
    write_position(app, x, y);
}

/// 드래그 종료·포커스 상실·종료 시 마지막 좌표를 강제 저장 — leading-only 스로틀의 트레일링 보완.
pub fn flush_window_position(app: &AppHandle) {
    let last = app
        .state::<WindowState>()
        .last_pos
        .lock()
        .ok()
        .and_then(|p| *p);
    if let Some((x, y)) = last {
        write_position(app, x, y);
    }
}

fn write_position(app: &AppHandle, x: i32, y: i32) {
    if let Ok(store) = app.store(POS_STORE_FILE) {
        store.set(POS_KEY, json!({ "x": x, "y": y }));
        let _ = store.save();
    }
}
