// 결정론적 시각 캡처 — 시드 고정 + 카메라 프리셋(3) × 조명 모드(3) = 9장 스크린샷
// + 짧은 클립(front/day). 빌드 산출물(dist)을 vite preview로 서빙하고 Playwright
// (시스템 캐시 chromium, SwiftShader 소프트웨어 렌더)로 헤드리스 캡처한다.
//
// 사용: npm run build && npm run capture
// 출력: phases/0-mvp/captures/step6/{camera}_{mode}.png, clip_front_day.webm

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const OUT_DIR = resolve(root, 'phases/0-mvp/captures/step6');

const SEED = 1337;
const CAMERAS = ['front', 'driftwood', 'foreground'];
const MODES = ['day', 'dusk', 'night'];
const VIEWPORT = { width: 1280, height: 800 };
const PORT = 4317;

// SwiftShader 소프트웨어 렌더로 강제해 실행 간(run-to-run) 결정론을 확보한다.
const LAUNCH_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--disable-gpu-sandbox',
  '--no-sandbox',
  '--hide-scrollbars',
];

// 실제 GPU 경로(SwiftShader 강제 해제) — postFX(Bloom·코스틱·갓레이)가 실 GPU에서
// 어떻게 나오는지 검증용 1장. 결정론은 보장 안 됨(GPU별 차이) → 검증 보조 산출물.
const GPU_LAUNCH_ARGS = [
  '--use-angle=metal',
  '--ignore-gpu-blocklist',
  '--enable-gpu',
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
  console.log(`[capture] preview at ${base}`);

  // 시스템에 설치된 Google Chrome 사용(채널). 별도 브라우저 다운로드 불필요.
  const browser = await chromium.launch({ channel: 'chrome', args: LAUNCH_ARGS });
  try {
    // --- 9장 정지 스크린샷 ---
    const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    for (const camera of CAMERAS) {
      for (const mode of MODES) {
        await page.goto(urlFor(base, { camera, mode }), { waitUntil: 'load' });
        await page.waitForFunction(() => window.__captureReady === true, { timeout: 30000 });
        const file = resolve(OUT_DIR, `${camera}_${mode}.png`);
        await page.screenshot({ path: file });
        console.log(`[capture] ${camera}_${mode}.png`);
      }
    }
    await ctx.close();

    // --- 짧은 클립 (front/day, ~5초) — 영상 녹화는 best-effort(스크린샷이 핵심 AC) ---
    try {
      const clipCtx = await browser.newContext({
        viewport: VIEWPORT,
        recordVideo: { dir: OUT_DIR, size: VIEWPORT },
      });
      const clipPage = await clipCtx.newPage();
      await clipPage.goto(urlFor(base, { camera: 'front', mode: 'day', clip: '1' }), { waitUntil: 'load' });
      await clipPage.waitForFunction(() => window.__captureReady === true, { timeout: 30000 });
      await clipPage.waitForTimeout(5000);
      const video = clipPage.video();
      await clipCtx.close();
      if (video) {
        await video.saveAs(resolve(OUT_DIR, 'clip_front_day.webm'));
        await video.delete();
        console.log('[capture] clip_front_day.webm');
      }
    } catch (err) {
      console.warn(`[capture] clip skipped: ${err?.message ?? err}`);
    }
  } finally {
    await browser.close();
  }

  // --- 실제 GPU 스크린샷 1장 (front/day) — SwiftShader 강제 해제 경로 ---
  try {
    const gpuBrowser = await chromium.launch({ channel: 'chrome', args: GPU_LAUNCH_ARGS });
    try {
      const gpuCtx = await gpuBrowser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
      const gpuPage = await gpuCtx.newPage();
      await gpuPage.goto(urlFor(base, { camera: 'front', mode: 'day' }), { waitUntil: 'load' });
      await gpuPage.waitForFunction(() => window.__captureReady === true, { timeout: 30000 });
      await gpuPage.screenshot({ path: resolve(OUT_DIR, 'gpu_front_day.png') });
      console.log('[capture] gpu_front_day.png');
      await gpuCtx.close();
    } finally {
      await gpuBrowser.close();
    }
  } catch (err) {
    console.warn(`[capture] gpu shot skipped: ${err?.message ?? err}`);
  }

  await new Promise((res) => server.httpServer.close(res));

  console.log(`[capture] done → ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
