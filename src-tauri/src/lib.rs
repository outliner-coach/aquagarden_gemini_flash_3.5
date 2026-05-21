mod tray;
mod window;

// Aquagarden 데스크톱 셸 부트스트랩.
// 창 설정(투명·always-on-top·프레임리스)은 tauri.conf.json 단일 소스에 있고,
// 여기서는 macOS Dock 숨김·트레이·클릭통과 command만 배선한다.
pub fn run() {
    tauri::Builder::default()
        // 설정 영속화 — 앱 config 디렉토리로 범위 한정 (ADR-008).
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![window::set_click_through])
        .setup(|app| {
            // macOS: skipTaskbar 미지원 → Accessory 정책으로 Dock에서 숨긴다 (spike-tauri.md).
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // 프레임리스·무크롬 창의 1차 컨트롤 표면 (ADR-005).
            tray::create_tray(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running aquagarden");
}
