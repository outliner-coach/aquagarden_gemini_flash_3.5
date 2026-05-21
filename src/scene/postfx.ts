import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// 시네마틱 렌더 파이프라인 (AESTHETIC §3).
// 색관리: linear workflow + sRGB output + ACESFilmic 톤매핑(OutputPass가 마감에 적용).
// Bloom: 코스틱·발광 요소 한정으로 은은하게(높은 threshold). 화면 전체 blown-out 금지.
// 마감: 비네팅 + 미세 그레인 + 디더(밴딩 방지) — 사진적 그레이딩(§3).

export interface PostFX {
  setSize(width: number, height: number): void;
  render(): void;
}

// 사진적 마감 셰이더 — 비네팅, 미세 그레인, 디더. tDiffuse는 sRGB(OutputPass 이후).
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uFrame: { value: 0 },
    uVignette: { value: 0.32 },
    uGrain: { value: 0.022 },
    uSaturation: { value: 1.27 }, // 무성한 녹색 채도↑ (sample.jpeg 정글감)
    uWarm: { value: 0.085 }, // 따뜻한 톤 시프트 (차가운 청록 데모틸 제거)
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uFrame;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uSaturation;
    uniform float uWarm;
    varying vec2 vUv;

    void main() {
      vec4 c = texture2D(tDiffuse, vUv);

      // 채도 — 녹색 위주로 살짝 끌어올려 무성함을 강조(luma 보존).
      float luma = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(luma), c.rgb, uSaturation);

      // 따뜻한 톤 시프트 — 적·녹을 살짝 올리고 청을 살짝 내려 데모틸의 차가움을 상쇄.
      c.r += uWarm;
      c.g += uWarm * 0.5;
      c.b -= uWarm * 0.7;

      // 비네팅 — 가장자리를 부드럽게 어둡게.
      vec2 q = vUv - 0.5;
      float vig = smoothstep(0.9, 0.25, length(q));
      c.rgb *= mix(1.0, vig, uVignette);

      // 그레인 + 디더 — 밴딩을 깨는 미세 노이즈(프레임마다 변주).
      float n = fract(sin(dot(vUv * 1024.0 + uFrame, vec2(12.9898, 78.233))) * 43758.5453);
      c.rgb += (n - 0.5) * uGrain;

      gl_FragColor = clamp(c, 0.0, 1.0);
    }
  `,
};

// 렌더러를 시네마틱 색관리로 설정한다. 톤매핑/색공간 변환은 OutputPass가 마지막에 수행하므로
// 렌더러에 toneMapping을 지정하되 RenderPass는 linear로 그린다.
export function setupRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
}

export function createPostFX(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): PostFX {
  const size = renderer.getSize(new THREE.Vector2());

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // 주의: DoF(BokehPass)는 의도적으로 제거했다. 자유롭게 줌인/줌아웃하며 감상하는 위젯에서는
  // 깊이 기반 블러가 어느 줌 레벨에서든 씬을 흐리게 만들어 "해상도 흐림"으로 체감된다.
  // 시네마틱 깊이감은 포그(깊이 색 감쇠)·코스틱·Bloom으로 충분히 살리고, 선명도를 우선한다.

  // 은은한 Bloom — 발광(네온테트라 스트라이프)·코스틱·갓레이·하이라이트가 실제로 번지게.
  // threshold를 낮춰 밝은 요소가 잡히되, strength는 절제해 화면 전체 blown-out은 피한다.
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(size.x, size.y),
    0.5, // strength
    0.45, // radius (헤일로 반경 축소 → 발광 요소가 비대한 후광을 끌지 않게)
    0.72, // threshold (코스틱 하이라이트·갓레이·은은한 발광만 잡힘)
  );
  composer.addPass(bloom);

  // OutputPass — 톤매핑 + sRGB 변환.
  composer.addPass(new OutputPass());

  // 사진적 마감(비네팅 + 그레인 + 디더). sRGB 이후에 적용.
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  let frame = 0;
  return {
    setSize(width: number, height: number): void {
      // composer.setSize는 내부 _pixelRatio(=renderer.getPixelRatio())를 곱해 각 pass에
      // 실제 픽셀 해상도로 전달하므로 bloom 등은 자동 갱신된다(수동 setSize 불필요).
      composer.setSize(width, height);
    },
    render(): void {
      grade.uniforms.uFrame.value = (frame++ % 1024) * 0.137; // 그레인 프레임 변주
      composer.render();
    },
  };
}
