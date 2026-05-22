# PROGRESS — Aquagarden

## 2026-05-22 — 위젯 UX 개편: 인윈도우 메뉴·반응형 프레이밍·물고기 대사·투과모드

> 발단: 사용자가 "메뉴바(트레이) 아이콘이 안 보인다" → 진단 결과 트레이 NSStatusItem은 정상 등록됐으나 **노치+메뉴바 과밀로 가려져 접근 불가**(앱 버그 아님). 사용자가 "근본 수정" 요청 → 트레이 의존을 줄이고 어항 위에서 직접 닿는 컨트롤로 개편. 이후 실사용 피드백(이동/리사이즈 불가 + 5개 개선)까지 한 세션에 반영. **전부 미커밋**(브랜치 `feat-0-mvp`).

### 한 일
- **반응형 카메라 프레이밍** (`src/scene/framing.ts` 신규, TDD `framing.test.ts` 7케이스): 창을 가로 바/세로 패널 어떤 비율로 늘려도 구도가 안 무너지게 `deriveFraming(aspect)→{distance,targetY}` 순수 함수. 모델 = **기질(바닥)을 항상 화면 하단(FRAME_BOTTOM_Y=-7.3)에 고정** + 폭은 cover. 세로일수록 수직 가시범위를 NORMAL_VISIBLE_H(11)→TALL_VISIBLE_H(7.5)로 줄여 식재부로 줌인. `main.ts` `frameCamera()`가 init/resize/capture(front)에 적용. **OrbitControls 제거**(좌드래그를 창 이동에 양보 → 정면 고정 카메라). 캡처 스크립트 `scripts/capture-framing.mjs`(5개 비율) 추가. **designer 게이트1 PASS**(portrait/tall 1차 FAIL→수정 후 통과). **게이트2(사용자 사인오프) 미완**.
- **창 이동/리사이즈** (CLAUDE.md대로 Rust 경유, `src-tauri/src/window.rs` 대폭 확장): `start_window_drag`(start_dragging), `start_window_resize`(start_resize_dragging, 8방향). 프론트는 좌드래그 임계 5px 초과 시 이동·단순클릭은 물고기 raycast. 8개 `.resize-grip`(가장자리 6px/모서리 12px) → 네이티브 리사이즈. **`tauri-runtime` 의존 추가**(ResizeDirection을 tauri가 재export 안 함).
- **물고기 대사** (명언 기능 제거): 물고기 클릭 → 종별 사색적 한마디(`fishLines` betta/tetra/corydoras 각 3줄)를 하단 중앙에 작게 6초 표시(`#fish-line`, `triggerFishLine`). 기존 `#quote-card` 모달·`quotes`·하드스케이프 클릭 제거.
- **HUD 흐릿↔또렷**: `#hud-overlay` 평소 opacity 0.32(`.hud-faint`), 컨트롤 드러남과 동기로 1.0(`.hud-bright`, menu 모듈이 토글). 감상 방해 최소화.
- **잠깐 숨기기 = ⋯ 퍽 접기**: 메뉴 "잠깐 숨기기" → `collapse_window`(현재 크기 저장 후 64×64 축소) + `body.collapsed`로 어항/HUD/그립 숨기고 `#puck`만. 퍽 클릭 → `restore_window` 복귀. (전체 숨김 대신.)
- **투과 모드(호버홀)**: 메뉴 토글 → `set_passthrough(true)`. Rust 워처 스레드(`spawn_passthrough_watcher`, 80ms 폴링)가 **전역 커서(`app.cursor_position()`)** 를 ⋯ 영역(`update_passthrough_hole`, 메뉴 열리면 팝오버까지 포함)과 비교해 그 밖이면 `set_ignore_cursor_events(true)`. 투과 중 ⋯는 핀되어 보임. → ⋯만 클릭 가능, 나머지 통과.
- **인윈도우 메뉴 골격** (`src/menu/` 신규: `state.ts`+`state.test.ts` 순수 상태머신 8케이스, `index.ts` DOM 배선): 호버 시 우상단 컨트롤(조명+⋯) 드러남(2.5s idle 후 숨김, Zen), 우클릭/⋯로 팝오버(투명도 슬라이더·투과 토글·잠깐 숨기기·종료). **투명도**=캔버스 CSS opacity(0.25~1, store 영속), 조명 모드도 영속. 스모크 `scripts/smoke-menu.mjs`(9케이스) 추가.
- 검증: tsc·ESLint·vitest(30)·cargo check·메뉴 스모크(9)·프레이밍 캡처(5) 전부 그린. `npm run dev` 재기동해 새 빌드 실행 중.

### 이어할 것
- **프레이밍 사인오프(ADR-010 게이트2) 받기** — 사용자 실기 테스트 후 승인 대기. 조정 레버는 `src/scene/framing.ts`: 세로 더 꽉 채우려면 `TALL_VISIBLE_H`(7.5↓)·`A_TALL`(0.45↑), 기본 줌은 `NORMAL_VISIBLE_H`(11), 바닥선 `FRAME_BOTTOM_Y`(-7.3). 재캡처: `npm run build && node scripts/capture-framing.mjs` → `phases/0-mvp/captures/framing/`.
- **사용자 피드백 반영 후 커밋** — 이번 세션 전부 미커밋. 후보 메시지 `feat(widget): 인윈도우 메뉴·반응형 프레이밍·물고기 대사·투과모드·이동/리사이즈`. `git add`는 파일 명시(루트에 `.DS_Store` 있음 — 추가 금지).
- **잠재 다듬기**(피드백 시): 투과모드 호버홀 80ms 지연 체감, 접힌 ⋯ 퍽 이동 불가, 리사이즈 그립 두께, 물고기 대사 톤/표시시간(6s)·HUD 흐림 정도(0.32).
- 기존 "메뉴바 트레이 발견성"(`KNOWN_ISSUES.md`)은 인윈도우 메뉴로 사실상 해소 — 트레이는 보조 경로로 유지.
- 실행: `npm run dev`. cargo는 `source "$HOME/.cargo/env"` 필요. 종료 ⌘⌥Q, 표시토글 ⌘⌥A.

### 배운 것
- **Tauri v2는 `ResizeDirection`을 `tauri::*`로 재export하지 않는다** → `tauri-runtime` 크레이트를 직접 의존성에 추가하고 `tauri_runtime::ResizeDirection` 사용.
- **단일 창 클릭통과는 전부/전무**(set_ignore_cursor_events) → "⋯만 예외" 부분 통과는 전역 커서 위치를 폴링해 hole 안/밖으로 토글하는 **호버홀** 패턴으로 구현. `cursor_position()`은 통과 상태여도 동작(전역 OS 쿼리).
- 세로 비율에서 수조 전체높이를 담으면 식재부가 하단에 쭈그러들고 빈 물만 늘어남 → **기질을 화면 하단 고정 + 세로일수록 줌인**이 몰입 구도의 정답(designer 게이트가 1차 FAIL로 포착).

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
