# PROGRESS — Aquagarden

## 2026-05-22 — 물멍 최적화: calm motion + clear teal visual handoff

> 사용자의 피드백: 이 앱의 핵심 목적은 업무 중 물멍(감상)인데, 물고기 움직임이 빠르고 부자연스러우며 현재 버전이 최초 배포본보다 어둡고 또렷하지 않다. `gemini_plan.md`를 참고하되, 단순히 밝히는 대신 "느린 유영 + 맑은 청록 + 대비/선명도 유지" 방향으로 구현. 브랜치 `codex/calm-clarity`, 커밋 `e1f397b`, 원격 `origin/codex/calm-clarity`까지 push 완료.

### 한 일

- **모션 프로파일 도입** (`src/scene/fauna/fish.ts`): `fishMotionProfiles`와 `turnSlowdownForDot()` 추가. 베타/테트라/코리도라스 속도를 각각 `0.8 / 2.0 / 1.2`로 낮추고, 종별 `steeringLerp`, `turnLerp`, `tailFreq`, `tailAmp`로 느리고 관성 있는 유영을 구현.
- **급회전/군영 떨림 완화** (`src/scene/fauna/fish.ts`): 목표 방향이 크게 바뀌면 `turnSlowdown`으로 최대 32% 감속. 테트라 군영 보정은 `flockSteer.lerp(rawFlockSteer, 0.06)`로 완충. 꼬리 흔들림 주파수는 실제 속도/기본 속도 비율에 연동.
- **저서 생물 감속** (`src/scene/fauna/inverts.ts`): 새우 속도를 `0.25 + random() * 0.18`로 낮추고 회전을 즉시 각도 변경 대신 lerp로 완충.
- **맑은 청록 day 조명 복원** (`src/scene/lighting.ts`): day 팔레트 `ambient 0xd8eaff`, `topLight 0xf8ffff`, `fog 0x173940`, `bg 0x07181d`. 조명값은 `targetLightSettingsForMode()`로 분리해 테스트 가능하게 함. dusk/night는 선명도만 완만하게 보정.
- **포스트FX 선명도 개선** (`src/scene/postfx.ts`): `gradeDefaults`, `bloomDefaults`, `toneMappingExposure` export. 비네팅 `0.15`, 그레인 `0.006`, 채도 `1.12`, Bloom `0.42/0.38/1.05`, exposure `1.08`.
- **식재/네온 가독성 보정** (`src/scene/aquascape.ts`, `src/scene/fauna/fish.ts`): 중경 수초와 모스를 형광 라임으로 되돌리지 않는 범위에서 약간 밝힘. 네온테트라 stripe는 맑은 day 모드에서도 묻히지 않도록 `0x0c7580 / 0x1aa6b0 / 1.15`.
- **사용량 무드 완화** (`src/scene/mood.ts`): high usage 상태에서도 감상성을 해치지 않도록 60/80/95% 임계값을 `1.08/0.94`, `1.18/0.86`, `1.32/0.76`으로 완화.
- **회귀 테스트 추가**: `src/scene/fauna/fish.test.ts`, `src/scene/lighting.test.ts`, `src/scene/postfx.test.ts` 추가 및 `src/scene/mood.test.ts` 갱신.
- **계획 문서 동기화** (`gemini_plan.md`): 실제 구현값과 검증 절차를 반영해 갱신.

### 검증

- `npm run test` ✅ 10 files / 51 tests pass.
- `npm run lint` ✅ pass.
- `npm run build` ✅ pass. Vite chunk-size warning은 기존 성격의 번들 크기 경고.
- `cd src-tauri && source "$HOME/.cargo/env" && cargo test` ✅ Rust tests pass.
- `CAPTURE_PHASE=3-calm-clarity CAPTURE_STEP=motion-clarity npm run capture` ✅ 캡처 산출:
  - `phases/3-calm-clarity/captures/motion-clarity/front_day.png`
  - `phases/3-calm-clarity/captures/motion-clarity/gpu_front_day.png`
  - `phases/3-calm-clarity/captures/motion-clarity/clip_front_day.webm`
- `npm run dev`로 Tauri 앱 구동 확인. 첫 시도는 오래 남아 있던 `vite` PID가 1420 포트를 점유해 실패했고, 해당 프로세스를 종료한 뒤 정상 실행.

### 이어할 것

- **사용자 시각 사인오프**: `phases/3-calm-clarity/captures/motion-clarity/` 캡처와 실제 앱을 보고 day 모드가 "맑고 또렷하지만 납작한 민트색으로 뜨지 않는지" 확인 필요. 특히 60초 물멍 체감은 사용자의 눈으로 최종 판단.
- **PR 생성 여부 결정**: 브랜치 `codex/calm-clarity`는 push 완료. GitHub PR 링크는 `https://github.com/outliner-coach/aquagarden_gemini_flash_3.5/pull/new/codex/calm-clarity`.
- **고 사용량 무드 캡처 fast-follow**: 현재 capture fixture는 context `21.6%`라 high usage 상태의 포그/속도 완화는 단위 테스트로만 검증됨. 필요하면 capture용 snapshot pct를 80/95%로 바꾸는 별도 캡처 모드나 임시 스크립트로 확인.
- **`PROGRESS.md` 상태 주의**: 이 파일에는 이전 세션에서 이미 추가돼 있던 미커밋 로그가 있었다. 이번 핸드오프 문서화에서는 상단에 새 로그를 추가했고, 다음 커밋에는 기존 로그와 함께 들어갈 수 있다.

### 배운 것

- 최초 버전의 또렷함은 "무조건 밝기"보다 **어두운 청록 물 + 밝은 바닥 코스틱 + 붉은/분홍 포인트의 분리감**에서 온다.
- 물고기 속도만 낮추면 꼬리만 바쁘게 보일 수 있으므로, 꼬리 주파수도 실제 속도에 연동해야 물멍 템포가 살아난다.
- `npm run dev` 포트 충돌 시 이 프로젝트는 `vite.config.ts`의 `strictPort: true` 때문에 포트 변경보다 기존 `vite` 프로세스 정리가 빠르다.

## 2026-05-22 — IDEATION 전 항목 마무리 (harness 미학 phase + Codex 리뷰 루프)

> v1 MVP를 main 병합하고, IDEATION의 모든 개선 항목을 구현. 매 작업마다 Codex(이미지/코드) 리뷰로 개선점이 없을 때까지 반복(goal 모드). 3개 phase 브랜치를 순차 main 병합. 현재 `main`, 트리 클린, 빌드/테스트 그린.

### 한 일

- **v1 MVP → main 병합** (`feat-0-mvp` → `33e7761`): code-reviewer GO(CRITICAL 6/6 통과). 병합 전 휠줌·따라다니는 대사·delta클램프(`766c4cc`)와 IDEATION 보강을 먼저 커밋.
- **harness `1-aesthetic` phase 실행** (`scripts/execute.py 1-aesthetic`, `5db6f7b` 병합): step0 `aesthetic-rubric`(AESTHETIC.md 감산 루브릭 정렬 + 캡처 스크립트 `CAPTURE_PHASE`/`CAPTURE_STEP` 파라미터화) → step1 `subtraction-pass`(조명·포그·ambient·Bloom / 녹색채도↓·빨간벽 분산·전경밀도↓ / 카메라 `HERO_W` 20→22). 이중 게이트(designer Pass + Codex 조건부GO + 사용자 사인오프) 통과.
- **IDEATION 전 항목 구현** (`feat-2-polish` → `a621d0d` 병합, 8 커밋). 각 작업 후 Codex 리뷰로 수렴까지 반복:
  - 시각 2·3차 정제 + 베타 0.68→0.78·코리 0.65→0.70 (`0944c0c`, Codex 조건부GO→GO 수렴)
  - **§7 렌더 완전 정지**(`a763818`): `frame()`+`start/stopRenderLoop()`, `document.hidden`||`collapsed` 시 `cancelAnimationFrame`, 재개 시 `simTime` 직접 누적(getElapsedTime 점프 방지 — Codex 지적).
  - **§4-1/4-5/4-6**(`955547f`): 더블클릭 줌리셋, 투과 시 ⋯ 에메랄드 글로우(`menu-passthrough-on`), 퍽 5px 드래그 이동. Codex: `event.detail>1` 가드·`pointercancel` 정리.
  - **§4-2/§6-3**(`5941d3f`): 대사 종별 5줄·8s, HUD `level`(normal/warn/critical) 바색상+`hud-alert` 강조. jsdom DOM 렌더 테스트 추가.
  - **§4-4 멀티모니터 가드**(`580a155`, Rust): `window.rs` 위치 영속화(`settings.json` `window-position`, 400ms 스로틀+`flush`) + 시작 시 OOB면 주모니터 안전영역 회수. `lib.rs` `on_window_event`.
  - **§6-1 모델 한도**(`2762540`, Rust): `context_limit()` 확장 + `is_model()` 정확 매칭. **Codex가 버그 포착 — Sonnet 4.6은 200K 아니라 1M(공식)**, 200K면 5배 과대표시(ADR-009 위반)였음. opus-4-7·sonnet-4-6=1M, haiku-4-5=200K, 그 외 None.
  - **§6-2 어항↔사용량 연동**(`c92ff54`): `src/scene/mood.ts` `usageMood(pct)` 순수함수(점유율↑→`fogDensityMul`↑·`fishSpeedMul`↓), `lighting.fogDensityMul`·`fish.update(speedMul)`로 적용. 라이브 루프만(캡처는 CALM).
  - **§5 새우·달팽이**(`4687b5e`): `src/scene/fauna/inverts.ts` `Shrimp`/`Snail` 공통 `Critter` 인터페이스, `spawnInverts`. Codex 비주얼 2라운드 → 달팽이 나선 띠·새우 더듬이 보강 → 수렴.
- **Codex CLI 복구**: 벤더 바이너리 누락(ENOENT) → `npm install -g @openai/codex`(0.133.0). 이미지 리뷰는 `codex exec -i` + 프롬프트는 **stdin**으로(가변 `-i`가 positional 프롬프트를 삼킴).

### 이어할 것

- **§6-1 롤링 5h 사용한도 근사** — 의도적 보류. 재개 조건: 정밀 5h 한도(분모) 소스를 찾거나 "추정 budget" UX 확정. 분모 없는 원시 카운트는 저가치 + 날짜 파싱(chrono) 의존. 근거는 `docs/IDEATION.md` §6-1, memory `aquagarden-usage-source`.
- **병합된 phase 브랜치 정리**(선택): `feat-0-mvp`·`feat-1-aesthetic`·`feat-2-polish` 삭제 가능(전부 main 병합됨).
- **§6-2 시각 체감 튜닝**(선택): 고 점유율 상태는 캡처가 고정 21.6%라 미검증 — 캡처에 고% 변형을 주입하면 임박/한계 어항 룩을 비주얼 게이트로 확인 가능. Codex 제안: 속도 저하 시 꼬리 흔들림 주파수도 동반 저하.

### 배운 것

- **Codex 이미지 리뷰**: `omc ask`는 텍스트 전용(이미지 불가). 시각 리뷰는 `printf '%s' "프롬프트" | codex exec --dangerously-bypass-approvals-and-sandbox -i a.png -i b.png` — `-i`가 가변인자라 프롬프트는 반드시 stdin. (memory `reference-codex-image-review`)
- **모델 컨텍스트 한도**: opus-4-7·sonnet-4-6=1M, haiku-4-5=200K. 미검증 모델에 추정 한도 박지 말 것(ADR-009) — 1M 모델에 200K면 5배 과대.

## 2026-05-22 — 버그 픽스 2건 + 휠 줌 + 대사 말풍선 + 미학 아이데이션

> 실사용 피드백 2건 해결: 물고기 사라짐(rAF delta 클램프), 대사 안 보임(물고기 머리 위 말풍선). 휠 줌 신규 추가. 원본 vs 현재 미학 비교로 회귀 원인 진단 후 IDEATION.md 작성. **전부 미커밋** (브랜치 `feat-0-mvp`).

### 한 일

- **물고기 사라짐 버그 수정** (`src/main.ts`): `clock.getDelta()` 상한 없이 쓰면, 위젯이 백그라운드·투과·퍽 상태에서 Chromium이 rAF를 멈춘 뒤 재개 시 누적 시간(수 초~분)이 한 프레임 delta로 들어와 물고기가 수조 밖으로 점프 → 사라짐. `MAX_DELTA = 0.05`(50ms) 상수 추가, 두 animate 루프(일반+캡처 클립)에서 `Math.min(clock.getDelta(), MAX_DELTA)` 클램프. 사용자 실기 확인 완료.

- **마우스 휠 줌 인/아웃** (`src/scene/framing.ts`, `src/main.ts`): 순수 함수 2개 TDD로 선작성 후 구현(테스트 36개 = 기존 30 + 신규 6). `maxCoverDistance(aspect)` — 이 거리 이상이면 수조 밖(유리 너머)이 드러나므로 줌아웃 상한으로 사용. `targetYForDistance(distance)` — 기질 하단 고정 타깃 계산. `main.ts`에 `zoomDistance: number | null` 상태 + wheel 리스너(passive:false, 지수 스텝 `exp(deltaY*0.0015)`). `frameCamera()`가 상태를 반영해 `[MIN_DISTANCE, max(cover, auto)]`로 클램프. 리사이즈 시 자동 재고정. chrome/그립/퍽 위 휠은 무시.

- **물고기 대사 → 머리 위 말풍선** (`index.html`, `src/main.ts`): `triggerFishLine(type, group: THREE.Object3D)`로 시그니처 변경 — 클릭한 물고기 group 참조를 `activeFishGroup`에 저장. `updateFishLinePosition(camera)` 함수가 매 rAF 프레임 group 위치를 NDC→스크린 좌표로 투영해 말풍선 `left`/`top` 갱신 → 물고기가 헤엄쳐도 대사가 따라다님. index.html `#fish-line`: 하단 고정 클래스 제거 → `absolute top-0 left-0 -translate-x-1/2 -translate-y-full max-w-[168px]`. 글자 12px → 10px. 화면 가장자리 클램프.

- **미학 비교·진단** (코드 분석 + 원본 스크린샷): 원본(프로토타입)이 더 아름답게 보이는 원인 진단. ①낮 포그 밀도 0.032(현재) vs 0.045(원본) — 포그가 엷어 배경 밝게 드러남. ②낮 포그 색 `0x274320` — 초록 캐스트가 Bloom에 증폭. ③ambient `0xe2e6bc`(따뜻한 연두 크림) intensity 1.05 — 균일 조명으로 대비 소실. ④카메라 구도 — 기질이 화면 하단 25~30% 차지, 위는 빈 물.

- **`docs/IDEATION.md` 신규 작성**: 미학 회귀 수정 파라미터 후보, 카메라 구도 조정, 베타 스케일 업, UX 잡일(줌 리셋·대사 타이밍), 생물 확장(새우·달팽이), v2 사용량 연동 테이블, 성능 예산, 우선순위 표.

### 이어할 것

- **이번 세션 커밋** — 미커밋 파일: `index.html`, `src/main.ts`, `src/scene/framing.ts`, `src/scene/framing.test.ts`, `docs/IDEATION.md`. `.DS_Store` 제외하고 파일 명시 `git add`. 후보 메시지 `feat(scene): 휠 줌·대사 말풍선·delta 클램프 + 아이데이션`.

- **미학 회귀 수정** (`src/scene/lighting.ts`, 최우선): `docs/IDEATION.md §1` 파라미터 후보 적용.
  - 낮 포그 색: `0x274320` → `0x0e2218` 전후 (어두운 청록-그린)
  - 낮 포그 밀도: 0.032 → 0.040~0.045
  - 낮 bg: `0x0e2113` → `0x05110a`
  - 낮 ambient 색: `0xe2e6bc` → `0xb8cca8` (덜 황록)
  - 낮 ambient 강도: 1.05 → 0.85
  - 수정 후 `node scripts/capture-framing.mjs` 재캡처 → AESTHETIC 루브릭 → 사용자 사인오프

- **카메라 구도 오프셋** (`src/scene/framing.ts`): `FRAME_BOTTOM_Y` -7.3 → -6.0~-6.5, 또는 `targetYForDistance`에 +0.5~1.0 고정 오프셋으로 기질 덜 노출·식재부 중심.

- **베타 스케일 업** (`src/scene/fauna/fish.ts`, `spawnFauna` 첫 줄): 0.68 → 0.85~0.90.

- 실행: `source "$HOME/.cargo/env" && npm run dev`. 종료 ⌘⌥Q.

### 배운 것

- **rAF throttle + 누적 delta = 물고기 탈출**: 상시 위젯에서 Chromium이 백그라운드 rAF를 멈추면 재개 시 `getDelta()`가 수 초를 반환. 위젯류 Three.js 앱은 반드시 `MAX_DELTA` 클램프 필요.
- **원본 어두운 청록 포그(0.045)가 수중 분위기의 핵심**: 후처리(Bloom·코스틱·톤매핑)보다 포그 색상·밀도가 "수조" 인상을 더 크게 좌우. 이를 밝고 따뜻한 녹색으로 바꾸면 고급 후처리가 오히려 탁함을 증폭시킨다.
- **NDC 투영으로 3D→DOM 따라다니기**: `group.position.clone().project(camera)` → `(v.x*0.5+0.5)*W, (-v.y*0.5+0.5)*H`. 매 rAF 호출로 부드럽게 따라감. 화면 가장자리 클램프 필수.

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
