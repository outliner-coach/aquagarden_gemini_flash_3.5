import type { UsageSnapshot } from '../types/usage';

// HUD 표시값 파생 — DOM 렌더와 분리한 순수 함수로 두어 단위 테스트한다.

/** HUD가 그릴 표시값. */
export interface HudView {
  /** 사용량 데이터 유무. false면 '데이터 없음'으로 표시한다. */
  hasData: boolean;
  /** 컨텍스트 점유율 라벨("21.6%" 또는 한도 미상 시 "—"). */
  contextLabel: string;
  /** 게이지 채움 폭(0~100). 한도 미상이면 0. */
  gaugeWidth: number;
  /** 컨텍스트 토큰 수치 라벨(천단위 구분 또는 "—"). */
  tokensLabel: string;
}

const EMPTY: HudView = {
  hasData: false,
  contextLabel: '—',
  gaugeWidth: 0,
  tokensLabel: '—',
};

function clampPct(pct: number): number {
  if (pct < 0) return 0;
  if (pct > 100) return 100;
  return pct;
}

/** 천단위 구분 정수 포맷(tabular-nums 가정, 로케일 고정). 비정상 입력은 "—". */
export function formatTokens(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—';
  return Math.round(n).toLocaleString('en-US');
}

/**
 * 스냅샷 → HUD 표시값.
 * - 스냅샷 없음 또는 모델 미상(model null) → 데이터 없음(전부 "—").
 * - 한도 미상(context_pct null) → 토큰은 표시하되 게이지/% 는 "—".
 */
export function deriveHudView(snapshot: UsageSnapshot | null): HudView {
  if (snapshot === null || snapshot.model === null) {
    return EMPTY;
  }

  const tokensLabel = formatTokens(snapshot.context_tokens);
  const pct = snapshot.context_pct;
  if (pct === null || !Number.isFinite(pct)) {
    return { hasData: true, contextLabel: '—', gaugeWidth: 0, tokensLabel };
  }

  return {
    hasData: true,
    contextLabel: `${pct.toFixed(1)}%`,
    gaugeWidth: clampPct(pct),
    tokensLabel,
  };
}
