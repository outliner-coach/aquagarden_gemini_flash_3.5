import * as THREE from 'three';

// day/dusk/night 조명 + 부드러운 전환. 기존 index.html의 colors 팔레트·setLightMode·
// updateLightingTransition 을 그대로 이식(동작 보존). UI 버튼 상태는 main.ts가 다룬다.

export type LightMode = 'day' | 'dusk' | 'night';

interface ColorTheme {
  ambient: number;
  dirLight: number;
  topLight: number;
  fog: number;
  bg: number;
}

export const colors: Record<LightMode, ColorTheme> = {
  day: {
    ambient: 0xddeeff,
    dirLight: 0xffffff,
    topLight: 0xe0f7fa,
    fog: 0x1a3a40,
    bg: 0x0a1c20,
  },
  dusk: {
    ambient: 0xffccaa,
    dirLight: 0xff8844,
    topLight: 0xffaa66,
    fog: 0x2e1a10,
    bg: 0x140a05,
  },
  night: {
    ambient: 0x112244,
    dirLight: 0x3366cc,
    topLight: 0x00ffff,
    fog: 0x050d1a,
    bg: 0x02060f,
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
}

export class Lighting {
  readonly ambient: THREE.AmbientLight;
  readonly directional: THREE.DirectionalLight;
  readonly top: THREE.SpotLight;

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

    this.top = new THREE.SpotLight(colors.day.topLight, 4, 30, Math.PI / 3, 0.5, 1);
    this.top.position.set(0, tankHeight / 2 - 0.5, 0);
    this.top.target.position.set(0, -tankHeight / 2, 0);
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
      ambientIntensity: mode === 'day' ? 1.4 : mode === 'dusk' ? 0.8 : 0.3,
      dirIntensity: mode === 'day' ? 1.0 : mode === 'dusk' ? 0.6 : 0.1,
      topIntensity: mode === 'day' ? 4.0 : mode === 'dusk' ? 3.0 : 6.0, // 밤엔 발광 강조
    };
  }

  update(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    if (!this.target) return;

    const lerpSpeed = 0.05;
    const t = this.target;

    this.ambient.color.lerp(t.ambientColor, lerpSpeed);
    this.directional.color.lerp(t.dirColor, lerpSpeed);
    this.top.color.lerp(t.topColor, lerpSpeed);

    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.lerp(t.fogColor, lerpSpeed);
    }

    const clear = renderer.getClearColor(new THREE.Color());
    renderer.setClearColor(clear.lerp(t.bgColor, lerpSpeed));

    this.ambient.intensity = THREE.MathUtils.lerp(this.ambient.intensity, t.ambientIntensity, lerpSpeed);
    this.directional.intensity = THREE.MathUtils.lerp(this.directional.intensity, t.dirIntensity, lerpSpeed);
    this.top.intensity = THREE.MathUtils.lerp(this.top.intensity, t.topIntensity, lerpSpeed);
  }
}
