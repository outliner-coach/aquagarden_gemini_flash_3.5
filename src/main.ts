import './styles.css';
import * as THREE from 'three';
import { buildAquascape, animatePlants, animateBubbles, tankHeight } from './scene/aquascape';
import { Lighting, colors, type LightMode } from './scene/lighting';
import { spawnFauna } from './scene/fauna/fish';
import { createGodRays } from './scene/godrays';
import { setupRenderer, createPostFX } from './scene/postfx';
import { seedRng } from './lib/rng';
import { cameraPresets, type CameraName } from './scene/cameraPresets';
import { deriveFraming, maxCoverDistance, targetYForDistance, MIN_DISTANCE } from './scene/framing';
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

// 대사를 띄운 물고기 — 말풍선이 매 프레임 이 물고기 머리 위를 따라다닌다.
let activeFishGroup: THREE.Object3D | null = null;
const _fishLineProj = new THREE.Vector3();

function triggerFishLine(type: string, group: THREE.Object3D): void {
  const box = getEl('fish-line');
  const txt = getEl('fish-line-text');
  if (!box || !txt) return;

  const lines = fishLines[type];
  if (!lines) return;
  const line = lines[Math.floor(Math.random() * lines.length)];
  if (!line) return;

  txt.innerText = line;
  activeFishGroup = group;
  box.classList.remove('chrome-hidden');

  // 잠시 보였다 조용히 사라진다(상주 chrome 최소화).
  window.clearTimeout(fishLineTimer);
  fishLineTimer = window.setTimeout(() => closeFishLine(), 6000);
}

function closeFishLine(): void {
  window.clearTimeout(fishLineTimer);
  activeFishGroup = null;
  getEl('fish-line')?.classList.add('chrome-hidden');
}

// 말풍선을 물고기 머리 위(스크린 좌표)로 옮긴다. 매 프레임 호출(물고기가 헤엄쳐 이동).
function updateFishLinePosition(camera: THREE.PerspectiveCamera): void {
  if (!activeFishGroup) return;
  const box = getEl('fish-line');
  if (!box || box.classList.contains('chrome-hidden')) return;

  _fishLineProj.copy(activeFishGroup.position).project(camera);
  if (_fishLineProj.z > 1) return; // 카메라 뒤(이론상 없음) — 마지막 위치 유지

  const x = (_fishLineProj.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-_fishLineProj.y * 0.5 + 0.5) * window.innerHeight;
  // 머리 위 약간(32px) 띄우고, 화면 가장자리에서 잘리지 않게 클램프(말풍선은 bottom-center 기준).
  const cx = Math.min(Math.max(x, 84), window.innerWidth - 84);
  const cy = Math.min(Math.max(y - 32, 18), window.innerHeight - 12);
  box.style.left = `${cx}px`;
  box.style.top = `${cy}px`;
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

// 휠 줌 상태. null = 자동(반응형) 거리 그대로. 사용자가 휠을 굴리면 그 거리를 기억한다.
let zoomDistance: number | null = null;

// 현재 비율의 줌 거리 허용 범위 [가장 가까이, 가장 멀리]. 줌아웃 상한은 수조 cover 거리
// (그 이상은 유리 너머가 보임)와 자동 프레이밍 거리 중 큰 쪽 — 자동값이 항상 범위 안.
function zoomBounds(aspect: number): { min: number; max: number } {
  return { min: MIN_DISTANCE, max: Math.max(maxCoverDistance(aspect), deriveFraming(aspect).distance) };
}

function frameCamera(camera: THREE.PerspectiveCamera, aspect: number): void {
  let distance: number;
  let targetY: number;
  if (zoomDistance == null) {
    ({ distance, targetY } = deriveFraming(aspect));
  } else {
    const { min, max } = zoomBounds(aspect);
    distance = Math.min(Math.max(zoomDistance, min), max);
    zoomDistance = distance; // 비율 변경(리사이즈) 후에도 범위 안으로 재고정
    targetY = targetYForDistance(distance);
  }
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
// rAF 프레임 간격 상한(초). 위젯이 백그라운드/투과/퍽 접힘으로 rAF가 throttle·정지되면
// clock.getDelta()가 누적 벽시계 시간(수 초~분)을 한 번에 반환 → 물고기가 한 프레임에
// 수조 밖으로 점프해 사라진다. 큰 delta를 잘라 시뮬레이션이 튀지 않고 이어지게 한다.
const MAX_DELTA = 0.05;
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
        const delta = Math.min(clock.getDelta(), MAX_DELTA);
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
        triggerFishLine(obj.userData.interactiveType as string, obj);
        updateFishLinePosition(camera); // 첫 프레임 전 즉시 머리 위에 배치
        return;
      }
    }
    closeFishLine();
  });

  // 마우스 휠 = 줌 인/아웃. 줌아웃은 수조를 벗어나지 않게 cover 거리에서 멈춘다.
  // (chrome/그립/퍽 위에서는 무시 — 투명도 슬라이더 등과 충돌 방지.)
  window.addEventListener(
    'wheel',
    (event) => {
      if (!onBackground(event.target as HTMLElement | null)) return;
      event.preventDefault();
      const aspect = window.innerWidth / window.innerHeight;
      const { min, max } = zoomBounds(aspect);
      const base = zoomDistance ?? deriveFraming(aspect).distance;
      // 아래로 스크롤(deltaY>0)=줌아웃=거리 증가. 지수 스텝으로 비율과 무관하게 매끄럽게.
      const next = base * Math.exp(event.deltaY * 0.0015);
      zoomDistance = Math.min(Math.max(next, min), max);
      frameCamera(camera, aspect);
    },
    { passive: false },
  );

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
    const delta = Math.min(clock.getDelta(), MAX_DELTA);
    const time = clock.getElapsedTime();

    lighting.update(renderer, scene, time);
    animatePlants(aquascape.animatedPlants, time);
    animateBubbles(aquascape.bubbles, delta, time);
    fishList.forEach((fish) => fish.update(delta, time, fishList));
    updateFishLinePosition(camera); // 대사 말풍선이 물고기 머리 위를 따라다닌다

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
