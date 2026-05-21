import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildAquascape, animatePlants, animateBubbles, tankHeight } from './scene/aquascape';
import { Lighting, colors, type LightMode } from './scene/lighting';
import { spawnFauna } from './scene/fauna/fish';
import { seedRng } from './lib/rng';
import { cameraPresets, type CameraName } from './scene/cameraPresets';

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

// --- 명언 데이터 (오브젝트 클릭 시 표시) ---
interface Quote {
  text: string;
  author: string;
}

const quotes: Record<string, Quote[]> = {
  wood: [
    { text: '나무는 겨울을 준비하며 잎을 떨구지만, 그 뿌리는 봄날의 더 높은 성장을 조용히 기다린다.', author: '알 수 없음' },
    { text: '바람에 꺾여 물속에 잠긴 유목은 사라진 것이 아니라, 수많은 생명들의 안식처로 다시 태어난다.', author: '동양 철학' },
    { text: '세상의 거센 풍파가 나를 휩쓸어 이곳에 뉘었으니, 이제는 누군가에게 그늘과 쉼터가 되어주리라.', author: '장자' },
  ],
  rock: [
    { text: '강한 자가 살아남는 것이 아니라, 견뎌내는 자가 결국 그 자리를 지킨다.', author: '롤란드' },
    { text: '돌은 흐르는 물결에 깎여 마침내 둥글어지지만, 그 내면의 단단함은 결코 변치 않는다.', author: '공자' },
    { text: '거대한 바위도 한 방울씩 떨어지는 물방울에 의해 언젠가 뚫린다. 포기하지 않는 끈기가 전부다.', author: '라틴 격언' },
  ],
  duck: [
    { text: '인생이라는 거대한 바다에서 가끔은 그저 모든 힘을 빼고 둥둥 떠다니는 여유가 필요하다.', author: '노자' },
    { text: '우리는 행복을 멀리서 찾지만, 가장 큰 평온은 늘 내 손이 닿는 소박한 일상 속에 존재한다.', author: '소크라테스' },
    { text: '세상의 흐름이 너무 빠를 때, 제자리에 머물며 노란 웃음을 짓는 작은 오리 인형처럼 살아보자.', author: '현대 격언' },
  ],
  betta: [
    { text: '스스로의 아름다움을 드러내기를 두려워하지 마라. 그 화려함은 바로 너라는 존재의 본질이다.', author: '화가 에밀리' },
    { text: '홀로 유유히 헤엄치는 베타처럼, 고독은 외로움이 아닌 내면의 아름다움을 완성하는 시간이다.', author: '쇼펜하우어' },
  ],
  tetra: [
    { text: '우리는 비록 작지만, 서로 어깨를 나란히 하고 함께 빛날 때 거대한 밤하늘의 은하수가 된다.', author: '헬렌 켈러' },
    { text: '작은 빛들이 모여 큰 불을 이루듯, 작고 연약한 개체들의 협동은 세상을 움직이는 힘이다.', author: '다윈' },
  ],
  corydoras: [
    { text: '묵묵히 가장 아래에서 자기 일을 완수하는 존재가 있기에, 전체 생태계가 맑고 투명함을 유지한다.', author: '도덕경' },
    { text: '인생의 바닥에 닿았다고 느낄 때 실망하지 마라. 그곳은 새로운 영양분과 삶을 배울 수 있는 기초이다.', author: '키에르케고르' },
  ],
};

const tagNames: Record<string, string> = {
  wood: '유목 (Driftwood)',
  rock: '기암괴석 (Rock)',
  duck: '행복한 노란 오리',
  betta: '우아한 베타',
  tetra: '네온테트라',
  corydoras: '성실한 코리도라스',
};

function getEl<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function triggerQuote(type: string): void {
  const card = getEl('quote-card');
  const txt = getEl('quote-text');
  const auth = getEl('quote-author');
  const tag = getEl('quote-tag');
  if (!card || !txt || !auth || !tag) return;

  const group = quotes[type];
  if (!group) return;
  const q = group[Math.floor(Math.random() * group.length)];
  if (!q) return;

  tag.innerText = tagNames[type] ?? type;
  txt.innerText = `"${q.text}"`;
  auth.innerText = `- ${q.author}`;

  card.classList.remove('scale-95', 'opacity-0', 'pointer-events-none');
  card.classList.add('scale-100', 'opacity-100', 'pointer-events-auto');
}

function closeQuoteCard(): void {
  const card = getEl('quote-card');
  if (!card) return;
  card.classList.add('scale-95', 'opacity-0', 'pointer-events-none');
  card.classList.remove('scale-100', 'opacity-100', 'pointer-events-auto');
}

// --- 조명 모드 버튼 UI 상태 ---
const ACTIVE_BTN = 'px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-300 bg-emerald-500 text-slate-950 shadow';
const IDLE_BTN = 'px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 text-slate-300 hover:bg-slate-800/50 transition-all duration-300';

function setLightMode(lighting: Lighting, mode: LightMode): void {
  lighting.setMode(mode);
  (['day', 'dusk', 'night'] as const).forEach((m) => {
    const btn = getEl(`btn-${m}`);
    if (btn) btn.className = m === mode ? ACTIVE_BTN : IDLE_BTN;
  });
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

// 캡처 결정론을 위한 고정 타임스텝 워밍업 — 동일 시드 + 동일 스텝 → 동일 프레임.
const CAPTURE_FIXED_DELTA = 1 / 60;
const CAPTURE_WARMUP_STEPS = 300;

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

  // Lighting / scene contents
  const lighting = new Lighting(scene, tankHeight);
  const aquascape = buildAquascape(scene);
  const fishList = spawnFauna(scene);

  // --- 캡처 모드: 고정 카메라 프리셋 + 결정론적 프레임. 입력/컨트롤 없음. ---
  if (capture) {
    hideChrome();
    applyCameraPreset(camera, capture.camera);
    lighting.setMode(capture.mode);

    if (capture.clip) {
      // 클립: 시드·프리셋 고정 상태에서 실시간 모션 재생(영상 녹화용).
      const clock = new THREE.Clock();
      const renderClip = (): void => {
        requestAnimationFrame(renderClip);
        const delta = clock.getDelta();
        const time = clock.getElapsedTime();
        lighting.update(renderer, scene);
        animatePlants(aquascape.animatedPlants, time);
        animateBubbles(aquascape.bubbles, delta, time);
        fishList.forEach((fish) => fish.update(delta, time));
        renderer.render(scene, camera);
      };
      renderClip();
      window.__captureReady = true;
      return;
    }

    // 정지 프레임: 고정 타임스텝으로 워밍업(조명 lerp 정착 + 모션 진행)한 뒤 1회 렌더.
    let t = 0;
    for (let i = 0; i < CAPTURE_WARMUP_STEPS; i++) {
      t += CAPTURE_FIXED_DELTA;
      lighting.update(renderer, scene);
      animatePlants(aquascape.animatedPlants, t);
      animateBubbles(aquascape.bubbles, CAPTURE_FIXED_DELTA, t);
      fishList.forEach((fish) => fish.update(CAPTURE_FIXED_DELTA, t));
    }
    renderer.render(scene, camera);
    window.__captureReady = true;
    return;
  }

  // --- 일반 실행: OrbitControls + 클릭 명언 + rAF 루프 ---
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.minDistance = 6;
  controls.maxDistance = 28;

  const clickableObjects: THREE.Object3D[] = [...aquascape.clickable, ...fishList.map((f) => f.group)];

  setLightMode(lighting, 'day');

  // 조명 버튼 배선
  (['day', 'dusk', 'night'] as const).forEach((m) => {
    getEl(`btn-${m}`)?.addEventListener('click', () => setLightMode(lighting, m));
  });
  getEl('quote-close')?.addEventListener('click', () => closeQuoteCard());

  // 클릭 명언 (raycasting)
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  window.addEventListener('pointerdown', (event) => {
    const el = event.target as HTMLElement | null;
    if (el && (el.closest('button') || el.closest('#quote-card') || el.closest('footer'))) {
      return;
    }

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(clickableObjects, true);
    if (intersects.length > 0) {
      let obj: THREE.Object3D | null = intersects[0].object;
      while (obj && !obj.userData.interactiveType) {
        obj = obj.parent;
      }
      if (obj && obj.userData.interactiveType) {
        triggerQuote(obj.userData.interactiveType as string);
      }
    } else {
      closeQuoteCard();
    }
  });

  // Resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Render loop
  const clock = new THREE.Clock();
  function animate(): void {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();

    controls.update();
    lighting.update(renderer, scene);
    animatePlants(aquascape.animatedPlants, time);
    animateBubbles(aquascape.bubbles, delta, time);
    fishList.forEach((fish) => fish.update(delta, time));

    renderer.render(scene, camera);
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
