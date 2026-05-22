# Spike B — Tauri v2 능력 확인 (문서 검증, throwaway)

출처: Tauri v2 공식 문서 (context7 `/websites/v2_tauri_app`). macOS 1차 타깃 기준.

## 능력별 확인 결과

| 능력 | 지원 | 근거 |
|------|------|------|
| 투명 창 `transparent: true` | **지원됨** | `Definitions > AppConfig`의 `transparent` 설정 존재. **단 macOS는 `macOSPrivateApi: true`(= `macos-private-api` feature) 필수.** private API 사용 → App Store 등록 불가(우리는 로컬 수동 배포라 무관, ADR-008). |
| `alwaysOnTop` | **지원됨** | config `alwaysOnTop` + 런타임 `setAlwaysOnTop(boolean)` (`@tauri-apps/api/window`). |
| `decorations: false` | **지원됨** | `window-customization` 문서: `"windows": [{ "decorations": false }]` → 네이티브 타이틀바/테두리 제거. |
| `skipTaskbar` | **macOS 미지원(주의)** | `setSkipTaskbar` 문서에 "macOS: Unsupported" 명시. → **대안**: macOS에서 Dock 숨김은 `ActivationPolicy::Accessory`(`app.set_activation_policy`)로 main.rs에서 처리. config `skipTaskbar`는 Win/Linux용으로만 두고, macOS는 Accessory 정책 사용. |
| 클릭 통과 `setIgnoreCursorEvents` | **지원됨** | `setIgnoreCursorEvents(ignore: boolean)` (`@tauri-apps/api/window`). ADR-006 토글의 기반 API. |
| 트레이/메뉴바 `tray-icon` | **지원됨** | `tauri::tray::TrayIconBuilder::new().build(app)?`. 아이콘 사용 시 Cargo feature `image-png`/`image-ico` 필요. macOS 메뉴바는 `iconAsTemplate: true` 권장. `menu`로 Submenu/Menu 연결(표시·숨김·종료·설정 — ADR-005). |
| `tauri-plugin-store` | **지원됨** | `@tauri-apps/plugin-store`의 `load(path, {autoSave})` → `set/get/save`. graceful exit 또는 debounce(기본 100ms) 자동 저장. ADR-008의 "설정 쓰기는 앱 config 디렉토리만"에 부합. |

→ 4개 핵심 능력(투명·alwaysOnTop·decorations·skipTaskbar) + 클릭통과 + 트레이 + store 전부 macOS에서 사용 가능. **단 두 가지 보정**: ①transparent는 `macOSPrivateApi: true` 필요 ②`skipTaskbar`는 macOS 미지원 → Dock 숨김은 ActivationPolicy로 대체.

## step1용 `tauri.conf.json` 창 블록 초안 (스캐폴드 아님 — 참고 초안)

```jsonc
{
  "app": {
    "macOSPrivateApi": true,            // transparent 활성화에 필수
    "windows": [
      {
        "label": "main",
        "transparent": true,
        "alwaysOnTop": true,
        "decorations": false,
        "skipTaskbar": true,            // Win/Linux용 (macOS는 무시됨 → 아래 Accessory 정책으로 보완)
        "resizable": true,
        "shadow": false,
        "width": 480,
        "height": 320
      }
    ],
    "security": {
      "csp": "default-src 'self'; connect-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'"
      // ADR-008: connect-src 'none' (원격 송신 차단), 모든 자산 번들
    }
  }
}
```

보완 (main.rs, step1 메모):
- macOS Dock 숨김: `#[cfg(target_os = "macos")] app.set_activation_policy(tauri::ActivationPolicy::Accessory);`
- transparent feature: `Cargo.toml`의 tauri features에 `macos-private-api` 추가.
- 트레이 아이콘: tauri features에 `image-png` (또는 `tray-icon`) 추가.
- store: `tauri-plugin-store` 의존성 + 플러그인 등록.
