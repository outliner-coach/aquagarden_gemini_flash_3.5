// 인윈도우 메뉴 인터랙션 상태머신 — 호버 시 컨트롤이 드러나고, 우클릭/버튼으로
// 메뉴(팝오버)가 열린다. 무입력이 일정 시간 지나면 컨트롤이 사라져 어항만 남는다
// (UI_GUIDE Zen 지향). 타이머·DOM 과 분리한 순수 reducer — 단위 테스트 대상.

export interface MenuState {
  /** 호버로 드러난 컨트롤 클러스터(조명 토글·메뉴 버튼)의 표시 여부. */
  controlsVisible: boolean;
  /** 팝오버 메뉴(투명도·숨기기·종료 등)의 열림 여부. */
  menuOpen: boolean;
}

export type MenuEvent =
  | 'POINTER_ACTIVITY' // 창 위 포인터 진입/이동 → 컨트롤 깨어남
  | 'POINTER_LEAVE' // 창 밖으로 이탈
  | 'IDLE' // 무입력 타임아웃
  | 'OPEN_MENU'
  | 'CLOSE_MENU'
  | 'TOGGLE_MENU'
  | 'ESCAPE';

export const initialMenuState: MenuState = {
  controlsVisible: false,
  menuOpen: false,
};

/**
 * 메뉴 인터랙션 전이. 메뉴가 열려 있는 동안에는 무입력·이탈이 와도 컨트롤을
 * 숨기지 않는다(메뉴는 명시적으로 닫아야 사라짐). 그 외엔 호버로 깨어나고
 * 무입력/이탈로 잠든다.
 */
export function reduceMenu(state: MenuState, event: MenuEvent): MenuState {
  switch (event) {
    case 'POINTER_ACTIVITY':
      return state.controlsVisible ? state : { ...state, controlsVisible: true };

    case 'POINTER_LEAVE':
    case 'IDLE':
      // 메뉴가 열려 있으면 유지 — 사용자가 메뉴를 만지는 중일 수 있다.
      if (state.menuOpen) return state;
      return state.controlsVisible ? { ...state, controlsVisible: false } : state;

    case 'OPEN_MENU':
      return { controlsVisible: true, menuOpen: true };

    case 'TOGGLE_MENU':
      return state.menuOpen
        ? { ...state, menuOpen: false }
        : { controlsVisible: true, menuOpen: true };

    case 'CLOSE_MENU':
    case 'ESCAPE':
      // 메뉴만 닫고 컨트롤은 남겨둔다 — 곧 IDLE이 정리한다.
      return state.menuOpen ? { ...state, menuOpen: false } : state;

    default:
      return state;
  }
}
