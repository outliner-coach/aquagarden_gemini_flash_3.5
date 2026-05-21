# Step 2: scene-port (외과적 이식)

기존 `index.html`의 3D 어항을 ESM 모듈로 **충실히 이식**한다. 미화·개선이 아니라 **동작 보존 이식**이다.

## 읽어야 할 파일

- `/index.html` (이식 원본 — 전체. 특히 `initScene`, `buildAquascape`, `setLightMode`, `createSwayingPlant`, `spawnBubbles`, `Fish` 클래스, `animate`)
- `/docs/ARCHITECTURE.md` (`src/scene/` 구조, 생물 공통 인터페이스 패턴)
- `/CLAUDE.md` (외과적 변경 규칙)
- step1 산출물(Vite/TS 셋업, `src/main.ts` 진입점)

## 작업

`index.html`의 인라인 스크립트를 `src/scene/` ESM 모듈로 분리 이식:
- `src/scene/aquascape.ts` — 유리/모래/소일/수면/바위/수초/기포 (buildAquascape, createProceduralRock, createSwayingPlant, spawnBubbles, animateBubbles).
- `src/scene/lighting.ts` — day/dusk/night 조명 + 전환(setLightMode, updateLightingTransition, `colors` 팔레트).
- `src/scene/fauna/fish.ts` — `Fish` 클래스(betta/tetra/corydoras) + spawnFauna. 공통 `update(delta, time)`/`group` 인터페이스 유지.
- `src/main.ts` — 씬/카메라/렌더러/OrbitControls 초기화 + `animate` 루프 + 클릭 명언(triggerQuote) 배선.
- CDN `three` r128 → npm `three`(ESM import). r128→최신 API 변경은 **돌아가게 만드는 최소한만** 수정(예: 색공간/인코딩 프로퍼티명).

## Acceptance Criteria

```bash
npm run build
```
- `npm run dev` 창에 기존과 동일한 어항이 렌더되고 물고기가 유영한다(수동).
- 시각: 기존 `index.html`과 룩이 충실히 재현됨(이후 step3 캡처로 대조).

## 검증 절차

1. AC 통과.
2. 기존 동작 보존 체크: 물고기 3종 유영, 수초 흔들림, 기포 상승, 조명 3모드 전환, 오브젝트 클릭 명언이 모두 동작하는가.
3. `phases/0-mvp/index.json` step 2 업데이트.

## 금지사항

- 미화·새 시각효과(포스트프로세싱·톤매핑·Bloom 등) 추가 금지. 이유: 미화는 step4(visual-polish) 전담. 여기서 손대면 외과적 분리가 깨진다.
- 작동 중인 boids 타겟 추적·꼬리 흔들림 로직 재작성 금지. 동작 보존. 이유: 검증된 자산 보호.
- 요청 범위 밖 리팩터·파일 추가 금지.
