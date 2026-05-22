import * as THREE from 'three';
import { tankWidth, tankDepth } from './aquascape';

// day/dusk/night 조명 + 부드러운 전환 + 상단 광원의 코스틱 투영(AESTHETIC §3).
// 팔레트는 sample.jpeg 무드(따뜻한 색온도·채도 높은 녹색·청록 깊이 감쇠)로 재튜닝.

export type LightMode = 'day' | 'dusk' | 'night';

interface ColorTheme {
  ambient: number;
  dirLight: number;
  topLight: number;
  fog: number;
  bg: number;
}

// §2 팔레트 도출. sample.jpeg = 차분한 여백 위주의 네이처 아쿠아리움.
// 감산: day의 황록 캐스트를 제거하고 포그를 어두운 청록-그린으로 되돌려 깊이감·붉은 베타 대비를 살린다.
export const colors: Record<LightMode, ColorTheme> = {
  day: {
    ambient: 0xd8eaff, // 맑고 차가운 연청빛 — 밝기보다 투명한 분리감
    dirLight: 0xffffff, // 순수하고 깨끗한 화이트 햇살
    topLight: 0xf8ffff, // 순수하지만 살짝 물빛이 도는 수면광
    fog: 0x173940, // 깨끗하고 투명한 피코크 청록
    bg: 0x07181d, // 어둡지만 맑은 투명감을 품은 심해 청록
  },
  dusk: {
    ambient: 0xf2cda6,
    dirLight: 0xff9a52,
    topLight: 0xffb070,
    fog: 0x2a1810,
    bg: 0x120a06,
  },
  night: {
    ambient: 0x142b40,
    dirLight: 0x3f6fb0,
    topLight: 0x2f8a86, // 부드러운 청록 달빛(쨍한 네온 시안 회피)
    fog: 0x06151c,
    bg: 0x02080e,
  },
};

export const transparentClearAlpha = 0;

export interface TargetLightSettings {
  ambientColor: THREE.Color;
  dirColor: THREE.Color;
  topColor: THREE.Color;
  fogColor: THREE.Color;
  bgColor: THREE.Color;
  clearAlpha: number;
  ambientIntensity: number;
  dirIntensity: number;
  topIntensity: number;
  fogDensity: number;
  causticIntensity: number;
}

export function targetLightSettingsForMode(mode: LightMode): TargetLightSettings {
  const theme = colors[mode];
  return {
    ambientColor: new THREE.Color(theme.ambient),
    dirColor: new THREE.Color(theme.dirLight),
    topColor: new THREE.Color(theme.topLight),
    fogColor: new THREE.Color(theme.fog),
    bgColor: new THREE.Color(theme.bg),
    clearAlpha: transparentClearAlpha,
    ambientIntensity: mode === 'day' ? 1.12 : mode === 'dusk' ? 0.86 : 0.68,
    dirIntensity: mode === 'day' ? 1.18 : mode === 'dusk' ? 0.65 : 0.35,
    topIntensity: mode === 'day' ? 4.8 : mode === 'dusk' ? 3.6 : 4.6,
    fogDensity: mode === 'day' ? 0.018 : mode === 'dusk' ? 0.024 : 0.03,
    causticIntensity: mode === 'day' ? 0.62 : mode === 'dusk' ? 0.42 : 0.4,
  };
}

// 캔버스로 타일링 가능한 코스틱(물결 광망) 텍스처를 절차적으로 생성한다.
// 외부 에셋/네트워크 없이(번들·오프라인 정책) 일렁이는 빛 패턴을 만든다.
function createCausticTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  // 캔버스를 못 얻어도(예: 일부 헤드리스) 흰 텍스처로 폴백 — 코스틱만 빠지고 씬은 산다.
  if (ctx) {
    const img = ctx.createImageData(size, size);
    const data = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = (x / size) * Math.PI * 2;
        const v = (y / size) * Math.PI * 2;
        // 도메인 워프(정수 주파수 → 타일 이음새 보존)로 격자감을 깨고 유기적 광망을 만든다.
        // 이전의 규칙적 체스판 패턴(물멍 테스트 실패) 대신 불규칙한 셀룰러 빛줄기.
        const wu = u + 0.7 * Math.sin(v * 2 + 1.3);
        const wv = v + 0.7 * Math.sin(u * 3 + 2.1);
        let s = Math.sin(wu * 2) * Math.cos(wv * 3);
        s += 0.7 * Math.sin(wu * 5 - wv * 4);
        s += 0.5 * Math.cos(wu * 3 + wv * 6);
        s = (s + 2.2) / 4.4; // ~[0,1]
        // 가는 밝은 정맥만 남기도록 강한 감마 — 어두운 바탕 + 일렁이는 빛줄기.
        const c = Math.pow(Math.max(0, s), 3.0);
        const lum = Math.min(255, 16 + c * 255 * 2.1);
        const idx = (y * size + x) * 4;
        data[idx] = lum;
        data[idx + 1] = lum;
        data[idx + 2] = lum;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.4, 2.4);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Lighting {
  readonly ambient: THREE.AmbientLight;
  readonly directional: THREE.DirectionalLight;
  readonly top: THREE.SpotLight;
  private readonly caustic: THREE.CanvasTexture;
  // 바닥 위를 떠도는 가산 코스틱 오버레이 — SpotLight.map 투영은 소프트웨어 GL(캡처)에서
  // 약하게 나오므로, 실측에서도 확실히 보이는 일렁이는 광망을 별도 평면으로 보장한다.
  private readonly causticOverlay: THREE.Mesh;
  private readonly causticOverlayTex: THREE.CanvasTexture;
  private readonly causticMat: THREE.MeshBasicMaterial;
  private causticIntensity = 0.55;

  mode: LightMode = 'day';
  /** §6-2 사용량 연동 — 포그 밀도 배수(한도 임박 시 물을 탁하게). 렌더 루프가 설정한다. */
  fogDensityMul = 1;
  private target: TargetLightSettings | null = null;

  constructor(scene: THREE.Scene, tankHeight: number) {
    this.ambient = new THREE.AmbientLight(colors.day.ambient, 1.2);
    scene.add(this.ambient);

    this.directional = new THREE.DirectionalLight(colors.day.dirLight, 0.8);
    this.directional.position.set(8, 15, 6);
    this.directional.castShadow = true;
    this.directional.shadow.mapSize.width = 1024;
    this.directional.shadow.mapSize.height = 1024;
    this.directional.shadow.bias = -0.001;
    scene.add(this.directional);

    // 상단 수면 광원 — 코스틱 텍스처를 바닥/돌로 투영(일렁이는 빛 패턴).
    this.caustic = createCausticTexture();
    this.top = new THREE.SpotLight(colors.day.topLight, 4, 30, Math.PI / 3, 0.5, 1);
    this.top.position.set(0, tankHeight / 2 - 0.5, 0);
    this.top.target.position.set(0, -tankHeight / 2, 0);
    this.top.map = this.caustic;
    this.top.castShadow = true;
    this.top.shadow.mapSize.width = 1024;
    this.top.shadow.mapSize.height = 1024;
    scene.add(this.top);
    scene.add(this.top.target);

    // 바닥 위 가산 코스틱 오버레이 — 별도 텍스처(자체 offset 애니메이션)로 광망을 바닥에 깐다.
    this.causticOverlayTex = createCausticTexture();
    this.causticOverlayTex.repeat.set(1.8, 1.8);
    this.causticOverlayTex.center.set(0.5, 0.5);
    this.causticOverlayTex.rotation = 0.5; // 축 정렬 격자감 제거
    this.causticMat = new THREE.MeshBasicMaterial({
      map: this.causticOverlayTex,
      transparent: true,
      opacity: this.causticIntensity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: 0xeae0b0, // 따뜻한 빛 (차가운 흰빛 대신)
      fog: true,
      side: THREE.DoubleSide,
    });
    const overlayGeo = new THREE.PlaneGeometry(tankWidth * 1.05, tankDepth * 1.05);
    overlayGeo.rotateX(-Math.PI / 2);
    this.causticOverlay = new THREE.Mesh(overlayGeo, this.causticMat);
    this.causticOverlay.position.set(0, -tankHeight / 2 + 1.35, 0);
    this.causticOverlay.renderOrder = 1;
    scene.add(this.causticOverlay);

    this.setMode('day');
  }

  // 목표 값만 세팅하고, 실제 보간은 렌더 루프의 update()가 처리한다.
  setMode(mode: LightMode): void {
    this.mode = mode;
    this.target = targetLightSettingsForMode(mode);
  }

  update(renderer: THREE.WebGLRenderer, scene: THREE.Scene, time = 0): void {
    // 코스틱 텍스처 오프셋을 천천히 흘려 일렁임을 만든다(일률적 패턴 회피).
    this.caustic.offset.x = time * 0.012;
    this.caustic.offset.y = Math.sin(time * 0.08) * 0.15;
    // 바닥 오버레이는 다른 속도/방향으로 흘려 두 광망이 간섭하듯 겹쳐 자연스럽게.
    this.causticOverlayTex.offset.x = time * 0.018 + Math.sin(time * 0.05) * 0.1;
    this.causticOverlayTex.offset.y = time * 0.009;

    if (!this.target) return;

    const lerpSpeed = 0.05;
    const t = this.target;

    this.ambient.color.lerp(t.ambientColor, lerpSpeed);
    this.directional.color.lerp(t.dirColor, lerpSpeed);
    this.top.color.lerp(t.topColor, lerpSpeed);

    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.lerp(t.fogColor, lerpSpeed);
      scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, t.fogDensity * this.fogDensityMul, lerpSpeed);
    }

    const clear = renderer.getClearColor(new THREE.Color());
    renderer.setClearColor(clear.lerp(t.bgColor, lerpSpeed), t.clearAlpha);

    this.ambient.intensity = THREE.MathUtils.lerp(this.ambient.intensity, t.ambientIntensity, lerpSpeed);
    this.directional.intensity = THREE.MathUtils.lerp(this.directional.intensity, t.dirIntensity, lerpSpeed);
    this.top.intensity = THREE.MathUtils.lerp(this.top.intensity, t.topIntensity, lerpSpeed);

    this.causticIntensity = THREE.MathUtils.lerp(this.causticIntensity, t.causticIntensity, lerpSpeed);
    this.causticMat.opacity = this.causticIntensity;
    this.causticMat.color.lerp(t.topColor, lerpSpeed); // 코스틱 색을 수면광에 맞춤
  }
}
