# 아키텍처

## 디렉토리 구조
```
src/                    # 프론트엔드 (웹뷰)
├── main.ts             # 진입점. 씬 + HUD + usage 구독 부트스트랩
├── scene/              # Three.js 아쿠아스케이프 (기존 index.html에서 이식)
│   ├── aquascape.ts    # 어항/모래/유목/바위/수초/기포/수면
│   ├── lighting.ts     # day/dusk/night 조명 전환
│   └── fauna/          # 생물
│       ├── fish.ts     # 베타·네온테트라·코리도라스
│       └── inverts.ts  # 새우·가재 등 저서 무척추
├── interactions/       # 밥주기 / 놀래키기 / 광량 조정 입력 처리
├── hud/                # 토큰·한도·컨텍스트 오버레이 UI + 한도 임박 경고 표시
├── usage/              # usage 스토어 + Rust IPC 클라이언트 (구독만, FS 접근 X)
├── modes/              # 감상(Zen) 모드 + 유휴 카메라 드리프트 (앰비언트 동작)
├── settings/           # 설정 스토어 (불투명도·도킹·조명·플랜 한도) — Rust persist 래퍼
├── window/             # 도킹 위치 / always-on-top / 클릭 통과 토글 (Tauri 호출 래퍼)
├── types/              # TypeScript 타입 정의
└── lib/                # 유틸리티 + 헬퍼

src-tauri/              # Rust 백엔드 (셸)
├── src/
│   ├── main.rs         # Tauri 앱 부트스트랩, command/이벤트 등록
│   ├── usage.rs        # Claude Code 세션/로그 파싱 → 토큰·한도·컨텍스트
│   ├── tray.rs         # 트레이/메뉴바 아이콘: 표시·숨김·종료·설정 진입
│   └── window.rs       # 창 도킹/위치/always-on-top/클릭 통과 command
├── capabilities/       # 허용 권한(파일 읽기 범위 등) 정의
└── tauri.conf.json     # 창 설정: transparent, alwaysOnTop, decorations:false
                        # + tauri-plugin-store(설정 영속화), 트레이 등록
```

## 패턴
- **셸/렌더러 분리**: 권한이 필요한 일(파일 읽기, 창 제어)은 Rust, 그 외 렌더링·UI는 웹뷰. 경계는 Tauri command/event(IPC)뿐.
- **씬은 명령형, UI는 반응형**: Three.js 씬은 `requestAnimationFrame` 루프로 직접 갱신. HUD는 usage 스토어를 구독해 선언적으로 갱신.
- **생물은 클래스 + 공통 인터페이스**: `Fish`/`Invertebrate`가 공통 `update(delta, time)`·`group`을 구현해 씬 루프가 동일하게 다룬다 (기존 `Fish` 클래스 패턴 계승).

## 데이터 흐름
```
Claude Code 로컬 세션/로그 (파일시스템)
  → [Rust] usage.rs 가 주기적 poll/watch 후 파싱
  → Tauri 이벤트(emit)로 토큰/한도/컨텍스트 스냅샷 전달
  → [웹뷰] usage 스토어 갱신
  → HUD 가 구독해 수치 렌더 + 씬이 구독해 시각(수위/활동량/동요)에 반영

사용자 입력(밥주기·놀래키기·광량)
  → interactions/ 가 씬 상태를 직접 조작 (로컬, IPC 불필요)

도킹/always-on-top/클릭 통과 토글
  → window/ 래퍼 → Tauri command(window.rs) → OS 창 제어

트레이 메뉴(표시·숨김·종료·설정)
  → tray.rs → 창 가시성 제어 / 설정 패널 토글

설정 변경(불투명도·도킹·조명·플랜 한도)
  → settings/ 스토어 → tauri-plugin-store 로 디스크 영속화 → 재시작 시 복원

한도 임박(임계치 초과)
  → usage 스토어가 임계 감지 → 씬(동요·탁함) + 트레이 알림 동시 트리거

감상(Zen) 모드 / 유휴 드리프트
  → modes/ 가 HUD·컨트롤 가시성 토글, 무입력 타이머로 카메라 자동 선회 시작
```

## 상태 관리
- **사용량 상태**: 단일 반응형 usage 스토어(경량 — nanostores 또는 EventTarget 기반). Tauri 이벤트가 유일한 입력원. HUD·씬이 구독자.
- **씬 상태**: Three.js 객체 그래프 + 애니메이션 루프가 보유(명령형). 외부에서 usage 스토어를 읽어 시각 파라미터만 조정.
- **UI/HUD 상태**: 최소 로컬 상태. 무거운 프레임워크(React 등) 없이 vanilla TS + 경량 반응 레이어로 충분.
