# Step 1: tauri-vite-setup

데스크톱 위젯의 뼈대를 만든다. **스캐폴드와 창 정체성·보안 설정까지만**. 어항/사용량 기능은 다음 step.

## 읽어야 할 파일

- `/CLAUDE.md` (기술 스택, CRITICAL 규칙 전부)
- `/docs/ARCHITECTURE.md` (디렉토리 구조)
- `/docs/ADR.md` (ADR-001 Tauri, 003 CDN→npm, 005 트레이, 006 클릭통과, 008 보안)
- `phases/0-mvp/spike-tauri.md` (step0이 적은 창 설정 초안)

## 작업

Tauri v2 + Vite + TypeScript(strict) 프로젝트를 구성한다.
- 프론트: Vite + TS strict. Tailwind는 **npm + PostCSS**(CDN 금지). ESLint + Vitest 설정.
- `src-tauri/`: Rust 셸. `tauri.conf.json` 창 설정 — `transparent: true`, `alwaysOnTop: true`, `decorations: false`, `skipTaskbar: true`, 투명 배경.
- **CSP**: `connect-src 'none'`, `default-src 'self'`, script/style/img `'self'`. 원격 출처 금지.
- **자동 업데이트 비활성화**(updater 미설정/OFF).
- **트레이 아이콘**(`tray.rs`): 메뉴 — 표시/숨김, 설정(placeholder), 종료.
- **클릭 통과 토글**(`window.rs`): `setIgnoreCursorEvents` 래핑한 Tauri command + 프론트 `src/window/` 래퍼. 기본값은 입력 수신(ADR-006).
- **설정 영속화 기반**: `tauri-plugin-store` 도입, 앱 config 디렉토리로 범위 한정. `src/settings/` 래퍼 스텁.
- `package.json` 스크립트: `dev`(tauri dev), `build`(vite build), `lint`(eslint), `test`(vitest).

## Acceptance Criteria

```bash
npm run lint && npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```
- `npm run dev`(tauri dev) 시 투명·always-on-top·무프레임 창 + 트레이 아이콘이 뜬다(수동 확인).

## 검증 절차

1. 위 AC 커맨드 통과.
2. 아키텍처 체크: 디렉토리 구조가 ARCHITECTURE.md를 따르는가, CSP `connect-src 'none'`인가, capabilities에 불필요 권한이 없는가.
3. 결과를 `phases/0-mvp/index.json` step 1에 반영(성공 → completed + summary, 실패 → 위 규칙).

## 금지사항

- 기능 구현(어항 렌더·사용량·HUD) 금지. 이 step은 스캐폴드 + 창/트레이/클릭통과/설정 기반만. 이유: scope 최소화.
- CDN `<script>`/`<link>` 사용 금지. 모든 의존성 npm. 이유: ADR-003.
- 광범위 FS 권한·http·shell capability 추가 금지. 이유: 최소 권한(ADR-008). (FS 읽기 권한은 step5에서 `~/.claude/**`로 한정 추가.)
