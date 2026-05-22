// 프로덕션 빌드에서 Windows 콘솔 창 숨김 (macOS/Linux 무영향).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    aquagarden_lib::run();
}
