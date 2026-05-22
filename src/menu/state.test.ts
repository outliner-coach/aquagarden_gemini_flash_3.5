import { describe, it, expect } from 'vitest';
import { reduceMenu, initialMenuState, type MenuState } from './state';

const open: MenuState = { controlsVisible: true, menuOpen: true };
const revealed: MenuState = { controlsVisible: true, menuOpen: false };

describe('reduceMenu', () => {
  it('초기 상태는 모두 숨김', () => {
    expect(initialMenuState).toEqual({ controlsVisible: false, menuOpen: false });
  });

  it('포인터 활동으로 컨트롤이 드러난다', () => {
    expect(reduceMenu(initialMenuState, 'POINTER_ACTIVITY')).toEqual(revealed);
  });

  it('무입력/이탈로 컨트롤이 사라진다(메뉴 닫힌 상태)', () => {
    expect(reduceMenu(revealed, 'IDLE')).toEqual(initialMenuState);
    expect(reduceMenu(revealed, 'POINTER_LEAVE')).toEqual(initialMenuState);
  });

  it('메뉴가 열려 있으면 무입력/이탈에도 사라지지 않는다', () => {
    expect(reduceMenu(open, 'IDLE')).toEqual(open);
    expect(reduceMenu(open, 'POINTER_LEAVE')).toEqual(open);
  });

  it('메뉴 열기는 컨트롤도 함께 켠다', () => {
    expect(reduceMenu(initialMenuState, 'OPEN_MENU')).toEqual(open);
  });

  it('토글은 열림↔닫힘을 뒤집는다', () => {
    expect(reduceMenu(revealed, 'TOGGLE_MENU')).toEqual(open);
    expect(reduceMenu(open, 'TOGGLE_MENU')).toEqual({ controlsVisible: true, menuOpen: false });
  });

  it('닫기/ESC는 메뉴만 닫고 컨트롤은 남긴다', () => {
    expect(reduceMenu(open, 'CLOSE_MENU')).toEqual(revealed);
    expect(reduceMenu(open, 'ESCAPE')).toEqual(revealed);
  });

  it('이미 닫힌 메뉴에 닫기/ESC는 무변화(동일 참조)', () => {
    expect(reduceMenu(revealed, 'CLOSE_MENU')).toBe(revealed);
    expect(reduceMenu(initialMenuState, 'ESCAPE')).toBe(initialMenuState);
  });
});
