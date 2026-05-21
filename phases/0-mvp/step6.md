# Step 6: hud-basic

사용량 이벤트를 구독해 **곁눈질로 읽히는 최소 HUD**(컨텍스트%·토큰)를 어항 위에 얹는다. 어항 미학을 해치지 않는다.

## 읽어야 할 파일

- `/docs/UI_GUIDE.md` (도구 표면 규율 — HUD 패널 스타일, 안티슬롭, 색상)
- `/docs/AESTHETIC.md` (HUD가 씬 미학을 해치지 않을 것)
- `/docs/ARCHITECTURE.md` (usage 스토어 ↔ HUD 흐름)
- step5 산출(`UsageSnapshot` 이벤트 페이로드 형태)

## 작업

- `src/usage/` 스토어: Tauri 이벤트를 구독하는 경량 반응 스토어(EventTarget/nanostores). 유일 입력원 = step5 이벤트.
- `src/hud/` 오버레이: 컨텍스트% 게이지 + 토큰 수치. `tabular-nums`, 단색 반투명 패널(UI_GUIDE). 모서리 한 곳 고정, 어항 중앙 비움.
- **"데이터 없음" 상태**: 이벤트가 없거나 한도 `unknown`이면 게이지 대신 `—`/안내. 크래시·빈 화면 금지.
- 스토어 로직 TDD(vitest): 이벤트 수신→상태 갱신, 데이터 없음 전이.

## Acceptance Criteria

```bash
npm test
npm run build
npm run capture
```
- `npm run dev`에서 HUD가 실시간 컨텍스트%·토큰을 표시(수동).
- 시각(라이트 게이트): `captures/step6/`에서 HUD가 어항 미학을 해치지 않음(UI_GUIDE 도구 표면 규율 준수, 중앙 비움).

## 검증 절차

1. AC 통과(테스트·빌드·캡처).
2. UI_GUIDE 체크: backdrop blur 남용/네온 글로우/보라색 등 안티슬롭 없는지, 단색 반투명·중앙 여백 지켜지는지.
3. 데이터 없음 상태가 우아하게 표시되는지(이벤트 끊고 확인).
4. `phases/0-mvp/index.json` step 6 업데이트.

## 금지사항

- 어항 미학을 해치는 HUD(과한 blur, 글로우 펄스, 큰 패널) 금지. 이유: 어항이 주인공(UI_GUIDE).
- 사용한도(롤링5h)·사용량↔어항 연동·경고 신호 구현 금지. 이유: v2 범위.
- 프론트에서 FS 직접 접근 금지(스토어는 Tauri 이벤트만 구독). 이유: CRITICAL 규칙.
