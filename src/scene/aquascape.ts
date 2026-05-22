import * as THREE from 'three';
import { random } from '../lib/rng';

// 유리/모래/소일/수면/바위/유목/오리/수초/기포. 기존 index.html의 buildAquascape·
// createProceduralRock·getSubstrateHeight·createSwayingPlant·spawnBubbles·animateBubbles 를
// 동작 보존으로 이식한다. 모듈 전역 배열 대신 핸들 묶음을 반환한다.

export const tankWidth = 24;
export const tankHeight = 14;
export const tankDepth = 11;

export interface PlantSway {
  nodes: THREE.Object3D[];
  // 흐름장(flow field) 기반 흔들림 — 위상은 월드 좌표에서 유도(공유 흐름), per-plant 독립 사인파 금지.
  pos: THREE.Vector3;
  sway: number; // 작은 진폭 변주(기계적 균일 회피, 흐름 방향·속도는 공유)
}

export interface Aquascape {
  animatedPlants: PlantSway[];
  bubbles: THREE.Mesh[];
  clickable: THREE.Object3D[];
}

// 식재용 바닥 높이 근사 (모래 둔덕 변형식과 동일).
function getSubstrateHeight(x: number, z: number): number {
  let vy = Math.sin(x * 0.3) * Math.cos(z * 0.3) * 0.4;
  vy += Math.sin(x * 0.1) * 0.3;
  vy += (Math.abs(x) / tankWidth) * 2;
  return -tankHeight / 2 + vy + 1;
}

// 세이류석 풍 절차적 바위 — 회녹색 층상석. 정점을 흩뜨려 거친 실루엣 + 층 디테일.
function createProceduralRock(
  scale: [number, number, number],
  pos: [number, number, number],
  rot: [number, number, number],
  type: string,
  clickable: THREE.Object3D[],
): THREE.Mesh {
  // 디테일 단계를 올려(2) 면이 더 많아 거친 암석 실루엣을 낸다.
  const rockGeo = new THREE.DodecahedronGeometry(1, 2);

  const position = rockGeo.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const vx = position.getX(i);
    const vy = position.getY(i);
    const vz = position.getZ(i);
    const d = 0.22;
    // 수평 층(strata)을 강조 — y 높이에 따라 안팎으로 밀어 층상석 느낌.
    const strata = Math.sin(vy * 6.0) * 0.08;
    position.setX(i, vx + (random() - 0.5) * d + vx * strata);
    position.setY(i, vy + (random() - 0.5) * d * 0.6);
    position.setZ(i, vz + (random() - 0.5) * d + vz * strata);
  }
  rockGeo.computeVertexNormals();

  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x7d847a, // 회녹색 세이류석 (§2 팔레트, 갈색 블록 탈피)
    roughness: 0.92,
    metalness: 0.04,
    flatShading: true,
  });

  const mesh = new THREE.Mesh(rockGeo, rockMat);
  mesh.scale.set(...scale);
  mesh.position.set(...pos);
  mesh.rotation.set(...rot);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { interactiveType: type };

  clickable.push(mesh);
  return mesh;
}

// 모스(이끼) 덩어리 — 돌·중경에 무성한 녹색을 입히는 저폴리 블롭. 레퍼런스의 정글감 핵심.
// 가벼운 단일 메시(IcosahedronGeometry). 표면을 울퉁불퉁하게 흩뜨려 덩어리진 모스 질감.
function createMossClump(
  pos: THREE.Vector3,
  radius: number,
  colorHex: number,
): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(radius, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const f = 0.65 + random() * 0.7;
    p.setX(i, p.getX(i) * f);
    p.setY(i, p.getY(i) * f * 0.72); // 납작하게(바닥에 깔린 모스)
    p.setZ(i, p.getZ(i) * f);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.95,
    metalness: 0.0,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// 분절된 마디로 구성해 유기적으로 흔들리는 줄기 수초.
function createSwayingPlant(
  scene: THREE.Scene,
  animatedPlants: PlantSway[],
  pos: THREE.Vector3,
  totalHeight: number,
  colorHex: number,
  baseRadius: number,
): void {
  const segments = 4;
  const segHeight = totalHeight / segments;
  const plantGroup = new THREE.Group();
  plantGroup.position.copy(pos);

  let parentNode: THREE.Object3D = plantGroup;
  const segmentList: THREE.Object3D[] = [];

  const plantMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.8,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });

  for (let s = 0; s < segments; s++) {
    const rad = baseRadius * (1 - (s / segments) * 0.7);
    const geo = new THREE.CylinderGeometry(rad * 0.7, rad, segHeight, 5);
    geo.translate(0, segHeight / 2, 0); // 피벗을 마디 하단으로

    const segmentMesh = new THREE.Mesh(geo, plantMat);
    segmentMesh.castShadow = true;
    segmentMesh.receiveShadow = true;

    // 실루엣을 위한 작은 잎
    for (let l = 0; l < 3; l++) {
      const leafGeo = new THREE.ConeGeometry(rad * 2.2, segHeight * 0.9, 3);
      leafGeo.rotateX(Math.PI / 4 + random() * 0.4);
      const leafMesh = new THREE.Mesh(leafGeo, plantMat);
      leafMesh.position.set(0, segHeight * 0.4 + random() * 0.3, 0);
      leafMesh.rotation.y = (l * Math.PI * 2) / 3;
      segmentMesh.add(leafMesh);
    }

    parentNode.add(segmentMesh);
    segmentList.push(segmentMesh);

    if (s > 0) segmentMesh.position.y = segHeight;
    parentNode = segmentMesh;
  }

  scene.add(plantGroup);

  animatedPlants.push({
    nodes: segmentList,
    pos: pos.clone(),
    sway: 0.85 + random() * 0.3,
  });
}

const BUBBLE_SPOUT_X = 0;
const BUBBLE_SPOUT_Z = -1;

function resetBubble(b: THREE.Mesh, randomStart = false): void {
  b.position.x = BUBBLE_SPOUT_X + (random() - 0.5) * 0.8;
  b.position.y = randomStart
    ? -tankHeight / 2 + 1 + random() * (tankHeight - 2)
    : -tankHeight / 2 + 1;
  b.position.z = BUBBLE_SPOUT_Z + (random() - 0.5) * 0.8;

  const baseScale = 0.4 + random() * 1.5;
  b.scale.set(baseScale, baseScale, baseScale);

  b.userData = {
    speedY: 2.0 + random() * 2.5,
    driftSpeed: 3.0 + random() * 2.0,
    driftRadius: 0.05 + random() * 0.15,
    phase: random() * Math.PI * 2,
  };
}

function spawnBubbles(scene: THREE.Scene, bubbles: THREE.Mesh[], count: number): void {
  const bubbleGeo = new THREE.SphereGeometry(0.08, 6, 6);
  const bubbleMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.45,
    roughness: 0.0,
    metalness: 0.1,
    transmission: 0.9,
    ior: 1.1,
  });

  for (let i = 0; i < count; i++) {
    const b = new THREE.Mesh(bubbleGeo, bubbleMat);
    resetBubble(b, true);
    scene.add(b);
    bubbles.push(b);
  }
}

export function buildAquascape(scene: THREE.Scene): Aquascape {
  const animatedPlants: PlantSway[] = [];
  const bubbles: THREE.Mesh[] = [];
  const clickable: THREE.Object3D[] = [];

  // 유리 수조 외곽
  const glassGeo = new THREE.BoxGeometry(tankWidth, tankHeight, tankDepth);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0f7fa,
    transparent: true,
    opacity: 0.08,
    roughness: 0.1,
    metalness: 0.1,
    transmission: 0.6,
    ior: 1.5,
    side: THREE.BackSide,
  });
  scene.add(new THREE.Mesh(glassGeo, glassMat));

  // 모래(상단 밝은 층) — 정점을 변형해 부드러운 둔덕 생성
  const sandGeo = new THREE.PlaneGeometry(tankWidth, tankDepth, 40, 30);
  sandGeo.rotateX(-Math.PI / 2);
  const pos = sandGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    let vy = Math.sin(vx * 0.3) * Math.cos(vz * 0.3) * 0.4;
    vy += Math.sin(vx * 0.1) * 0.3;
    vy += (Math.abs(vx) / tankWidth) * 2;
    pos.setY(i, -tankHeight / 2 + vy + 1);
  }
  sandGeo.computeVertexNormals();
  const sandMat = new THREE.MeshStandardMaterial({
    color: 0x5b4f3a, // 어두운 아쿠아소일 톤(밝은 모래 대신, §2 팔레트)
    roughness: 0.95,
    metalness: 0.02,
    flatShading: true,
  });
  const sandMesh = new THREE.Mesh(sandGeo, sandMat);
  sandMesh.receiveShadow = true;
  scene.add(sandMesh);

  // 어두운 소일 하단 층
  const soilGeo = new THREE.BoxGeometry(tankWidth, 1, tankDepth);
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x2b221d, roughness: 1.0 });
  const soilMesh = new THREE.Mesh(soilGeo, soilMat);
  soilMesh.position.set(0, -tankHeight / 2 + 0.3, 0);
  soilMesh.receiveShadow = true;
  scene.add(soilMesh);

  // 수면
  const waterGeo = new THREE.PlaneGeometry(tankWidth, tankDepth, 30, 20);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x33e0ff,
    transparent: true,
    opacity: 0.25,
    roughness: 0.1,
    metalness: 0.8,
    transmission: 0.8,
    ior: 1.33,
    side: THREE.DoubleSide,
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.set(0, tankHeight / 2 - 0.5, 0);
  scene.add(waterMesh);

  // 1. 바위
  const rockData: {
    scale: [number, number, number];
    pos: [number, number, number];
    rot: [number, number, number];
    type: string;
  }[] = [
    { scale: [2, 3, 2], pos: [-7, -tankHeight / 2 + 1.8, -2], rot: [0.3, 0.4, -0.4], type: 'rock' },
    { scale: [1.5, 2.2, 1.5], pos: [-5, -tankHeight / 2 + 1.4, -1], rot: [-0.2, 0.5, 0.3], type: 'rock' },
    { scale: [1.8, 1.8, 2.2], pos: [-9, -tankHeight / 2 + 1.2, 1], rot: [0.1, -0.2, 0.6], type: 'rock' },
    { scale: [0.8, 0.8, 1], pos: [-1, -tankHeight / 2 + 0.9, 0], rot: [0.4, 0.8, -0.2], type: 'rock' },
    { scale: [1.2, 1, 0.8], pos: [2, -tankHeight / 2 + 0.8, -2], rot: [-0.4, -0.4, 0.1], type: 'rock' },
    { scale: [3.5, 1.5, 2.5], pos: [6, -tankHeight / 2 + 1.6, -1.5], rot: [0.1, -0.3, 0.15], type: 'rock' },
    { scale: [2.5, 1.2, 2.2], pos: [8.5, -tankHeight / 2 + 1.9, -0.5], rot: [-0.15, 0.5, -0.1], type: 'rock' },
    { scale: [1.8, 0.8, 1.8], pos: [5.2, -tankHeight / 2 + 2.3, 0.5], rot: [0.2, -0.8, -0.2], type: 'rock' },
  ];
  rockData.forEach((r) => {
    scene.add(createProceduralRock(r.scale, r.pos, r.rot, r.type, clickable));
    // 돌마다 윗면에 모스 덩어리 몇 개 — 레퍼런스의 이끼 덮인 층상석.
    const mossCount = 2 + Math.floor(random() * 3);
    for (let m = 0; m < mossCount; m++) {
      const mr = 0.35 + random() * 0.5;
      const mossPos = new THREE.Vector3(
        r.pos[0] + (random() - 0.5) * r.scale[0] * 1.4,
        r.pos[1] + r.scale[1] * 0.5 + random() * 0.3,
        r.pos[2] + (random() - 0.5) * r.scale[2] * 1.4,
      );
      const green = m % 2 === 0 ? 0x4a7a2e : 0x5f9636;
      scene.add(createMossClump(mossPos, mr, green));
    }
  });

  // 2. 유목 (좌측 언덕 분기 구조)
  const woodGroup = new THREE.Group();
  woodGroup.position.set(-7.5, -tankHeight / 2 + 2.5, -2);
  woodGroup.rotation.set(0.1, 0.3, -0.1);
  woodGroup.userData = { interactiveType: 'wood' };

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x422a1d, roughness: 0.95, metalness: 0.1 });

  const trunkGeo = new THREE.CylinderGeometry(0.7, 1.1, 5, 8);
  const trunk = new THREE.Mesh(trunkGeo, woodMat);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  woodGroup.add(trunk);

  const branches: { rTop: number; rBot: number; len: number; pos: [number, number, number]; rot: [number, number, number] }[] = [
    { rTop: 0.4, rBot: 0.7, len: 4.5, pos: [0.5, 1.5, 1], rot: [0.4, 0.5, 0.8] },
    { rTop: 0.3, rBot: 0.5, len: 4.2, pos: [-0.5, 1.8, -1], rot: [-0.3, -0.5, -0.6] },
    { rTop: 0.25, rBot: 0.4, len: 3.5, pos: [0.8, 0.2, 1.5], rot: [0.8, 0.9, 1.1] },
    { rTop: 0.2, rBot: 0.35, len: 3.2, pos: [-1, 0.1, 0], rot: [-0.5, 0.2, -1.2] },
    { rTop: 0.15, rBot: 0.25, len: 3.0, pos: [1.5, 2.8, 1.8], rot: [0.6, 1.1, 0.4] },
  ];
  branches.forEach((b) => {
    const bGeo = new THREE.CylinderGeometry(b.rTop, b.rBot, b.len, 6);
    bGeo.translate(0, b.len / 2, 0);
    const bMesh = new THREE.Mesh(bGeo, woodMat);
    bMesh.position.set(...b.pos);
    bMesh.rotation.set(...b.rot);
    bMesh.castShadow = true;
    bMesh.receiveShadow = true;
    woodGroup.add(bMesh);
  });

  clickable.push(woodGroup);
  scene.add(woodGroup);

  // 3. 노란 오리 장난감 (우측 층상석 위)
  const duckGroup = new THREE.Group();
  duckGroup.position.set(5.2, -tankHeight / 2 + 2.8, 0.5);
  duckGroup.rotation.set(0, -0.6, 0);
  duckGroup.userData = { interactiveType: 'duck' };

  const duckBodyGeo = new THREE.SphereGeometry(0.35, 16, 16);
  duckBodyGeo.scale(1.2, 1, 1);
  const duckMat = new THREE.MeshStandardMaterial({ color: 0xffd54f, roughness: 0.2, metalness: 0.0 });
  const duckBody = new THREE.Mesh(duckBodyGeo, duckMat);
  duckBody.castShadow = true;
  duckGroup.add(duckBody);

  const duckHeadGeo = new THREE.SphereGeometry(0.24, 16, 16);
  const duckHead = new THREE.Mesh(duckHeadGeo, duckMat);
  duckHead.position.set(0.25, 0.32, 0);
  duckHead.castShadow = true;
  duckGroup.add(duckHead);

  const beakGeo = new THREE.ConeGeometry(0.08, 0.16, 8);
  beakGeo.rotateZ(-Math.PI / 2);
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xff7043, roughness: 0.3 });
  const beak = new THREE.Mesh(beakGeo, beakMat);
  beak.position.set(0.48, 0.3, 0);
  duckGroup.add(beak);

  const eyeGeo = new THREE.SphereGeometry(0.03, 8, 8);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(0.35, 0.38, 0.12);
  const rightEye = leftEye.clone();
  rightEye.position.z = -0.12;
  duckGroup.add(leftEye, rightEye);

  clickable.push(duckGroup);
  scene.add(duckGroup);

  // 4. 수초 — 좌측 녹색 이끼/풀(무성하게), 우측 적색 줄기수초. §2 팔레트.
  //    색을 미세 변주(±)해 단색 균일 회피, 정글의 자연스러운 톤 편차를 낸다.
  const greenish = (): number => {
    // 감산: 채도 높은 그린(0x4a7e2e) → 올리브-세이지(0x5a6e44)로 한 단계 낮춤.
    // 톤 변주는 채널별로 상관(밝은↔어두운 올리브)되게 — 기존 단일 정수 가산은 채널 경계를 넘어
    // 청·자색 아웃라이어를 만들었다(팔레트 이탈). random() 1회 draw만 유지(결정론 보존).
    const t = random() - 0.5; // [-0.5, 0.5)
    // 2차 감산(Codex §1 H): 수초 녹색을 한 단계 더 어둡게 눌러 청록 배경과 레이어 분리.
    const r = THREE.MathUtils.clamp(0x50 + Math.round(t * 0x12), 0x3c, 0x62);
    const g = THREE.MathUtils.clamp(0x64 + Math.round(t * 0x16), 0x4c, 0x80); // 상한 0x80 (§2 0x8e보다 더 눌러 분리)
    const b = THREE.MathUtils.clamp(0x3e + Math.round(t * 0x0e), 0x28, 0x4c);
    return (r << 16) | (g << 8) | b;
  };
  for (let i = 0; i < 78; i++) {
    const x = -10.5 + random() * 5.5;
    const z = -4.2 + random() * 7;
    const y = getSubstrateHeight(x, z) + 0.2;
    const height = 0.8 + random() * 1.6;
    createSwayingPlant(scene, animatedPlants, new THREE.Vector3(x, y, z), height, greenish(), 0.06);
  }
  for (let i = 0; i < 46; i++) {
    const x = -4 + random() * 9;
    const z = -2.5 + random() * 5;
    const y = getSubstrateHeight(x, z) + 0.1;
    const height = 1.0 + random() * 1.9;
    // 감산→2차: 중경 라임(0x6fae3f)→올리브(0x6a8540)→더 어두운 올리브(0x5f7838)로 눌러 배경 분리.
    createSwayingPlant(scene, animatedPlants, new THREE.Vector3(x, y, z), height, 0x5f7838, 0.05);
  }
  // 적색 줄기수초 — 감산: 개수 62 → 44 로 솎고, x 분포 폭을 넓혀(6.5+5 → 5.5+7) '벽'을 분산.
  for (let i = 0; i < 44; i++) {
    const x = 5.5 + random() * 7;
    const z = -3.8 + random() * 7;
    const y = getSubstrateHeight(x, z) + 0.2;
    const height = 1.8 + random() * 3.5;
    // 톤 변주(자홍~심홍) + 일부 더 어둡게 섞어 벽의 균일감을 깬다.
    const r = random();
    const red = r < 0.4 ? 0x9c2f2b : r < 0.7 ? 0xb0432f : 0x6e2420;
    createSwayingPlant(scene, animatedPlants, new THREE.Vector3(x, y, z), height, red, 0.08);
  }
  // 전경 카펫 — 3차 감산(Codex): 24 → 20 로 더 솎고, 중앙 통로를 |x|<5 로 넓혀 모래 길 입구를 명확히.
  for (let i = 0; i < 20; i++) {
    const side = random() < 0.5 ? -1 : 1;
    const x = side * (5 + random() * 4); // ±[5,9], 중앙 통로 확대
    const z = 2.5 + random() * 3; // z 2.5~5.5 (최전경 비움)
    const y = getSubstrateHeight(x, z) + 0.1;
    const height = 0.5 + random() * 0.8;
    createSwayingPlant(scene, animatedPlants, new THREE.Vector3(x, y, z), height, greenish(), 0.05);
  }
  // 중경 모스 덩어리 — 돌 사이·바닥에 흩어 무성한 정글 바닥을 만든다.
  for (let i = 0; i < 22; i++) {
    const x = -8 + random() * 16;
    const z = -3 + random() * 6;
    const y = getSubstrateHeight(x, z) + 0.25;
    const green = random() < 0.5 ? 0x456f2a : 0x5a8a33;
    scene.add(createMossClump(new THREE.Vector3(x, y, z), 0.4 + random() * 0.45, green));
  }

  // 5. 기포
  spawnBubbles(scene, bubbles, 70);

  return { animatedPlants, bubbles, clickable };
}

// 수초 흔들림: 공유 흐름장. 위상을 월드 좌표(x·z)에서 유도해 전 수초가 한 물살처럼 함께 흔들린다.
// 마디 끝(tip)으로 갈수록 진폭이 커지고, 마디 위상 지연으로 물결이 캐스케이드한다.
const FLOW_SPEED = 0.9;
const FLOW_AMP = 0.13;

export function animatePlants(plants: PlantSway[], time: number): void {
  plants.forEach((plant) => {
    const flowPhase = time * FLOW_SPEED + plant.pos.x * 0.18 + plant.pos.z * 0.12;
    const segCount = plant.nodes.length;
    plant.nodes.forEach((node, idx) => {
      const tip = (idx + 1) / segCount; // 끝마디일수록 크게 흔들림
      const phase = flowPhase + idx * 0.5;
      const amp = FLOW_AMP * tip * plant.sway;
      node.rotation.z = Math.sin(phase) * amp;
      node.rotation.x = Math.cos(phase * 0.7) * amp * 0.5;
    });
  });
}

// 기포 상승 + 나선형 흔들림. 수면 도달 시 바닥에서 재생성.
export function animateBubbles(bubbles: THREE.Mesh[], delta: number, time: number): void {
  bubbles.forEach((b) => {
    b.position.y += b.userData.speedY * delta;
    b.position.x += Math.sin(time * b.userData.driftSpeed + b.userData.phase) * 0.02;
    b.position.z += Math.cos(time * b.userData.driftSpeed + b.userData.phase) * 0.02;

    if (b.position.y >= tankHeight / 2 - 0.6) {
      resetBubble(b, false);
    }
  });
}
