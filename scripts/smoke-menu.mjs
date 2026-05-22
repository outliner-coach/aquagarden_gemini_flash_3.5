// 인윈도우 메뉴 DOM 스모크 — vite preview(비-Tauri)에서 메뉴 배선을 검증한다.
// 호버 드러남(컨트롤 클래스 토글), 우클릭/버튼 팝오버 열림, 투명도 슬라이더가
// 캔버스 opacity 에 반영되는지. Tauri invoke 는 비-Tauri 라 graceful 실패(무시).
//
// 사용: npm run build && node scripts/smoke-menu.mjs

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const PORT = 4319;

const LAUNCH_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--disable-gpu-sandbox',
  '--no-sandbox',
];

function assert(cond, msg) {
  if (!cond) throw new Error(`SMOKE FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function main() {
  const server = await preview({ root, preview: { port: PORT, strictPort: true } });
  const base = server.resolvedUrls?.local?.[0] ?? `http://localhost:${PORT}/`;
  const browser = await chromium.launch({ channel: 'chrome', args: LAUNCH_ARGS });
  try {
    const ctx = await browser.newContext({ viewport: { width: 480, height: 320 } });
    const page = await ctx.newPage();
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForSelector('#controls', { state: 'attached' });

    // 1) 평소엔 컨트롤이 숨겨져 있다(chrome-hidden).
    assert(
      await page.locator('#controls').evaluate((el) => el.classList.contains('chrome-hidden')),
      '초기엔 컨트롤이 숨겨져 있다',
    );

    // 2) 포인터 활동 시 컨트롤이 드러난다.
    await page.mouse.move(240, 160);
    await page.mouse.move(241, 161);
    await page.waitForFunction(
      () => !document.getElementById('controls')?.classList.contains('chrome-hidden'),
      { timeout: 2000 },
    );
    assert(true, '포인터 활동으로 컨트롤이 드러난다');

    // 3) 우클릭으로 팝오버가 열린다.
    await page.mouse.click(240, 160, { button: 'right' });
    await page.waitForSelector('#menu-popover:not(.hidden)', { timeout: 2000 });
    assert(true, '우클릭으로 메뉴 팝오버가 열린다');

    // 4) 투명도 슬라이더가 캔버스 opacity 에 반영된다.
    await page.locator('#opacity-slider').evaluate((el) => {
      el.value = '50';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const opacity = await page.locator('#webgl-canvas').evaluate((el) => el.style.opacity);
    assert(opacity === '0.5', `투명도 슬라이더(50%) → 캔버스 opacity=${opacity}`);
    const label = await page.locator('#opacity-value').textContent();
    assert(label === '50%', `투명도 라벨 갱신(${label})`);

    // 5) ESC 로 팝오버가 닫힌다(hidden 클래스 복귀).
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => document.getElementById('menu-popover')?.classList.contains('hidden') === true,
      { timeout: 2000 },
    );
    assert(true, 'ESC 로 팝오버가 닫힌다');

    // 6) 메뉴 버튼 클릭으로 다시 열린다. (idle 로 컨트롤이 잠들었을 수 있으니 먼저 깨운다)
    await page.mouse.move(200, 150);
    await page.mouse.move(202, 152);
    await page.waitForFunction(
      () => !document.getElementById('controls')?.classList.contains('chrome-hidden'),
      { timeout: 2000 },
    );
    await page.locator('#menu-button').click();
    await page.waitForSelector('#menu-popover:not(.hidden)', { timeout: 2000 });
    assert(true, '메뉴 버튼 클릭으로 팝오버가 열린다');

    // 7) 투과모드 토글 — 상태 라벨/aria 가 켜짐으로 바뀐다(invoke 는 비-Tauri 라 graceful).
    await page.locator('#menu-passthrough').click();
    await page.waitForFunction(
      () => document.getElementById('menu-passthrough')?.getAttribute('aria-checked') === 'true',
      { timeout: 2000 },
    );
    const ptState = await page.locator('#passthrough-state').textContent();
    assert(ptState === '켜짐', `투과모드 켜짐 라벨(${ptState})`);

    // 8) 투과모드 켜진 동안 컨트롤(⋯)은 계속 보인다(찾을 수 있게 핀).
    assert(
      await page.locator('#controls').evaluate((el) => !el.classList.contains('chrome-hidden')),
      '투과모드 중 ⋯ 컨트롤이 핀되어 보인다',
    );

    await ctx.close();
  } finally {
    await browser.close();
  }
  await new Promise((res) => server.httpServer.close(res));
  console.log('[smoke-menu] all passed');
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
