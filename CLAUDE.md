# 프로젝트: Aquagarden (디지털 아쿠아가든)

작업 중인 모니터 한쪽에 상시 띄워두는 관상용 3D 어항 데스크톱 위젯.
어항을 감상하는 동시에 Claude Code의 토큰 사용량·사용한도·컨텍스트 윈도우를 앰비언트하게 보여준다.
기존 단일 `index.html`(Three.js r128 CDN 프로토타입)을 프로덕트로 업그레이드한다.

## 기술 스택
- Tauri v2 (Rust 셸 — 투명·always-on-top·프레임리스 데스크톱 창)
- 프론트엔드: Vite + TypeScript (strict mode)
- 3D: Three.js (npm `three`, ESM. CDN r128 사용 금지)
- 스타일링: Tailwind CSS (npm + PostCSS. `cdn.tailwindcss.com` 사용 금지)
- 사용량 데이터: Rust 백엔드가 로컬 Claude Code 세션/로그를 읽어 IPC로 프론트에 전달

## 아키텍처 규칙
- CRITICAL: 파일시스템 접근과 Claude Code 사용량 읽기는 **전부 Rust(Tauri command/이벤트)에서만** 처리한다. 웹뷰(프론트)는 절대 파일시스템을 직접 읽지 않는다. 이유: Tauri capability 보안 모델 준수 + 렌더러를 순수하게 유지.
- CRITICAL: 창 설정(투명/always-on-top/프레임리스/도킹 위치)은 `src-tauri/tauri.conf.json`과 단일 window 모듈에만 둔다. 여러 곳에 흩뿌리지 마라. 이유: 위젯 동작의 단일 진실 공급원 유지.
- CRITICAL: 외부 CDN `<script>`/`<link>`에 의존하지 마라. 모든 의존성은 npm/ESM으로 번들한다. 이유: 데스크톱 앱은 오프라인·재현 가능 빌드여야 한다.
- CRITICAL: **완전 로컬·무(無) 네트워크.** 텔레메트리·분석·자동업데이트 전부 OFF, CSP는 `connect-src 'none'`(원격 스크립트/이미지 금지). capabilities는 `~/.claude/**` **읽기 전용**만 + 설정 쓰기는 앱 config 디렉토리만. 이유: 로그엔 프롬프트·코드 등 민감 내용이 있어 어떤 데이터도 밖으로 나가면 안 된다.
- CRITICAL: **민감 내용은 Rust 밖으로 내보내지 마라.** IPC 페이로드는 숫자 집계(토큰 수·타임스탬프·모델 id)만. 메시지 본문/프롬프트 텍스트는 프론트 전달·영속화·로그 출력 금지. Rust command는 **호출자 경로 인자를 받지 않는다**(경로는 내부 유도, path traversal 차단).
- CRITICAL: **사용량 읽기가 실패해도 어항은 멈추지 않는다.** 로그 부재·포맷 드리프트·부분 쓰기(잘린 마지막 줄)·알 수 없는 모델은 전부 graceful degrade(해당 줄/파일만 skip, HUD는 "데이터 없음" 상태). 사용량은 best-effort 오버레이, 씬이 바닥이다. 파싱 로직은 panic/throw 금지.
- CRITICAL: **미학이 1차 가치.** 씬을 건드리는 작업은 build/test 통과만으론 완료가 아니다. `docs/AESTHETIC.md` 루브릭으로 결정론적 캡처를 산출하고 게이트1(designer 에이전트 리뷰)→게이트2(사용자 사인오프)를 통과해야 한다. 렌더는 시네마틱 풀(톤매핑·색관리·Bloom·DoF·코스틱·갓레이·그레이딩), 아트 디렉션은 `sample.jpeg` 도출.
- 3D 씬 로직(`src/scene/`)과 사용량·HUD 로직(`src/hud/`, `src/usage/`)을 분리한다. 씬은 렌더 모듈, HUD는 usage 스토어를 구독한다.
- 컴포넌트/모듈은 레이어별 폴더에 배치하고, 타입은 `src/types/`에 분리한다.

## 개발 프로세스
- CRITICAL: 테스트 가능한 로직(사용량 파싱, usage 스토어, 상호작용 상태머신)은 반드시 테스트를 먼저 작성하고 통과시키는 구현을 작성한다 (TDD). 사용량 파서는 골든 픽스처(잘린 줄/누락 필드/알 수 없는 모델/빈 디렉토리)로 단언한다. 3D 렌더링·시각 효과는 `docs/AESTHETIC.md`의 캡처+이중 게이트로 검증한다.
- CRITICAL: 큰/불확실한 가정(한도 근사의 타당성, Tauri 창 능력 등)은 본 구현 전에 **버리는 스파이크로 먼저 검증**한다 (verify before build). 틀리면 설계를 고치고 진행.
- 기존 코드 이식·수정은 **외과적으로**: 동작 충실 재현만 하고 요청 범위 밖 미화·리팩터는 금지(미화는 visual-polish 단계에서). 시각 폴리시는 6패스를 목록대로 한꺼번에 넣지 말고, 핵심 패스부터 넣어 루브릭/60초 물멍 테스트로 판단하며 필요한 것만 추가한다.
- 커밋 메시지는 conventional commits 형식을 따른다 (feat:, fix:, docs:, refactor:).

## 명령어
npm run dev      # tauri dev (데스크톱 창 + Vite HMR)
npm run build    # tauri build (프로덕션 번들)
npm run lint     # ESLint
npm run test     # Vitest (프론트 로직) — Rust는 cargo test
