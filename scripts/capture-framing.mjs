// 반응형 프레이밍 게이트 캡처 — 'front' 카메라를 여러 창 비율(가로 바·정사각·세로 패널)
// 에서 결정론적으로 찍어 deriveFraming 의 구도를 검증한다(ADR-010 게이트1·2 입력).
//
// 사용: npm run build && node scripts/capture-framing.mjs
// 출력: phases/0-mvp/captures/framing/{name}_{w}x{h}.png

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const OUT_DIR = resolve(root, 'phases/0-mvp/captures/framing');

const SEED = 1337;
const MODE = 'day';
const PORT = 4318;

// 실제 위젯이 가질 법한 창 형태들. (가로 바 / 기본 / 정사각 / 세로 패널 / 세로 좁은)
const SHAPES = [
  { name: 'wide-bar', width: 960, height: 240 },
  { name: 'landscape', width: 480, height: 320 },
  { name: 'near-square', width: 380, height: 360 },
  { name: 'portrait', width: 320, height: 560 },
  { name: 'tall', width: 300, height: 680 },
];

const LAUNCH_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--disable-gpu-sandbox',
  '--no-sandbox',
  '--hide-scrollbars',
];

function urlFor(base, params) {
  const qs = new URLSearchParams({ capture: '1', seed: String(SEED), ...params }).toString();
  return `${base.replace(/\/$/, '')}/?${qs}`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const server = await preview({ root, preview: { port: PORT, strictPort: true } });
  const base = server.resolvedUrls?.local?.[0] ?? `http://localhost:${PORT}/`;
  console.log(`[framing] preview at ${base}`);

  const browser = await chromium.launch({ channel: 'chrome', args: LAUNCH_ARGS });
  try {
    for (const shape of SHAPES) {
      const ctx = await browser.newContext({
        viewport: { width: shape.width, height: shape.height },
        deviceScaleFactor: 1,
      });
      const page = await ctx.newPage();
      await page.goto(urlFor(base, { camera: 'front', mode: MODE }), { waitUntil: 'load' });
      await page.waitForFunction(() => window.__captureReady === true, { timeout: 30000 });
      const file = resolve(OUT_DIR, `${shape.name}_${shape.width}x${shape.height}.png`);
      await page.screenshot({ path: file });
      console.log(`[framing] ${shape.name}_${shape.width}x${shape.height}.png`);
      await ctx.close();
    }
  } finally {
    await browser.close();
  }

  await new Promise((res) => server.httpServer.close(res));
  console.log(`[framing] done → ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
