물멍 최적화를 위한 움직임 유기화 & 맑은 청록 비주얼 복원 계획

사용자의 피드백을 반영하여, 이 어항 데스크톱 위젯의 핵심 목적인 **"업무 중 물멍(평온한 감상)"**에 최적화되도록 생물 움직임과 화면 선명도를 함께 개선합니다.

## 핵심 방향

1. 물고기 움직임 유기화 및 감속
물리 벡터 보간(Steering)을 도입해 꺾임과 옆밀림(Strafe)을 줄이고, 급회전 시 속도를 낮추며, 꼬리 흔들림도 실제 속도에 맞춰 차분하게 조정합니다.

2. 최초 프로토타입의 맑은 청록 물빛 복원
현재 어둡고 탁한 늪지 톤을 최초 버전의 맑고 깨끗한 열대 어항 톤에 가깝게 되돌리되, 단순히 밝히기보다 레이어 분리감과 선명도를 우선합니다.

3. 사용량 경고 연동 완화
한도 임박 시 어항이 과하게 탁해져 감상성을 해치지 않도록 포그 증가와 속도 저하를 완화합니다.

## 적용 값

### 생물 움직임 개선

[MODIFY] `src/scene/fauna/fish.ts`

종별 기본 속도:
- 베타: `1.4 -> 0.8`
- 네온테트라: `3.8 -> 2.0`
- 코리도라스: `2.2 -> 1.2`

종별 모션 프로파일:
- 베타: `steeringLerp 0.055`, `turnLerp 0.035`, `tailFreq 3.4`, `tailAmp 0.34`
- 네온테트라: `steeringLerp 0.07`, `turnLerp 0.045`, `tailFreq 8.5`, `tailAmp 0.22`
- 코리도라스: `steeringLerp 0.06`, `turnLerp 0.04`, `tailFreq 6.5`, `tailAmp 0.20`

동작:
- `this.velocity`를 목표 방향으로 즉시 덮어쓰지 않고 종별 `steeringLerp`로 보간합니다.
- 목표 방향이 크게 바뀔수록 `turnSlowdown`으로 순항 속도를 최대 32% 낮춥니다.
- 테트라 군영 벡터는 직접 반영하지 않고 `flockSteer.lerp(rawFlockSteer, 0.06)`으로 완충합니다.
- 꼬리 흔들림 주파수는 실제 속도 / 기본 속도 비율에 연동합니다.

[MODIFY] `src/scene/fauna/inverts.ts`

- 새우 속도: `0.5 + random() * 0.4 -> 0.25 + random() * 0.18`
- 새우 회전은 즉시 회전 대신 lerp로 완충합니다.

### 어항 비주얼 복원 및 선명도 강화

[MODIFY] `src/scene/lighting.ts`

낮(Day) 모드 팔레트:
- `ambient: 0xd8eaff`
- `dirLight: 0xffffff`
- `topLight: 0xf8ffff`
- `fog: 0x173940`
- `bg: 0x07181d`

낮(Day) 조명:
- `ambientIntensity: 1.12`
- `dirIntensity: 1.18`
- `topIntensity: 4.8`
- `fogDensity: 0.036`
- `causticIntensity: 0.52`

노을/밤 보정:
- dusk: `ambientIntensity 0.86`, `fogDensity 0.038`
- night: `ambientIntensity 0.68`, `fogDensity 0.044`

[MODIFY] `src/scene/postfx.ts`

- `uVignette: 0.32 -> 0.15`
- `uGrain: 0.022 -> 0.006`
- `uSaturation: 1.08 -> 1.12`
- Bloom: `strength 0.42`, `radius 0.38`, `threshold 1.05`
- `toneMappingExposure: 1.08`

[MODIFY] `src/scene/fauna/fish.ts`, `src/scene/aquascape.ts`

- 네온테트라 stripe: `color 0x0c7580`, `emissive 0x1aa6b0`, `emissiveIntensity 1.15`
- 중경 고정 녹색: `0x6b8e42`
- 모스 후보: `0x4f7d31 / 0x65963a`

### 사용량 무드 완화

[MODIFY] `src/scene/mood.ts`

- 60%: `{ fogDensityMul: 1.08, fishSpeedMul: 0.94 }`
- 80%: `{ fogDensityMul: 1.18, fishSpeedMul: 0.86 }`
- 95%: `{ fogDensityMul: 1.32, fishSpeedMul: 0.76 }`

## Verification Plan

Automated Tests:
- `npm run test`
- `npm run lint`
- `npm run build`
- `cd src-tauri && source "$HOME/.cargo/env" && cargo test`

Visual Capture:
- `CAPTURE_PHASE=3-calm-clarity CAPTURE_STEP=motion-clarity npm run capture`
- `front_day.png`, `gpu_front_day.png`, `clip_front_day.webm`를 최초 배포본 및 `phases/2-polish/captures/refine2/front_day.png`와 비교합니다.

Manual Verification:
- 60초 동안 물고기가 튀거나 급격히 꺾이지 않고 곡선으로 유영하는지 확인합니다.
- 베타는 느리게 활공하고, 테트라는 군영을 유지하되 떨림이 줄어드는지 확인합니다.
- day 모드는 밝고 또렷하지만 화면 전체가 납작한 민트색으로 뜨지 않아야 합니다.
- 비네팅과 그레인은 체감상 거의 사라져야 합니다.
- high usage 상태에서도 어항이 과하게 탁해지지 않아야 합니다.
