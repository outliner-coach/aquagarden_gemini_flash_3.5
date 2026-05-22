use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle,
};

use crate::window::toggle_main_window;

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

    // 메뉴바 전용 단색 템플릿 아이콘(물고기 실루엣). 컬러 앱 아이콘을 메뉴바에 쓰면
    // 작게 줄었을 때 흐릿한 덩어리로 보여 못 찾는다 → 단색+알파 템플릿이 메뉴바에서 또렷.
    // icon_as_template(true)로 macOS 라이트/다크 메뉴바에 자동 적응시킨다.
    let tray_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray-template.png"))?;
    builder = builder.icon(tray_icon).icon_as_template(true);

    builder.build(app)?;
    Ok(())
}
