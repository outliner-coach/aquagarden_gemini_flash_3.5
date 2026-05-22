# Step 3: visual-harness (결정론적 캡처 인프라)

미학을 검증하려면 비교 가능한 증거가 필요하다. 시각은 바꾸지 않고 **캡처 인프라만** 만든다.

## 읽어야 할 파일

- `/docs/AESTHETIC.md` (§6 캡처 프로토콜 — 카메라 프리셋·조명 모드·저장 경로)
- step2 산출물(`src/scene/`, `src/main.ts`)
- `/docs/ARCHITECTURE.md`

## 작업

- **RNG 시드 고정**: 씬의 모든 난수(물고기 초기 위치, 바위/수초 배치 등)를 시드 가능한 PRNG로 교체해 동일 시드 → 동일 프레임 보장. 시드는 캡처 모드에서 고정.
- **카메라 프리셋**: 정면 / 유목 클로즈업 / 전경 부감 등 고정 카메라 위치·타깃 세트.
- **캡처 스크립트** `npm run capture`: 헤드리스(브라우저/preview 또는 Playwright)로 시드 고정 + 카메라 프리셋 × 조명 모드(day/dusk/night)별 스크린샷 + 짧은 클립을 `phases/0-mvp/captures/step{N}/`에 저장. 출력 파일명은 `{camera}_{mode}.png`.

## Acceptance Criteria

```bash
npm run build
npm run capture   # 결정론적 캡처 산출
```
- 동일 시드로 두 번 캡처 시 동일 이미지가 나온다(결정론).
- 카메라 3 × 조명 3 = 9장 스크린샷이 `captures/step3/`에 생성된다.

## 검증 절차

1. AC 통과.
2. 같은 시드로 재실행 → 픽셀 동일(또는 무시 가능한 차이)인지 확인.
3. `phases/0-mvp/index.json` step 3 업데이트.

## 금지사항

- 씬의 시각/룩 변경 금지. 이 step은 캡처 인프라만. 이유: polish는 step4 전담, 캡처는 polish의 측정 도구.
- 캡처 이미지(`captures/`)를 git에 커밋하지 마라(.gitignore 처리됨). 이유: 바이너리 비대화 방지.
