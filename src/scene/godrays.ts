import * as THREE from 'three';
import { tankWidth, tankHeight, tankDepth } from './aquascape';
import { random } from '../lib/rng';

// 갓레이(God rays) — 상단 수면에서 수중으로 떨어지는 미세한 빛줄기(AESTHETIC §3).
// 무거운 볼류메트릭 대신, 상단에서 내려오는 반투명 가산(additive) 셰이프트 평면으로 근사한다.
// "미세하게" — 낮은 opacity, 정적(상시 응시해도 거슬리지 않게).

// 위는 밝고 아래로 사라지며 좌우로 부드럽게 페이드하는 그라데이션 텍스처.
function createShaftTexture(size = 128): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(size, size);
    const data = img.data;
    for (let y = 0; y < size; y++) {
      const v = y / size; // 0=상단(밝음), 1=하단(사라짐)
      const vertical = Math.pow(1 - v, 1.6);
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const horizontal = Math.sin(u * Math.PI); // 좌우 가장자리 페이드
        const lum = Math.max(0, vertical * horizontal) * 255;
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
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createGodRays(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  const tex = createShaftTexture();

  const shaftMat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.07,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    color: 0xdfeede, // 따뜻한 흰빛
    fog: false,
  });

  // 상단 좌측에서 흩어지는 5줄기 — sample.jpeg의 좌상 광원 방향과 일치.
  const count = 5;
  for (let i = 0; i < count; i++) {
    const w = 1.4 + random() * 1.6;
    const h = tankHeight * (0.9 + random() * 0.25);
    const geo = new THREE.PlaneGeometry(w, h);
    geo.translate(0, -h / 2, 0); // 피벗을 상단으로(수면에서 내려옴)
    const shaft = new THREE.Mesh(geo, shaftMat);
    shaft.position.set(
      -tankWidth * 0.28 + (i / count) * tankWidth * 0.55,
      tankHeight / 2 - 0.6,
      -tankDepth * 0.15 + (random() - 0.5) * tankDepth * 0.4,
    );
    shaft.rotation.z = 0.18 + random() * 0.12; // 좌상 → 우하로 살짝 기울임
    shaft.rotation.y = (random() - 0.5) * 0.5;
    group.add(shaft);
  }

  scene.add(group);
  return group;
}
