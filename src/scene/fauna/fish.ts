import * as THREE from 'three';
import { tankWidth, tankHeight, tankDepth } from '../aquascape';
import { random } from '../../lib/rng';

// 베타·네온테트라·코리도라스. 기존 index.html의 Fish 클래스·spawnFauna 를 동작 보존 이식.
// 공통 인터페이스: group + update(delta, time) (ARCHITECTURE 생물 패턴).

export type FishType = 'betta' | 'tetra' | 'corydoras';

interface FishMotionProfile {
  baseSpeed: number;
  steeringLerp: number;
  turnLerp: number;
  tailFreq: number;
  tailAmp: number;
}

export const fishMotionProfiles: Record<FishType, FishMotionProfile> = {
  betta: { baseSpeed: 0.8, steeringLerp: 0.055, turnLerp: 0.035, tailFreq: 3.4, tailAmp: 0.34 },
  tetra: { baseSpeed: 2.0, steeringLerp: 0.07, turnLerp: 0.045, tailFreq: 8.5, tailAmp: 0.22 },
  corydoras: { baseSpeed: 1.2, steeringLerp: 0.06, turnLerp: 0.04, tailFreq: 6.5, tailAmp: 0.2 },
};

export function turnSlowdownForDot(dot: number): number {
  const turnAmount = THREE.MathUtils.clamp((1 - dot) / 2, 0, 1);
  return 1 - turnAmount * 0.32;
}

export class Fish {
  readonly group: THREE.Group;
  readonly type: FishType;

  private readonly profile: FishMotionProfile;
  private readonly baseSpeed: number;
  private currentSpeed: number;
  private readonly scale: [number, number, number];

  private readonly position: THREE.Vector3;
  private readonly target = new THREE.Vector3();
  private readonly velocity: THREE.Vector3;
  private readonly flockSteer = new THREE.Vector3();

  private bodyMesh!: THREE.Mesh;
  private tailBase!: THREE.Group;
  private tailFin: THREE.Mesh | null = null;

  constructor(
    scene: THREE.Scene,
    type: FishType,
    colorHex: number,
    scale: [number, number, number],
    baseSpeed: number,
  ) {
    this.type = type;
    this.group = new THREE.Group();
    this.group.userData = { interactiveType: type };

    this.profile = fishMotionProfiles[type];
    this.baseSpeed = baseSpeed;
    this.currentSpeed = baseSpeed;
    this.scale = scale;

    this.position = new THREE.Vector3(
      (random() - 0.5) * (tankWidth - 4),
      (random() - 0.5) * (tankHeight - 6),
      (random() - 0.5) * (tankDepth - 4),
    );
    if (type === 'corydoras') {
      this.position.y = -tankHeight / 2 + 1.2;
    }

    this.pickNewTarget();

    this.velocity = new THREE.Vector3()
      .subVectors(this.target, this.position)
      .normalize()
      .multiplyScalar(this.baseSpeed);
    this.group.position.copy(this.position);

    this.buildModel(colorHex);
    scene.add(this.group);
  }

  private buildModel(colorHex: number): void {
    const fishMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.4, metalness: 0.2 });

    // 1. 몸통
    const bodyGeo = new THREE.SphereGeometry(0.6, 16, 16);
    bodyGeo.scale(2.2, 1.0, 0.6);
    this.bodyMesh = new THREE.Mesh(bodyGeo, fishMat);
    this.bodyMesh.castShadow = true;
    this.group.add(this.bodyMesh);

    // 2. 꼬리 계층 (유연한 흔들림)
    this.tailBase = new THREE.Group();
    this.tailBase.position.set(-1.2, 0, 0);
    this.group.add(this.tailBase);

    const tailBaseGeo = new THREE.CylinderGeometry(0.2, 0.4, 0.8, 8);
    tailBaseGeo.rotateZ(Math.PI / 2);
    const tailBaseMesh = new THREE.Mesh(tailBaseGeo, fishMat);
    tailBaseMesh.castShadow = true;
    this.tailBase.add(tailBaseMesh);

    if (this.type === 'betta') {
      // 흐르는 베일테일 — 불투명 판때기 대신 반투명 베일(depthWrite off로 부드럽게 겹침).
      const finGeo = new THREE.PlaneGeometry(2.4, 1.9, 6, 6);
      finGeo.translate(-1.2, 0, 0);
      // 사각 패널을 베일테일로 — 몸쪽은 좁고 꼬리 끝으로 갈수록 부채처럼 펼쳐지게 테이퍼.
      const finPos = finGeo.attributes.position;
      for (let i = 0; i < finPos.count; i++) {
        const x = finPos.getX(i); // [-2.4, 0]
        const tEdge = THREE.MathUtils.clamp(-x / 2.4, 0, 1); // 0=몸통, 1=꼬리끝
        const widthScale = 0.2 + tEdge * 1.05;
        finPos.setY(i, finPos.getY(i) * widthScale);
      }
      finGeo.computeVertexNormals();
      const finMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        roughness: 0.35,
        metalness: 0.0,
        depthWrite: false,
      });
      this.tailFin = new THREE.Mesh(finGeo, finMat);
      this.tailBase.add(this.tailFin);

      const dFinGeo = new THREE.PlaneGeometry(1.4, 1.2, 4, 4);
      dFinGeo.translate(-0.3, 0.7, 0);
      const dFin = new THREE.Mesh(dFinGeo, finMat);
      dFin.rotation.z = -0.3;
      this.group.add(dFin);

      const vFinGeo = new THREE.PlaneGeometry(1.4, 1.2, 4, 4);
      vFinGeo.translate(-0.3, -0.7, 0);
      const vFin = new THREE.Mesh(vFinGeo, finMat);
      vFin.rotation.z = 0.3;
      this.group.add(vFin);
    } else if (this.type === 'tetra') {
      const finGeo = new THREE.ConeGeometry(0.5, 1.2, 3);
      finGeo.rotateZ(Math.PI / 2);
      const finMesh = new THREE.Mesh(finGeo, fishMat);
      finMesh.position.set(-0.6, 0, 0);
      finMesh.castShadow = true;
      this.tailBase.add(finMesh);

      // 발광 네온 스트라이프
      const stripeGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.8, 8);
      stripeGeo.rotateZ(Math.PI / 2);
      // 글로우 '틴트'와 '원시 휘도'를 분리 — 채도/명도 낮춘 청록 소스 색이라
      // Bloom이 가장자리 sheen만 잡고 실루엣 전체가 네온 디스크로 타버리지 않는다.
      const stripeMat = new THREE.MeshStandardMaterial({
        color: 0x0c7580,
        emissive: 0x1aa6b0,
        emissiveIntensity: 1.15, // 맑은 day 모드에서도 묻히지 않는 은은한 청록 sheen
        roughness: 0.2,
      });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.position.set(0.1, 0.2, 0.22);
      this.group.add(stripe);

      const stripeRight = stripe.clone();
      stripeRight.position.z = -0.22;
      this.group.add(stripeRight);
    } else {
      // corydoras — 통통한 바닥 거주자
      this.bodyMesh.scale.set(1.4, 0.9, 0.9);

      const coryFinGeo = new THREE.ConeGeometry(0.4, 0.8, 4);
      coryFinGeo.rotateZ(Math.PI / 2);
      const coryFin = new THREE.Mesh(coryFinGeo, fishMat);
      coryFin.position.set(-0.5, 0, 0);
      this.tailBase.add(coryFin);

      const whiskerMat = new THREE.MeshStandardMaterial({ color: 0xe8ccd7 });
      const whiskerGeo = new THREE.ConeGeometry(0.04, 0.25, 4);
      whiskerGeo.rotateX(Math.PI / 3);
      const leftW = new THREE.Mesh(whiskerGeo, whiskerMat);
      leftW.position.set(0.7, -0.3, 0.15);
      const rightW = leftW.clone();
      rightW.position.z = -0.15;
      this.group.add(leftW, rightW);
    }

    // 눈
    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(0.8, 0.25, 0.35);
    const rightEye = leftEye.clone();
    rightEye.position.z = -0.35;
    this.group.add(leftEye, rightEye);

    this.group.scale.set(...this.scale);
  }

  private pickNewTarget(): void {
    const boundsX = tankWidth / 2 - 3.5;
    const boundsY = tankHeight / 2 - 3.0;
    const boundsZ = tankDepth / 2 - 2.5;

    this.target.set(
      (random() - 0.5) * boundsX * 2,
      this.type === 'corydoras'
        ? -tankHeight / 2 + 1.2 + random() * 1.5
        : (random() - 0.5) * boundsY * 2,
      (random() - 0.5) * boundsZ * 2,
    );

    this.currentSpeed = this.baseSpeed * (0.8 + random() * 0.5);
  }

  update(delta: number, time: number, flock?: Fish[], speedMul = 1): void {
    const distanceToTarget = this.position.distanceTo(this.target);
    if (distanceToTarget < 2.0) {
      this.pickNewTarget();
    }

    const dir = new THREE.Vector3().subVectors(this.target, this.position).normalize();

    // 테트라 군영: 같은 종 이웃과 응집(cohesion) + 근접 분리(separation)를 진행 방향에 섞어
    // 무리지어 헤엄치게 한다(일률적 직선 금지). 결정론적(난수 없음).
    if (this.type === 'tetra' && flock) {
      const center = new THREE.Vector3();
      const sep = new THREE.Vector3();
      const rawFlockSteer = new THREE.Vector3();
      let n = 0;
      for (const other of flock) {
        if (other === this || other.type !== 'tetra') continue;
        center.add(other.position);
        n++;
        const d = this.position.distanceTo(other.position);
        // 더 넓은 분리 반경 + 강한 분리 → 균일 간격 일렬(에셜론) 회피, 느슨한 군집.
        if (d > 0 && d < 3.2) {
          sep.add(new THREE.Vector3().subVectors(this.position, other.position).divideScalar(d));
        }
      }
      if (n > 0) {
        center.divideScalar(n);
        const cohesion = new THREE.Vector3().subVectors(center, this.position).normalize();
        rawFlockSteer.addScaledVector(cohesion, 0.32);
        rawFlockSteer.addScaledVector(sep, 0.55);
      }
      this.flockSteer.lerp(rawFlockSteer, 0.06);
      dir.add(this.flockSteer).normalize();
    }

    // 위치 전진 (속도 벡터 Lerp Steering 관성 적용)
    const currentDir = this.velocity.lengthSq() > 0.001 ? this.velocity.clone().normalize() : dir;
    const turnSlowdown = turnSlowdownForDot(currentDir.dot(dir));
    const targetVelocity = new THREE.Vector3()
      .copy(dir)
      .multiplyScalar(this.currentSpeed * speedMul * turnSlowdown);
    this.velocity.lerp(targetVelocity, this.profile.steeringLerp);
    this.position.addScaledVector(this.velocity, delta);
    this.group.position.copy(this.position);

    // 실제 이동 방향(velocity)의 각도와 피치 계산
    const actualDir = this.velocity.clone().normalize();
    const useDir = this.velocity.lengthSq() > 0.001 ? actualDir : dir;

    // 진행 방향으로 점진 선회
    const targetRotation = Math.atan2(-useDir.z, useDir.x);
    let diff = targetRotation - this.group.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.group.rotation.y += diff * this.profile.turnLerp;

    // 상하 피치
    const pitch = useDir.y * 0.4;
    this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, pitch, 0.05);

    // 꼬리 흔들기 — 실제 속도에 연동해 감속 시 꼬리도 차분해진다.
    const speedRatio = THREE.MathUtils.clamp(this.velocity.length() / Math.max(this.baseSpeed * speedMul, 0.001), 0.35, 1.25);
    const wagFreq = this.profile.tailFreq * speedRatio;
    const wagAmp = this.profile.tailAmp * (0.75 + speedRatio * 0.25);
    this.tailBase.rotation.y = Math.sin(time * wagFreq) * wagAmp;

    // 베타 꼬리지느러미 지연 흔들림
    if (this.type === 'betta' && this.tailFin) {
      this.tailFin.rotation.y = Math.sin(time * wagFreq - 1.2) * 0.3;
    }
  }
}

// 다종 개체군 생성: 베타 1 + 네온테트라 6 + 코리도라스 3.
export function spawnFauna(scene: THREE.Scene): Fish[] {
  const fishList: Fish[] = [];

  fishList.push(new Fish(scene, 'betta', 0xc62828, [0.78, 0.78, 0.78], 0.8));

  for (let i = 0; i < 6; i++) {
    fishList.push(new Fish(scene, 'tetra', 0x3a3a3a, [0.45, 0.45, 0.45], 2.0));
  }

  for (let i = 0; i < 3; i++) {
    fishList.push(new Fish(scene, 'corydoras', 0xe0c1b3, [0.70, 0.70, 0.70], 1.2)); // §3 바닥 청소부 존재감 0.65→0.70
  }

  return fishList;
}
