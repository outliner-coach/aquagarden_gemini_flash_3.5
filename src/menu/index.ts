import { reduceMenu, initialMenuState, type MenuState, type MenuEvent } from './state';

// 인윈도우 메뉴 마운트 — 호버 드러남 + 우클릭/버튼 팝오버를 DOM에 배선한다.
// 트레이가 노치에 가려도 어항에서 직접 메뉴(조명·투명도·투과모드·숨기기·종료)에 닿는다.
// 상태 전이는 순수 reduceMenu, 타이머·DOM·호버홀 리포팅은 여기서.

/** 메뉴가 호출하는 부수효과는 main 이 주입한다(창 제어는 Rust 경유). */
export interface MenuOptions {
  /** 투명도 변경(0~1). 캔버스 opacity 적용 + 영속화는 호출측 책임. */
  onOpacity: (value: number) => void;
  /** 초기 투명도(0~1). 슬라이더 초기값. */
  initialOpacity: number;
  /** "잠깐 숨기기" — 창을 ⋯ 퍽으로 접기. */
  onCollapse: () => void;
  /** "종료" — 앱 종료. */
  onQuit: () => void;
  /** 투과모드 토글(on/off). */
  onPassthrough: (enabled: boolean) => void;
  /** ⋯ 영역(호버홀) 사각형을 Rust에 보고. 투과모드에서 이 영역만 클릭 가능. */
  reportHole: (x: number, y: number, w: number, h: number) => void;
}

export interface MenuController {
  destroy: () => void;
}

// 무입력 후 컨트롤을 숨기기까지의 시간(ms).
const IDLE_MS = 2500;

function getEl<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

export function mountMenu(opts: MenuOptions): MenuController {
  const controls = getEl('controls');
  const menuButton = getEl<HTMLButtonElement>('menu-button');
  const popover = getEl('menu-popover');
  const hud = getEl('hud-overlay');
  const slider = getEl<HTMLInputElement>('opacity-slider');
  const opacityValue = getEl('opacity-value');
  const passthroughBtn = getEl<HTMLButtonElement>('menu-passthrough');
  const passthroughState = getEl('passthrough-state');
  const hideBtn = getEl<HTMLButtonElement>('menu-hide');
  const quitBtn = getEl<HTMLButtonElement>('menu-quit');

  if (!controls || !menuButton || !popover) {
    return { destroy: () => {} };
  }

  let state: MenuState = initialMenuState;
  let passthroughOn = false;
  let idleTimer: number | undefined;

  // 투과모드일 때만 의미 있는 호버홀 사각형: 메뉴가 열려 있으면 ⋯+팝오버를 함께 덮고,
  // 닫혀 있으면 ⋯ 버튼만(여유 패딩). 좌표는 창 내부 논리좌표(getBoundingClientRect).
  const reportHoleNow = (): void => {
    const r = menuButton.getBoundingClientRect();
    if (state.menuOpen && !popover.classList.contains('hidden')) {
      const p = popover.getBoundingClientRect();
      const x = Math.min(r.left, p.left);
      const y = Math.min(r.top, p.top);
      opts.reportHole(x, y, Math.max(r.right, p.right) - x, Math.max(r.bottom, p.bottom) - y);
    } else {
      const pad = 6;
      opts.reportHole(r.left - pad, r.top - pad, r.width + 2 * pad, r.height + 2 * pad);
    }
  };

  const render = (): void => {
    // 투과모드면 ⋯ 를 찾을 수 있게 컨트롤을 항상 띄운다.
    const visible = state.controlsVisible || passthroughOn;
    controls.classList.toggle('chrome-hidden', !visible);
    hud?.classList.toggle('hud-bright', visible);
    if (state.menuOpen) {
      popover.classList.remove('hidden');
      popover.classList.add('flex');
    } else {
      popover.classList.add('hidden');
      popover.classList.remove('flex');
    }
    requestAnimationFrame(reportHoleNow);
  };

  const dispatch = (event: MenuEvent): void => {
    const next = reduceMenu(state, event);
    if (next !== state) {
      state = next;
      render();
    }
  };

  const armIdle = (): void => {
    window.clearTimeout(idleTimer);
    if (passthroughOn) return; // 투과모드에선 ⋯ 를 계속 보이게 둔다.
    idleTimer = window.setTimeout(() => dispatch('IDLE'), IDLE_MS);
  };

  const positionPopover = (left: number, top: number): void => {
    const margin = 8;
    const w = popover.offsetWidth || 208;
    const h = popover.offsetHeight || 160;
    const x = Math.max(margin, Math.min(left, window.innerWidth - w - margin));
    const y = Math.max(margin, Math.min(top, window.innerHeight - h - margin));
    popover.style.right = 'auto';
    popover.style.left = `${x}px`;
    popover.style.top = `${y}px`;
  };

  const anchorToButton = (): void => {
    const r = menuButton.getBoundingClientRect();
    const w = popover.offsetWidth || 208;
    positionPopover(r.right - w, r.bottom + 6);
  };

  // --- 리스너 ---
  const onActivity = (): void => {
    dispatch('POINTER_ACTIVITY');
    armIdle();
  };
  const onPointerLeave = (): void => {
    if (!state.menuOpen) dispatch('POINTER_LEAVE');
  };
  const onMenuButtonClick = (e: MouseEvent): void => {
    e.stopPropagation();
    const willOpen = !state.menuOpen;
    dispatch('TOGGLE_MENU');
    if (willOpen) {
      anchorToButton();
      requestAnimationFrame(reportHoleNow);
    }
    armIdle();
  };
  const onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
    dispatch('OPEN_MENU');
    positionPopover(e.clientX, e.clientY);
    requestAnimationFrame(reportHoleNow);
    armIdle();
  };
  const onDocPointerDown = (e: MouseEvent): void => {
    if (!state.menuOpen) return;
    const t = e.target as Node;
    if (!popover.contains(t) && t !== menuButton && !menuButton.contains(t)) {
      dispatch('CLOSE_MENU');
    }
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') dispatch('ESCAPE');
  };
  const onSliderInput = (): void => {
    if (!slider) return;
    const pct = Number(slider.value);
    const value = (Number.isFinite(pct) ? pct : 100) / 100;
    if (opacityValue) opacityValue.textContent = `${Math.round(value * 100)}%`;
    opts.onOpacity(value);
    armIdle();
  };
  const onPassthroughClick = (): void => {
    passthroughOn = !passthroughOn;
    passthroughBtn?.setAttribute('aria-checked', String(passthroughOn));
    if (passthroughState) {
      passthroughState.textContent = passthroughOn ? '켜짐' : '꺼짐';
      passthroughState.classList.toggle('text-emerald-400', passthroughOn);
      passthroughState.classList.toggle('border-emerald-400/40', passthroughOn);
      passthroughState.classList.toggle('text-slate-500', !passthroughOn);
    }
    // §4-5: 투과 활성 시 ⋯ 트리거를 에메랄드로 빛나게 — 투과/입력수신 상태를 한눈에 구분.
    menuButton.classList.toggle('text-emerald-400', passthroughOn);
    menuButton.classList.toggle('menu-passthrough-on', passthroughOn);
    menuButton.classList.toggle('text-slate-300', !passthroughOn);
    opts.onPassthrough(passthroughOn);
    if (passthroughOn) dispatch('POINTER_ACTIVITY'); // ⋯ 를 띄워 둔다.
    else render();
    requestAnimationFrame(reportHoleNow);
    armIdle();
  };
  const onCollapseClick = (): void => {
    dispatch('CLOSE_MENU');
    opts.onCollapse();
  };
  const onQuitClick = (): void => opts.onQuit();
  const onResize = (): void => {
    requestAnimationFrame(reportHoleNow);
  };

  // 초기 투명도 슬라이더 동기화.
  if (slider) {
    const initPct = Math.round(opts.initialOpacity * 100);
    slider.value = String(initPct);
    if (opacityValue) opacityValue.textContent = `${initPct}%`;
  }

  window.addEventListener('pointermove', onActivity, { passive: true });
  window.addEventListener('pointerdown', onActivity, { passive: true });
  document.documentElement.addEventListener('mouseleave', onPointerLeave);
  menuButton.addEventListener('click', onMenuButtonClick);
  window.addEventListener('contextmenu', onContextMenu);
  document.addEventListener('pointerdown', onDocPointerDown);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', onResize);
  slider?.addEventListener('input', onSliderInput);
  passthroughBtn?.addEventListener('click', onPassthroughClick);
  hideBtn?.addEventListener('click', onCollapseClick);
  quitBtn?.addEventListener('click', onQuitClick);

  render();

  return {
    destroy: () => {
      window.clearTimeout(idleTimer);
      window.removeEventListener('pointermove', onActivity);
      window.removeEventListener('pointerdown', onActivity);
      document.documentElement.removeEventListener('mouseleave', onPointerLeave);
      menuButton.removeEventListener('click', onMenuButtonClick);
      window.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('pointerdown', onDocPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      slider?.removeEventListener('input', onSliderInput);
      passthroughBtn?.removeEventListener('click', onPassthroughClick);
      hideBtn?.removeEventListener('click', onCollapseClick);
      quitBtn?.removeEventListener('click', onQuitClick);
    },
  };
}
