mod tray;
pub mod usage;
mod window;

// Aquagarden 데스크톱 셸 부트스트랩.
// 창 설정(투명·always-on-top·프레임리스)은 tauri.conf.json 단일 소스에 있고,
// 여기서는 macOS Dock 숨김·트레이·클릭통과 command만 배선한다.
pub fn run() {
    use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

    tauri::Builder::default()
        // 설정 영속화 — 앱 config 디렉토리로 범위 한정 (ADR-008).
        .plugin(tauri_plugin_store::Builder::new().build())
        // 전역 종료 단축키 기반 플러그인.
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![window::set_click_through])
        .setup(|app| {
            // macOS: skipTaskbar 미지원 → Accessory 정책으로 Dock에서 숨긴다 (spike-tauri.md).
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // 프레임리스·무크롬 창의 1차 컨트롤 표면 (ADR-005).
            tray::create_tray(app.handle())?;

            // 전역 종료 단축키 ⌘⌥Q — 메뉴바 아이콘을 못 찾아도 확실히 종료할 수 있는
            // 탈출구. Dock·창 닫기 버튼이 없는 프레임리스 위젯의 안전장치.
            // (Shift+Q=로그아웃, Ctrl+Cmd+Q=화면잠금과 충돌하지 않게 Cmd+Opt+Q 선택.)
            let quit_shortcut = Shortcut::new(Some(Modifiers::SUPER | Modifiers::ALT), Code::KeyQ);
            app.global_shortcut()
                .on_shortcut(quit_shortcut, move |app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        app.exit(0);
                    }
                })?;

            // 현재 세션 사용량을 주기적으로 읽어 프론트에 숫자로만 emit (ADR-002).
            // FS 접근·파싱은 전부 Rust 안에서, 실패해도 어항은 멈추지 않는다 (ADR-009).
            usage::start_usage_polling(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running aquagarden");
}
