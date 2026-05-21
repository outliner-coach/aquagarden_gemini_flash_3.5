use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};

/// 트레이/메뉴바 아이콘을 1차 컨트롤 표면으로 구성한다 (ADR-005).
/// 메뉴: 표시/숨김 · 설정(placeholder) · 종료.
pub fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(app, "toggle", "표시 / 숨김", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "설정…", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &toggle,
            &PredefinedMenuItem::separator(app)?,
            &settings,
            &quit,
        ],
    )?;

    let mut builder = TrayIconBuilder::with_id("main")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "toggle" => toggle_main_window(app),
            "settings" => {
                // 설정 패널 진입은 후속 step에서 배선 (placeholder).
            }
            "quit" => app.exit(0),
            _ => {}
        });

    // 트레이 아이콘은 앱 기본 창 아이콘 재사용. macOS 메뉴바는 템플릿 모드 권장.
    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon).icon_as_template(true);
    }

    builder.build(app)?;
    Ok(())
}

fn toggle_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(true) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}
