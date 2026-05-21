# PROGRESS — Aquagarden

## 2026-05-22 — v1(0-mvp) 하네스 구현 + 실기 QA 픽스

### 한 일
- **하네스 프레임워크 설치·문서 작성**: `jha0313/harness_framework`를 클론해 현재 프로젝트에 통합(`.claude/`, `scripts/execute.py`, `docs/`). 요구사항(`requirement.md`: 토큰/컨텍스트 표시 + 상시 관상 위젯 + 인터랙션 + 수중생물)을 반영해 가드레일 문서를 채움 — `CLAUDE.md`(6 CRITICAL), `docs/PRD.md`·`ARCHITECTURE.md`·`ADR.md`(ADR-001~012)·`UI_GUIDE.md`·`AESTHETIC.md`(미학 루브릭+이중 게이트).
- **v1 phase `0-mvp` 실행 완료** (`python3 scripts/execute.py 0-mvp`, 브랜치 `feat-0-mvp`): step0 spikes(검증) → 1 tauri-vite-setup → 2 scene-port → 3 visual-harness → 4 visual-polish → 5 usage-core-basic → 6 hud-basic. 모두 completed, 빌드/테스트 그린(프론트 15 테스트, Rust 7 골든픽스처). 결과물: Tauri v2 투명·always-on-top 위젯 + Three.js 시네마틱 어항 + 로컬 세션 컨텍스트%·토큰 HUD.
- **검증 게이트 작동**: step0(스파이크)·step4(visual-polish)에서 `blocked`로 멈춰 사용자 확인. step0 컨텍스트% 계산이 실제 CC `/usage`(22%)와 일치 확인. step4는 1라운드 미달(코스틱·Bloom·무드) → 보강 피드백 후 2라운드 통과·사인오프.
- **실기 QA 픽스 4건**(브랜치 `feat-0-mvp`, 아직 미커밋 → 이번 커밋 대상):
  - 종료 불가 → 단색 물고기 템플릿 아이콘(`src-tauri/icons/tray-template.png`) + 전역 종료 단축키 **⌘⌥Q**(`tauri-plugin-global-shortcut`, `lib.rs`). ⌘⌥Q 작동 확인.
  - 오버레이 겹침 → 480×320 위젯용 컴팩트 오버레이(`index.html`).
  - 줌 시 흐림 → DoF(`BokehPass`) 제거(`src/scene/postfx.ts`). 모든 줌에서 또렷 확인.

### 이어할 것
- **메뉴바 트레이 아이콘 발견성 개선** — `KNOWN_ISSUES.md`의 OPEN 항목 참조. `src-tauri/src/tray.rs`의 `create_tray` + `src-tauri/icons/tray-template.png`. 후보: 더 두껍고 단순한 글리프로 재디자인, 정식 `.app` 빌드 후 메뉴바 스크린샷 진단, 노치 오버플로 확인.
- **v2 phase `1-depth` step 설계·실행** (`phases/index.json`에 pending): 한도 근사(롤링5h)·사용량↔어항 연동·한도 임박 경고·새우/가재·인터랙션(밥주기·놀래키기)·물멍 모드(드리프트·Zen)·설정 영속화·정식 도킹. fast-follow: 리소스 스로틀(ADR-007). **시작 전 메모(`memory/`)의 한도 데이터 소스 조사부터.**
- **`feat-0-mvp` 브랜치 리뷰 후 main 병합** 검토 (현재 main 미병합).
- 실행: `npm run dev`(=tauri dev). 종료 ⌘⌥Q. cargo는 PATH에 없어 `source "$HOME/.cargo/env"` 필요.

### 배운 것
- 캡처 결정론을 위해 SwiftShader(소프트웨어 GL)로 렌더하면 postFX(코스틱·Bloom)가 실제 GPU보다 약하게 나옴 → 별도 GPU 검증샷 병행 필요.
- 자유 줌 관상 위젯에 DoF는 부적합(어느 줌이든 흐림 유발).
