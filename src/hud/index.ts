import type { UsageStore } from '../usage/store';
import { deriveHudView } from './view';

// 사용량 HUD 오버레이 — usage 스토어를 구독해 컨텍스트%·토큰을 곁눈질로 읽히게 표시한다.
// 마크업은 index.html(#hud-overlay)에 있고, 여기서는 값만 갱신한다(UI는 반응형).

/**
 * HUD를 스토어에 연결한다. 스토어 변경 시 게이지·수치를 갱신하고,
 * 데이터 없음(스냅샷 없음·모델 미상)이면 게이지 대신 "—"를 표시한다 (ADR-009).
 * 필요한 DOM이 없으면 조용히 무시한다 — 어항은 멈추지 않는다.
 */
export function mountHud(store: UsageStore): void {
  const pctEl = document.getElementById('hud-context-pct');
  const barEl = document.getElementById('hud-context-bar');
  const tokensEl = document.getElementById('hud-tokens');
  if (!pctEl || !barEl || !tokensEl) return;

  const render = (): void => {
    const view = deriveHudView(store.snapshot);
    pctEl.textContent = view.contextLabel;
    tokensEl.textContent = view.tokensLabel;
    barEl.style.width = `${view.gaugeWidth}%`;
  };

  render();
  store.subscribe(render);
}
