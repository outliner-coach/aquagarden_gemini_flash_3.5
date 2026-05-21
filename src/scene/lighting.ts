import * as THREE from 'three';

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

// §2 팔레트 도출. day는 따뜻한 햇빛 + 청록 수중 포그, dusk는 앰버, night는 깊은 청록.
export const colors: Record<LightMode, ColorTheme> = {
  day: {
    ambient: 0xcfe6d8,
    dirLight: 0xfff1d8,
    topLight: 0xdff3e4,
    fog: 0x123a35,
    bg: 0x081f1c,
  },
  dusk: {
    ambient: 0xf2cda6,
    dirLight: 0xff9a52,
    topLight: 0xffb070,
    fog: 0x2a1810,
    bg: 0x120a06,
  },
  night: {
    ambient: 0x16314a,
    dirLight: 0x3f7bd0,
    topLight: 0x35e0d8,
    fog: 0x07141f,
    bg: 0x030a11,
  },
};

interface TargetLightSettings {
  ambientColor: THREE.Color;
  dirColor: THREE.Color;
  topColor: THREE.Color;
  fogColor: THREE.Color;
  bgColor: THREE.Color;
  ambientIntensity: number;
  dirIntensity: number;
  topIntensity: number;
  fogDensity: number;
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
        // 여러 주파수의 사인을 겹쳐 셀룰러한 광망(caustic web)을 근사.
        let s = 0;
        s += Math.sin(u * 3 + Math.cos(v * 2)) * Math.sin(v * 3 + Math.cos(u * 2));
        s += Math.sin(u * 5 - v * 4) * 0.5;
        s += Math.cos(u * 2 + v * 6) * 0.5;
        s = (s + 2) / 4; // [0,1] 근사
        // 밝은 정맥만 남기도록 감마/스레숄드 — 어두운 바탕 + 가는 빛줄기(대비 강조).
        const c = Math.pow(Math.max(0, s), 2.2);
        const lum = Math.min(255, 30 + c * 255 * 1.9);
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

  mode: LightMode = 'day';
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

    this.setMode('day');
  }

  // 목표 값만 세팅하고, 실제 보간은 렌더 루프의 update()가 처리한다.
  setMode(mode: LightMode): void {
    this.mode = mode;
    const theme = colors[mode];

    this.target = {
      ambientColor: new THREE.Color(theme.ambient),
      dirColor: new THREE.Color(theme.dirLight),
      topColor: new THREE.Color(theme.topLight),
      fogColor: new THREE.Color(theme.fog),
      bgColor: new THREE.Color(theme.bg),
      // day는 ambient를 낮춰 top 스포트라이트의 코스틱 대비가 살게 한다. night는 칠흑이 아니라
      // 달빛처럼 읽히도록 fill을 올린다(전·중·후경 실루엣은 보여야 함).
      ambientIntensity: mode === 'day' ? 1.0 : mode === 'dusk' ? 0.8 : 0.72,
      dirIntensity: mode === 'day' ? 1.1 : mode === 'dusk' ? 0.65 : 0.4,
      topIntensity: mode === 'day' ? 6.0 : mode === 'dusk' ? 3.6 : 7.0, // 밤엔 발광 강조
      // 깊이 색 감쇠 — day는 옅게(맑게), night는 짙게(깊은 청록으로 빨강 흡수).
      fogDensity: mode === 'day' ? 0.035 : mode === 'dusk' ? 0.045 : 0.05,
    };
  }

  update(renderer: THREE.WebGLRenderer, scene: THREE.Scene, time = 0): void {
    // 코스틱 텍스처 오프셋을 천천히 흘려 일렁임을 만든다(일률적 패턴 회피).
    this.caustic.offset.x = time * 0.012;
    this.caustic.offset.y = Math.sin(time * 0.08) * 0.15;

    if (!this.target) return;

    const lerpSpeed = 0.05;
    const t = this.target;

    this.ambient.color.lerp(t.ambientColor, lerpSpeed);
    this.directional.color.lerp(t.dirColor, lerpSpeed);
    this.top.color.lerp(t.topColor, lerpSpeed);

    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.lerp(t.fogColor, lerpSpeed);
      scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, t.fogDensity, lerpSpeed);
    }

    const clear = renderer.getClearColor(new THREE.Color());
    renderer.setClearColor(clear.lerp(t.bgColor, lerpSpeed));

    this.ambient.intensity = THREE.MathUtils.lerp(this.ambient.intensity, t.ambientIntensity, lerpSpeed);
    this.directional.intensity = THREE.MathUtils.lerp(this.directional.intensity, t.dirIntensity, lerpSpeed);
    this.top.intensity = THREE.MathUtils.lerp(this.top.intensity, t.topIntensity, lerpSpeed);
  }
}
