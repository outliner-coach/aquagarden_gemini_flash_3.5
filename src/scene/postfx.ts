import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
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
    varying vec2 vUv;

    void main() {
      vec4 c = texture2D(tDiffuse, vUv);

      // 비네팅 — 가장자리를 부드럽게 어둡게.
      vec2 q = vUv - 0.5;
      float vig = smoothstep(0.9, 0.25, length(q));
      c.rgb *= mix(1.0, vig, uVignette);

      // 그레인 + 디더 — 밴딩을 깨는 미세 노이즈(프레임마다 변주).
      float n = fract(sin(dot(vUv * 1024.0 + uFrame, vec2(12.9898, 78.233))) * 43758.5453);
      c.rgb += (n - 0.5) * uGrain;

      gl_FragColor = c;
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

  // 피사계심도(DoF) — 물속을 들여다보는 매크로 감성. "약하게"(maxblur 작게, 멀미 방지).
  // 초점은 어항 중심 부근, 배경/원경만 부드럽게 풀린다.
  const bokeh = new BokehPass(scene, camera, {
    focus: 16.0,
    aperture: 0.0006,
    maxblur: 0.006,
  });
  composer.addPass(bokeh);

  // 은은한 Bloom — strength 낮게, threshold 높게(밝은 하이라이트/발광/코스틱만 번지게).
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(size.x, size.y),
    0.5, // strength
    0.7, // radius
    0.82, // threshold (이 밝기 이상만 bloom)
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
      composer.setSize(width, height);
      bloom.setSize(width, height);
    },
    render(): void {
      grade.uniforms.uFrame.value = (frame++ % 1024) * 0.137; // 그레인 프레임 변주
      composer.render();
    },
  };
}
