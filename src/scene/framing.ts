// 반응형 카메라 프레이밍 — 창 비율(aspect)에 따라 카메라 거리·타깃을 도출한다.
//
// 모델: ①바닥(기질)을 항상 화면 하단에 고정해 수초·하드스케이프가 빈 물 위로 뜨지
// 않게 하고, ②폭은 cover(채워서 크롭)로 처리한다. 좁을수록(세로) 양옆을 크롭해
// 식재부로 몰입하고, 넓을수록(가로 바) 폭을 꽉 채우며 높이를 얇게 크롭한다.
// 거리는 비율에 대해 단조 비증가 → 리사이즈가 매끄럽다. 결정론적 순수 함수.
// 실제 구도 미세조정(기준 영역·여백)은 AESTHETIC 캡처 게이트에서 판단한다 (ADR-010).

/** 카메라 수직 화각(도). main.ts PerspectiveCamera 와 동일해야 한다. */
export const FOV_DEG = 45;

const TAN_HALF_FOV = Math.tan((FOV_DEG * Math.PI) / 180 / 2);

// 수조 기준값 — src/scene/aquascape.ts (tankWidth 24 / tankHeight 14, 기질 y≈-7) 와 동기화.
// 화면을 채울 기준 폭(수초·하드스케이프 밀집부). 이보다 넓은 창이면 폭을 채우며 가까워진다.
const HERO_W = 20;
// 화면 하단에 고정할 기준선(기질 바로 아래, 모래가 살짝 보이도록 여유). 줌과 무관하게
// 뷰의 하단을 여기에 맞춰 기질이 항상 화면 바닥에 앉는다(빈 물 위로 뜨지 않게).
const FRAME_BOTTOM_Y = -7.3;
// 가로/정사각 기본 줌에서 보일 수직 범위(기질~수초 위 약간의 물).
const NORMAL_VISIBLE_H = 11;
// 매우 좁은(세로) 창에서 보일 수직 범위 — 더 작게 줄여 식재부로 줌인(몰입, 빈 물 최소화).
const TALL_VISIBLE_H = 7.5;
// 세로 줌인 보간이 TALL 에 도달하는 비율(이보다 좁으면 TALL 고정).
const A_TALL = 0.45;

// 기본 거리 — NORMAL_VISIBLE_H 가 화면 높이에 들어오는 거리. 가장 멀리(줌아웃) 가는 값.
const D_NORMAL = NORMAL_VISIBLE_H / (2 * TAN_HALF_FOV);

export const MIN_DISTANCE = 6;
export const MAX_DISTANCE = D_NORMAL;

export interface Framing {
  /** 타깃에서 카메라까지의 거리(뷰 레이 길이). */
  distance: number;
  /** 카메라가 바라보는 지점의 y — 거리에 따라 기질을 화면 하단에 고정하도록 도출. */
  targetY: number;
}

function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

/**
 * 비율별 목표 수직 가시범위. 가로·정사각(a≥1)은 NORMAL 고정, 세로(a<1)는 좁아질수록
 * TALL 까지 선형으로 줄여(줌인) 식재부를 화면 가득 채운다(빈 수주 최소화).
 */
function desiredVisibleH(a: number): number {
  if (a >= 1) return NORMAL_VISIBLE_H;
  const t = clamp((1 - a) / (1 - A_TALL), 0, 1);
  return NORMAL_VISIBLE_H + t * (TALL_VISIBLE_H - NORMAL_VISIBLE_H);
}

/**
 * 창 비율 → 카메라 프레이밍.
 * - 거리: 기준 폭(HERO_W) cover 거리와 목표 수직범위 cover 거리 중 더 가까운 쪽.
 *   넓을수록 폭이 결정(가까이, 폭 꽉 채움), 세로일수록 줌인해 식재부로 몰입.
 * - 타깃 y: 가시 높이를 바탕으로 기질(FRAME_BOTTOM_Y)을 항상 화면 하단에 고정.
 * 비정상 입력(0·음수·NaN)은 정사각(aspect=1)으로 폴백 — 어항은 멈추지 않는다.
 */
export function deriveFraming(aspect: number): Framing {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;

  const distanceFillWidth = HERO_W / (2 * TAN_HALF_FOV * a);
  const distanceFillHeight = desiredVisibleH(a) / (2 * TAN_HALF_FOV);
  const distance = clamp(
    Math.min(distanceFillWidth, distanceFillHeight),
    MIN_DISTANCE,
    MAX_DISTANCE,
  );

  // 가시 수직 절반 = distance * tan(fov/2). 하단을 FRAME_BOTTOM_Y 에 맞추도록 타깃을 올린다.
  const halfVisibleH = distance * TAN_HALF_FOV;
  const targetY = FRAME_BOTTOM_Y + halfVisibleH;

  return { distance, targetY };
}
