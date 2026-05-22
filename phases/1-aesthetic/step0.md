# Step 0: aesthetic-rubric

## 읽어야 할 파일

먼저 아래 파일들을 읽고 설계 의도를 파악하라:

- `/docs/AESTHETIC.md` — 미학 루브릭·이중 게이트. **이 step이 갱신할 대상.**
- `/docs/IDEATION.md` (§1 미학 회귀, §2 카메라 구도) — 감산 진단·근거·코드 위치
- `/docs/ADR.md` — ADR-010(미학 게이트는 1급 시민), ADR-009(graceful degrade)
- `/scripts/capture.mjs`, `/scripts/capture-framing.mjs` — 캡처 스크립트. 출력 경로가 `phases/0-mvp/...`로 하드코딩돼 있다(갱신 대상).

이 step은 **문서·도구만** 손댄다. 시각/씬 코드(`src/scene/**`)는 다음 step에서.

## 배경 (자기완결)

원본 `prototype.html`이 현재 빌드보다 첫인상이 더 깨끗하다는 외부 평가(Codex, 2026-05-22). 원인은 시네마틱 요소를 *더한* 결과 "과근접 + 탁한 녹색 + 과밀 정글"이 됐기 때문. 해법은 **감산**(색온도↓·녹색 채도↓·카메라 빼기·전경 식재 덜기) — 자세한 진단·파라미터는 IDEATION §1·§2에 있다.

문제: 현재 `docs/AESTHETIC.md`의 무드 목표("채도 높은 녹색", "약간 따뜻한 색온도")가 감산 방향과 **충돌**한다. 다음 step(subtraction-pass)의 designer 게이트는 바로 이 AESTHETIC.md를 기준으로 채점하므로, 루브릭을 그대로 두면 게이트가 감산 결과를 "팔레트 미달"로 FAIL시켜 **게이트가 목표와 모순**된다. 방향 반전이 아니라 정도(degree) 문제다 — 현재 녹색 clamp 상한(`0x60963a`)이 팔레트 천장(`#6b8e3a`)보다 채도가 높고, ambient(`0xe2e6bc`)는 "약간 따뜻"이 아니라 강한 황록 크림이다. 이 step은 게이트가 목표와 정합하도록 루브릭을 먼저 정렬한다(ADR-010: "사용자 Fail 피드백은 루브릭에 반영해 재튜닝").

## 작업

### 1. `docs/AESTHETIC.md` 감산 학습 반영
- **§1 무드**: "채도 높은 녹색" → "중채도 올리브-세이지 녹색(형광/고채도 라임 회피)". "약간 따뜻한 색온도" → "중립~약간 따뜻한 색온도, 황록(yellow-green) 캐스트 회피".
- **§2 팔레트**: 이끼/전경 수초 행에 녹색 채도 상한을 명시 — green 채널이 `#6b8e3a`(약 142)를 넘지 않게. ambient/조명 따뜻함이 황록 크림으로 흐르지 않게 상한 코멘트 추가.
- **§5 루브릭** (항목 번호·구조는 유지):
  - 항목 6(팔레트 충실도)에 명시적 Fail 조건 추가: "녹색 과채도 / 황록 캐스트 / 전경 과밀(정글) / 적색 수초가 단단한 벽 = Fail".
  - 항목 5(구도)에 추가: "과근접 아님 — 피사체와 카메라 사이에 '맑은 물' 레이어가 읽힌다".
- 변경 근거를 한 줄 주석으로 남겨라: "감산 미학 — IDEATION §1·§2 / Codex 2026-05-22 평가 반영".

### 2. 캡처 스크립트 출력 경로 파라미터화
- `scripts/capture.mjs`·`scripts/capture-framing.mjs`의 `OUT_DIR`가 `phases/0-mvp/...`로 하드코딩돼 있다. 환경변수로 phase·step을 받게 한다.
- 시그니처(예): `const PHASE = process.env.CAPTURE_PHASE ?? '0-mvp';` 그리고 step 하위 폴더명(capture.mjs의 `step6`)도 `process.env.CAPTURE_STEP ?? '<기존 기본값>'`로. OUT_DIR을 `phases/${PHASE}/captures/${STEP|framing}`로 조립.
- 미지정 시 기존 동작(`0-mvp`)을 그대로 유지(하위호환).

## Acceptance Criteria

```bash
npm run build && npm test
CAPTURE_PHASE=1-aesthetic node scripts/capture-framing.mjs   # phases/1-aesthetic/captures/ 아래 산출 확인
```

- 캡처가 `phases/1-aesthetic/captures/` 아래에 파일을 만들고, `phases/0-mvp/captures/`는 변경되지 않았는지 확인한다.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - AESTHETIC.md §1·§2·§5가 감산 방향으로 갱신됐고, §5 항목 번호 구조는 유지되는가?
   - 캡처 스크립트가 env로 phase·step 경로를 받고, 미지정 시 기본값 `0-mvp`로 동작(하위호환)하는가?
   - CLAUDE.md CRITICAL 규칙과 무관한 변경인가(네트워크·FS·창설정 미접촉)?
3. `phases/1-aesthetic/index.json`의 step 0을 갱신한다:
   - 성공 → `"status": "completed"`, `"summary": "AESTHETIC.md 감산 루브릭 갱신(§1 무드·§2 팔레트 상한·§5 Fail조건) + 캡처 스크립트 CAPTURE_PHASE/CAPTURE_STEP 파라미터화"`
   - 수정 3회 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 중단

## 금지사항

- `src/scene/**` 등 시각/씬 코드를 수정하지 마라. 이유: 시각 변경은 step1(subtraction-pass)에서 캡처+이중 게이트로 검증해야 한다. 여기서 손대면 게이트 없이 미학이 바뀐다.
- 기존 `phases/0-mvp/captures/` 산출물을 삭제·덮어쓰지 마라. 이유: 0-mvp 게이트 기록을 보존해야 한다.
- AESTHETIC.md의 §5 항목 번호·구조를 재배치하지 마라. 이유: designer 게이트가 항목 번호로 채점한다.
- 기존 테스트를 깨뜨리지 마라.
