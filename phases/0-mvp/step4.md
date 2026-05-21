# Step 4: visual-polish (시네마틱, 이중 게이트) ★

제품의 1차 가치. 빈 어항을 sample.jpeg 무드의 시네마틱 룩으로 끌어올린다. **점진·목표기반**으로.

## 읽어야 할 파일

- `/docs/AESTHETIC.md` (전체 — §1 스타일, §2 팔레트, §3 파이프라인, §4 모션, §5 루브릭, §6 게이트). **이 step의 합격 기준이다.**
- `/sample.jpeg` (아트 디렉션 레퍼런스)
- `/docs/ADR.md` (ADR-010 미학 1차 가치 + 점진 구현)
- step2/step3 산출물(`src/scene/`, `npm run capture`)

## 작업

**점진 순서로** 시네마틱 파이프라인 적용 (목록대로 6패스 일괄 금지):
1. 색관리: sRGB output + linear workflow, `ACESFilmicToneMapping` + 적정 exposure.
2. 코스틱(바닥/돌 일렁임), 깊이 색 감쇠(거리에 따른 청록 포그/흡수).
3. 은은한 Bloom(코스틱·하이라이트·발광 요소 한정).
4. 모션 정제(물고기 군영 응집·가변 속도, 수초 흐름장 통일 — 일률적 사인파 제거).
5. 팔레트를 §2 / sample.jpeg에 맞게 재튜닝(조명 3모드 포함).
→ 여기까지 후 `npm run capture` + §5 루브릭 자가 채점. **DoF·갓레이는 루브릭/60초 물멍 테스트에서 필요할 때만** 추가.

## Acceptance Criteria

```bash
npm run build
npm run capture
```
- `docs/AESTHETIC.md` §5 루브릭의 **이진 항목 전부 Pass**(톤매핑 적용·코스틱 보임·밴딩 없음·Bloom 과다 아님·깊이 레이어 읽힘·모션 비일률 등).

## 검증 절차 (이중 게이트)

1. AC 통과 + `captures/step4/`에 9장(카메라3×조명3) 산출.
2. **게이트1 — 자가 루브릭 리뷰**: §5 각 항목을 캡처로 채점. 미달 항목이 있으면 그 항목만 보강 후 재캡처(점진 반복). 전 이진 항목 Pass여야 게이트2로.
3. **게이트2 — 사용자 사인오프**: `phases/0-mvp/index.json` step 4를 다음으로 설정하고 **즉시 중단**:
   - `"status": "blocked"`, `"blocked_reason": "visual-polish 캡처(captures/step4/)에 대한 사용자 미학 사인오프 필요. 승인 시 step4를 completed로, 보강 요청 시 피드백 반영 후 재실행."`

## 금지사항

- 6패스(특히 DoF·갓레이)를 처음부터 일괄 투입 금지. 이유: 거대한 튜닝 표면·성능 비용을 한 번에 떠안는다(ADR-010).
- 스스로 `completed` 금지. 반드시 `blocked`로 끝낸다. 이유: 게이트2 사용자 사인오프.
- 성능을 무시한 과도한 효과 금지(끊김 유발). 60초 물멍 테스트에 스터터가 보이면 불합격.
