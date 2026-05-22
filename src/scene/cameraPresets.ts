// 캡처용 고정 카메라 프리셋 — 정면 / 유목 클로즈업 / 전경 부감.
// 동일 시드 + 동일 프리셋 → 동일 프레임. 일반 실행에는 쓰이지 않는다(OrbitControls 사용).
// 좌표는 tank(24×14×11) 기준: 유목 그룹은 (-7.5, -4.5, -2), 바닥은 y≈-6.

export type CameraName = 'front' | 'driftwood' | 'foreground';

export interface CameraPreset {
  position: [number, number, number];
  target: [number, number, number];
}

export const cameraPresets: Record<CameraName, CameraPreset> = {
  // 정면 — 기본 감상 각도(기존 초기 카메라와 동일).
  front: { position: [0, 3, 22], target: [0, 0, 0] },
  // 유목 클로즈업 — 좌측 유목을 가까이서 비스듬히.
  driftwood: { position: [-3.5, 2, 11], target: [-7.5, -1.5, -2] },
  // 전경 부감 — 위에서 내려다보며 모래 둔덕·전경 수초를 담는다.
  foreground: { position: [0, 9.5, 9], target: [0, -4.5, 1] },
};
