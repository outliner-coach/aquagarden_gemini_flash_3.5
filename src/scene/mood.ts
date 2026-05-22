// 사용량 → 어항 무드 매핑(§6-2). 순수 함수로 두어 단위 테스트한다.
// 컨텍스트 점유율이 높아질수록 물이 탁해지고(포그↑) 물고기가 둔해진다(속도↓).

export interface SceneMood {
  /** 포그 밀도 배수 — 1=평소, >1=탁함. */
  fogDensityMul: number;
  /** 물고기 속도 배수 — 1=평소, <1=둔화. */
  fishSpeedMul: number;
}

const CALM: SceneMood = { fogDensityMul: 1, fishSpeedMul: 1 };

/**
 * 컨텍스트 점유율(%) → 어항 무드(§6-2).
 * - 한도 미상(null)·비정상 → 평온(CALM): 근거 없는 시각 변화를 만들지 않는다.
 * - 여유(<60) 평온 / 경고(60~80) 아주 약한 신호 / 임박(80~95) 완만한 탁함 / 한계(95+) 명확하지만 과하지 않은 신호.
 */
export function usageMood(pct: number | null): SceneMood {
  if (pct === null || !Number.isFinite(pct)) return CALM;
  if (pct >= 95) return { fogDensityMul: 1.32, fishSpeedMul: 0.76 };
  if (pct >= 80) return { fogDensityMul: 1.18, fishSpeedMul: 0.86 };
  if (pct >= 60) return { fogDensityMul: 1.08, fishSpeedMul: 0.94 };
  return CALM;
}
