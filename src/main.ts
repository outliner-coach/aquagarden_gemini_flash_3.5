import './styles.css';
import * as THREE from 'three';
import { buildAquascape, animatePlants, animateBubbles, tankHeight } from './scene/aquascape';
import { Lighting, colors, type LightMode } from './scene/lighting';
import { spawnFauna } from './scene/fauna/fish';
import { createGodRays } from './scene/godrays';
import { setupRenderer, createPostFX } from './scene/postfx';
import { seedRng } from './lib/rng';
import { cameraPresets, type CameraName } from './scene/cameraPresets';
import { deriveFraming } from './scene/framing';
import { createUsageStore, startUsageSubscription } from './usage/store';
import { mountHud } from './hud';
import { mountMenu } from './menu';
import {
  startWindowDrag,
  startWindowResize,
  collapseWindow,
  restoreWindow,
  setPassthrough,
  updatePassthroughHole,
  quitApp,
  type ResizeDir,
} from './window';
import { getSetting, setSetting } from './settings';
import type { UsageSnapshot } from './types/usage';

// 씬/카메라/렌더러/OrbitControls 초기화 + animate 루프 + 클릭 명언 배선.
// 기존 index.html의 initScene·animate·triggerQuote 를 동작 보존으로 이식.

// 캡처 스크립트(Playwright)가 결정론적 프레임 준비 완료를 감지하는 플래그.
declare global {
  interface Window {
    __captureReady?: boolean;
  }
}

// 캡처 모드 설정 — `?capture=1&seed=&camera=&mode=&clip=` URL 파라미터로 구동.
// 일반 실행에는 영향 없음(파라미터 없으면 null).
interface CaptureConfig {
  seed: number;
  camera: CameraName;
  mode: LightMode;
  clip: boolean;
}

function readCaptureConfig(): CaptureConfig | null {
  const p = new URLSearchParams(window.location.search);
  if (p.get('capture') !== '1') return null;
  const seed = Number.parseInt(p.get('seed') ?? '1', 10);
  return {
    seed: Number.isFinite(seed) ? seed : 1,
    camera: (p.get('camera') ?? 'front') as CameraName,
    mode: (p.get('mode') ?? 'day') as LightMode,
    clip: p.get('clip') === '1',
  };
}

// --- 물고기 대사 (물고기 클릭 시, 작고 사색적인 한마디) ---
// 종(種)별 성격에 맞춘 편안하고 사색적인 톤. 클릭마다 무작위로 한 줄.
const fishLines: Record<string, string[]> = {
  betta: [
    '천천히 헤엄쳐도 괜찮아. 물은 어디로도 도망가지 않으니까.',
    '혼자라는 건 외로움이 아니라, 나를 가만히 들여다보는 시간이야.',
    '지느러미를 활짝 펴는 데엔 이유가 없어. 그저 오늘이 좋아서.',
  ],
  tetra: [
    '함께 헤엄치면, 무서운 것도 조금은 작아져.',
    '작은 빛이라도 모이면 강이 되는걸.',
    '서두르지 않아도 돼. 다 같이 가면 되니까.',
  ],
  corydoras: [
    '바닥에도 볕은 들어. 천천히 살아도 충분해.',
    '남이 보지 않는 곳을 돌보는 일에도 조용한 기쁨이 있어.',
    '오늘은 모래알을 세며 쉬어가는 날.',
  ],
};

function getEl<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

let fishLineTimer: number | undefined;

function triggerFishLine(type: string): void {
  const box = getEl('fish-line');
  const txt = getEl('fish-line-text');
  if (!box || !txt) return;

  const group = fishLines[type];
  if (!group) return;
  const line = group[Math.floor(Math.random() * group.length)];
  if (!line) return;

  txt.innerText = line;
  box.classList.remove('chrome-hidden');

  // 잠시 보였다 조용히 사라진다(상주 chrome 최소화).
  window.clearTimeout(fishLineTimer);
  fishLineTimer = window.setTimeout(() => closeFishLine(), 6000);
}

function closeFishLine(): void {
  window.clearTimeout(fishLineTimer);
  getEl('fish-line')?.classList.add('chrome-hidden');
}

// --- 조명 모드 버튼 UI 상태 ---
const ACTIVE_BTN = 'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors bg-emerald-500 text-slate-950';
const IDLE_BTN = 'px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-300 hover:bg-slate-700/50 transition-colors';

const LIGHT_KEY = 'lightMode';

function setLightMode(lighting: Lighting, mode: LightMode, persist = true): void {
  lighting.setMode(mode);
  (['day', 'dusk', 'night'] as const).forEach((m) => {
    const btn = getEl(`btn-${m}`);
    if (btn) btn.className = m === mode ? ACTIVE_BTN : IDLE_BTN;
  });
  if (persist) void setSetting(LIGHT_KEY, mode);
}

// 캡처 모드에서 chrome(로딩·HUD 오버레이)을 숨겨 순수한 씬만 캡처한다.
function hideChrome(): void {
  getEl('loading')?.remove();
  const overlay = getEl('ui-overlay');
  if (overlay) overlay.style.display = 'none';
}

function applyCameraPreset(camera: THREE.PerspectiveCamera, name: CameraName): void {
  const preset = cameraPresets[name] ?? cameraPresets.front;
  camera.position.set(...preset.position);
  camera.lookAt(new THREE.Vector3(...preset.target));
  camera.updateProjectionMatrix();
}

// 창 비율에 맞춰 카메라 거리/타깃을 재설정한다(가로=전체 폭, 세로=높이 채워 크롭).
// 정면 고정 시점 — 좌드래그는 창 이동에 쓰므로 수동 회전(OrbitControls)은 두지 않는다.
const _target = new THREE.Vector3();
const _dir = new THREE.Vector3();
function frameCamera(camera: THREE.PerspectiveCamera, aspect: number): void {
  const { distance, targetY } = deriveFraming(aspect);
  _target.set(0, targetY, 0);
  _dir.copy(camera.position).sub(_target);
  if (_dir.lengthSq() < 1e-6) _dir.set(0, 3, 22);
  _dir.normalize();
  camera.position.copy(_target).addScaledVector(_dir, distance);
  camera.lookAt(_target);
  camera.updateProjectionMatrix();
}

// 위젯 투명도 — 투명 창 위에서 캔버스 자체의 opacity 를 낮추면 바탕화면이 비쳐
// 앰비언트하게 가라앉는다(렌더러 손대지 않음). 0.25~1.0 로 클램프.
const OPACITY_KEY = 'opacity';
function applyOpacity(canvas: HTMLCanvasElement, value: number): void {
  const v = Number.isFinite(value) ? Math.min(1, Math.max(0.25, value)) : 1;
  canvas.style.opacity = String(v);
}

// 캡처 결정론을 위한 고정 타임스텝 워밍업 — 동일 시드 + 동일 스텝 → 동일 프레임.
const CAPTURE_FIXED_DELTA = 1 / 60;
const CAPTURE_WARMUP_STEPS = 300;

// 캡처 모드에서 HUD에 주입할 고정 스냅샷(결정론) — 라이트 게이트가 HUD 룩을 검토한다.
// 실데이터(Tauri 이벤트)는 캡처 환경에 없으므로 대표값을 고정한다.
const CAPTURE_SNAPSHOT: UsageSnapshot = {
  context_tokens: 216_000,
  context_limit: 1_000_000,
  context_pct: 21.6,
  cumulative_output_tokens: 48_500,
  model: 'claude-opus-4-7',
};

function init(): void {
  const canvas = getEl<HTMLCanvasElement>('webgl-canvas');
  if (!canvas) return;

  const capture = readCaptureConfig();

  // 캡처 모드는 씬 구성 전에 시드를 고정한다(난수 그리기 순서가 동일해야 결정론).
  if (capture) seedRng(capture.seed);

  // Scene
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(colors.day.fog, 0.045);

  // Camera
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 3, 22);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(colors.day.bg);
  setupRenderer(renderer); // 시네마틱 색관리(ACESFilmic 톤매핑 + sRGB)

  // Lighting / scene contents
  const lighting = new Lighting(scene, tankHeight);
  const aquascape = buildAquascape(scene);
  const fishList = spawnFauna(scene);
  createGodRays(scene); // 상단 광원에서 떨어지는 미세한 빛줄기(정적)

  // 시네마틱 포스트프로세싱(은은한 Bloom + DoF + 톤매핑 마감). 캡처·일반 경로 공통.
  const postfx = createPostFX(renderer, scene, camera);

  // --- 캡처 모드: 고정 카메라 프리셋 + 결정론적 프레임. 입력/컨트롤 없음. ---
  if (capture) {
    hideChrome();
    applyCameraPreset(camera, capture.camera);
    // 'front'는 반응형 프레이밍 게이트 대상 — 캡처 viewport 비율에 맞춰 재프레이밍.
    // 프리셋 클로즈업(driftwood/foreground)은 아트 디렉션이라 그대로 둔다.
    if (capture.camera === 'front') {
      frameCamera(camera, window.innerWidth / window.innerHeight);
    }
    lighting.setMode(capture.mode);

    // HUD는 #hud-overlay(별도 컨테이너)라 hideChrome 대상이 아니다 — 캡처에 함께 찍혀
    // 라이트 게이트가 어항 위 HUD 룩을 검토할 수 있다. 고정 스냅샷으로 결정론 유지.
    const captureStore = createUsageStore();
    mountHud(captureStore);
    captureStore.setSnapshot(CAPTURE_SNAPSHOT);

    if (capture.clip) {
      // 클립: 시드·프리셋 고정 상태에서 실시간 모션 재생(영상 녹화용).
      const clock = new THREE.Clock();
      const renderClip = (): void => {
        requestAnimationFrame(renderClip);
        const delta = clock.getDelta();
        const time = clock.getElapsedTime();
        lighting.update(renderer, scene, time);
        animatePlants(aquascape.animatedPlants, time);
        animateBubbles(aquascape.bubbles, delta, time);
        fishList.forEach((fish) => fish.update(delta, time, fishList));
        postfx.render();
      };
      renderClip();
      window.__captureReady = true;
      return;
    }

    // 정지 프레임: 고정 타임스텝으로 워밍업(조명 lerp 정착 + 모션 진행)한 뒤 1회 렌더.
    let t = 0;
    for (let i = 0; i < CAPTURE_WARMUP_STEPS; i++) {
      t += CAPTURE_FIXED_DELTA;
      lighting.update(renderer, scene, t);
      animatePlants(aquascape.animatedPlants, t);
      animateBubbles(aquascape.bubbles, CAPTURE_FIXED_DELTA, t);
      fishList.forEach((fish) => fish.update(CAPTURE_FIXED_DELTA, t, fishList));
    }
    postfx.render();
    window.__captureReady = true;
    return;
  }

  // --- 일반 실행: 정면 고정 카메라 + 드래그 이동/리사이즈 + 클릭 물고기 대사 + rAF 루프 ---
  // 시작 시 현재 창 비율에 맞춰 프레이밍(가로/세로 대응).
  frameCamera(camera, window.innerWidth / window.innerHeight);

  // 클릭 대상은 물고기뿐 — 클릭하면 그 물고기의 작은 대사를 보여준다.
  const fishObjects: THREE.Object3D[] = fishList.map((f) => f.group);

  setLightMode(lighting, 'day', false);
  // 저장된 조명 모드 복원(없으면 day 유지). 비-Tauri 환경은 조용히 무시.
  void getSetting<LightMode>(LIGHT_KEY).then((saved) => {
    if (saved === 'day' || saved === 'dusk' || saved === 'night') {
      setLightMode(lighting, saved, false);
    }
  });

  // --- 인윈도우 메뉴(호버/우클릭) + 투명도 — 트레이가 노치에 가려도 닿는 컨트롤 표면 ---
  let opacity = 1;
  void getSetting<number>(OPACITY_KEY).then((saved) => {
    if (typeof saved === 'number' && Number.isFinite(saved)) {
      opacity = Math.min(1, Math.max(0.25, saved));
      applyOpacity(canvas, opacity);
    }
  });
  mountMenu({
    initialOpacity: opacity,
    onOpacity: (value) => {
      applyOpacity(canvas, value);
      void setSetting(OPACITY_KEY, value);
    },
    onCollapse: () => {
      // "잠깐 숨기기" — 어항을 작은 ⋯ 퍽으로 접는다(창은 Rust가 축소·복귀).
      document.body.classList.add('collapsed');
      void collapseWindow();
    },
    onQuit: () => void quitApp(),
    onPassthrough: (enabled) => void setPassthrough(enabled),
    reportHole: (x, y, w, h) => void updatePassthroughHole(x, y, w, h),
  });

  // 접힌 ⋯ 퍽 클릭 → 어항 복귀.
  getEl('puck')?.addEventListener('click', () => {
    document.body.classList.remove('collapsed');
    void restoreWindow();
  });

  // 사용량 HUD — Rust(usage.rs)의 'usage://snapshot' 이벤트만 구독한다(FS 접근 없음).
  // 구독 시작 실패(비-Tauri 환경)는 무시 — 어항은 멈추지 않는다.
  const usageStore = createUsageStore();
  mountHud(usageStore);
  void startUsageSubscription(usageStore);

  // 조명 버튼 배선
  (['day', 'dusk', 'night'] as const).forEach((m) => {
    getEl(`btn-${m}`)?.addEventListener('click', () => setLightMode(lighting, m));
  });

  // 가장자리/모서리 그립 → 네이티브 리사이즈(Rust 경유).
  document.querySelectorAll<HTMLElement>('.resize-grip').forEach((grip) => {
    grip.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const dir = grip.dataset.resize as ResizeDir | undefined;
      if (dir) void startWindowResize(dir);
    });
  });

  // 좌클릭 드래그=창 이동, 단순 클릭=물고기 대사. (chrome/그립/퍽 위는 제외)
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const DRAG_THRESHOLD = 5;
  let downAt: { x: number; y: number } | null = null;
  let dragging = false;

  const onBackground = (el: HTMLElement | null): boolean =>
    !el ||
    !(
      el.closest('#controls') ||
      el.closest('#menu-popover') ||
      el.closest('.resize-grip') ||
      el.closest('#puck')
    );

  window.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    if (!onBackground(event.target as HTMLElement | null)) return;
    downAt = { x: event.clientX, y: event.clientY };
    dragging = false;
  });

  window.addEventListener('pointermove', (event) => {
    if (!downAt || dragging) return;
    if (Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > DRAG_THRESHOLD) {
      dragging = true;
      void startWindowDrag(); // OS가 창 이동을 인계받는다.
    }
  });

  window.addEventListener('pointerup', (event) => {
    const started = downAt;
    const wasDrag = dragging;
    downAt = null;
    dragging = false;
    if (!started || wasDrag || event.button !== 0) return;
    if (!onBackground(event.target as HTMLElement | null)) return;

    // 단순 클릭 → 물고기 raycast.
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(fishObjects, true);
    if (hits.length > 0) {
      let obj: THREE.Object3D | null = hits[0].object;
      while (obj && !obj.userData.interactiveType) obj = obj.parent;
      if (obj && obj.userData.interactiveType) {
        triggerFishLine(obj.userData.interactiveType as string);
        return;
      }
    }
    closeFishLine();
  });

  // Resize — 비율 갱신 + 반응형 재프레이밍(가로/세로 대응).
  window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    frameCamera(camera, aspect);
    renderer.setSize(window.innerWidth, window.innerHeight);
    postfx.setSize(window.innerWidth, window.innerHeight);
  });

  // Render loop
  const clock = new THREE.Clock();
  function animate(): void {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();

    lighting.update(renderer, scene, time);
    animatePlants(aquascape.animatedPlants, time);
    animateBubbles(aquascape.bubbles, delta, time);
    fishList.forEach((fish) => fish.update(delta, time, fishList));

    postfx.render();
  }
  animate();

  // 로딩 화면 페이드아웃
  window.setTimeout(() => {
    const loader = getEl('loading');
    if (!loader) return;
    loader.classList.add('opacity-0');
    window.setTimeout(() => loader.remove(), 1000);
  }, 800);
}

window.addEventListener('load', init);
