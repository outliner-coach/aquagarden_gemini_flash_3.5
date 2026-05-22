# Step 1: subtraction-pass

## 읽어야 할 파일

먼저 아래 파일들을 읽고 현재 파라미터 값과 설계 의도를 파악하라:

- `/docs/AESTHETIC.md` — **step0(aesthetic-rubric)에서 갱신된** 감산 루브릭·이중 게이트. **이 step의 합격 기준이자 게이트1 채점 기준.**
- `/docs/IDEATION.md` (§1 A~G, §2 카메라) — 구체 파라미터·코드 위치
- `/docs/ADR.md` — ADR-010(점진·목표기반, 6패스 일괄 금지), ADR-009(graceful degrade)
- `/src/scene/lighting.ts` — day/dusk/night 조명·포그·ambient·topLight
- `/src/scene/postfx.ts` — 톤매핑·Bloom
- `/src/scene/aquascape.ts` — 수초 식재(녹색/적색/전경 카펫)·색
- `/src/scene/framing.ts` — 카메라 거리·타깃(`HERO_W`, `deriveFraming`, `maxCoverDistance`, `targetYForDistance`)
- `/src/scene/framing.test.ts` — 프레이밍 불변식 테스트(카메라 변경 시 영향받음)
- `/src/main.ts` — `zoomBounds`/휠 줌(카메라 거리와 정합 필요)
- `/scripts/capture.mjs` — 시네마틱 캡처(step0에서 `CAPTURE_PHASE`/`CAPTURE_STEP` 파라미터화됨)

이전 step에서 AESTHETIC.md가 감산 방향으로 갱신됐다. 그 갱신된 루브릭이 이 step의 합격 기준이다.

## 작업

감산 튜닝. 아래 항목들은 시각적으로 **상호의존**하므로 함께 적용하고 함께 캡처해 판단한다. 제시 값은 **출발점**이며, designer 게이트 루브릭에 맞춰 반복 튜닝한다(ADR-010 점진·목표기반 — 한 번에 박고 끝내지 마라).

### 1. 조명·포그·톤 (`lighting.ts`, `postfx.ts`)
- 낮 포그 색상 `0x274320`(중간 녹색) → `0x0e2218` 전후(어두운 청록-그린). 낮 포그 밀도 `0.032` → `0.040~0.045`. 낮 bg 더 어둡게.
- ambient 색상 `0xe2e6bc`(따뜻한 황록 크림) → `0xb8cca8` 방향(중립~약간 따뜻, 황록 캐스트 제거). ambient 강도 `1.05` → `0.85` 전후.
- topLight 강도 `6.0` → `4.5~5.0`(과노출 방지).
- Bloom threshold `0.92` → `1.05` 전후 — 초록 계열 전체가 번지지 않고 네온테트라 emissive·코스틱 하이라이트만 잡게.

### 2. 식재·색 (`aquascape.ts`)
- `greenish()` base `0x4a7e2e` → 올리브-세이지(`0x5a6e44` 전후)로 채도↓. clamp 범위(`0x3a661f`~`0x60963a`)도 동반 하향. 중경 단색 녹색 `0x6fae3f`(라임)도 같은 폭으로 채도↓.
- 적색 줄기수초: 개수 `62` → `40~46`으로 솎고, x 분포 폭 확대(`6.5 + random()*5` → `5.5 + random()*7`)로 "벽" 분산. 일부를 더 어둡게 섞어 균일감을 깬다.
- 전경 카펫: 개수 `40` → `28~32`로 솎고, 최전경(`z < 2.5`)을 비워 카메라-피사체 사이 "맑은 물" 레이어를 확보.

### 3. 카메라 구도 (`framing.ts`)
- 카메라 5~10% 뒤로: `HERO_W` `20` → `21~22`, 또는 `deriveFraming` 산출 거리에 ×1.05~1.10. 과근접 해소.
- 변경 시 `maxCoverDistance`·`targetYForDistance`·`zoomBounds`(main.ts)와 정합을 유지. 불변식(기질이 항상 화면 하단 고정, 줌아웃 상한 = 수조 cover 거리)은 유지한다.

### 핵심 규칙 (이탈 금지)
- **모션·흐름장·boids·물고기 `update` 로직을 수정하지 마라.** 이유: 감산은 색·밀도·구도만 다룬다. 모션은 별개 가치(AESTHETIC §4)이고 범위 밖이다.
- **새 시네마틱 패스(코스틱/갓레이/DoF 등)를 추가하지 마라.** 이유: 목표는 감산이지 가산이 아니다. 기존 패스의 파라미터만 조정한다.
- `framing.test.ts`가 카메라 변경으로 깨지면, 불변식(기질 하단 고정·cover 상한)은 유지한 채 기대 수치만 새 구도에 맞춰 갱신하라. 불변식 자체를 약화시키지 마라.
- CLAUDE.md CRITICAL을 준수하라(외부 CDN/네트워크 의존 금지 등).

## Acceptance Criteria

```bash
npm run build && npm test
CAPTURE_PHASE=1-aesthetic node scripts/capture.mjs   # 3카메라×3모드 9샷 → phases/1-aesthetic/captures/
```

**빌드·테스트 그린만으로는 미완료다(ADR-010).** 아래 이중 게이트를 통과해야 한다:
- **게이트1 (designer 에이전트)**: 캡처를 step0에서 갱신된 AESTHETIC.md §5 루브릭으로 채점. 전 항목 Pass여야 한다. 미달 시 그 사유를 다음 튜닝 시도에 피드백한다(자가 교정 루프).
- **게이트2 (사용자 사인오프)**: 게이트1 Pass 후, 캡처를 사용자가 보고 승인. 원본 `prototype.html`을 동일 비율로 나란히 두고 "첫인상 깨끗함"을 대조한다.

## 검증 절차

1. AC 커맨드를 실행한다(build/test/capture).
2. 게이트1: designer 에이전트로 캡처를 §5 루브릭 채점. 미달 항목이 있으면 파라미터를 재조정하고 재캡처(반복).
3. 아키텍처 체크리스트:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가? ADR 기술 스택을 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
   - 모션 로직·새 시네마틱 패스를 추가하지 않았는가?
4. `phases/1-aesthetic/index.json`의 step 1을 갱신한다:
   - 게이트1 Pass + build/test 그린 → 게이트2(사용자 사인오프) 대기를 위해 `"status": "blocked"`, `"blocked_reason": "게이트2 사용자 사인오프 대기 — phases/1-aesthetic/captures/ 캡처 검토 요청"` 후 즉시 중단. 이유: 게이트2는 사람 판단이라 자동 진행 불가.
   - 게이트1 미달이 3회 자가 교정 후에도 지속 → `"status": "error"`, `"error_message": "미달 루브릭 항목·사유"`.
   - (사용자가 사인오프하면 `status`를 `completed`로 바꾸고 `summary`를 기록한다.)

## 금지사항

- 모션/애니메이션/boids 로직을 수정하지 마라. 이유: 범위 밖 — AESTHETIC §4는 별도 가치다.
- 새 시네마틱 패스(코스틱/갓레이/DoF)를 추가하지 마라. 이유: 목표는 감산이다.
- `framing.ts`의 불변식(기질 하단 고정·cover 상한)을 약화시키지 마라.
- 기존 `phases/0-mvp/captures/` 산출물을 덮어쓰지 마라.
- 기존 테스트를 깨뜨린 채 두지 마라.
