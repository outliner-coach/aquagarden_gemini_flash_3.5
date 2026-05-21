import * as THREE from 'three';
import { tankWidth, tankHeight, tankDepth } from '../aquascape';
import { random } from '../../lib/rng';

// 베타·네온테트라·코리도라스. 기존 index.html의 Fish 클래스·spawnFauna 를 동작 보존 이식.
// 공통 인터페이스: group + update(delta, time) (ARCHITECTURE 생물 패턴).

export type FishType = 'betta' | 'tetra' | 'corydoras';

export class Fish {
  readonly group: THREE.Group;
  readonly type: FishType;

  private readonly baseSpeed: number;
  private currentSpeed: number;
  private readonly scale: [number, number, number];

  private readonly position: THREE.Vector3;
  private readonly target = new THREE.Vector3();
  private readonly velocity: THREE.Vector3;

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
      const stripeMat = new THREE.MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00e5ff,
        emissiveIntensity: 1.5,
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

  update(delta: number, time: number, flock?: Fish[]): void {
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
      let n = 0;
      for (const other of flock) {
        if (other === this || other.type !== 'tetra') continue;
        center.add(other.position);
        n++;
        const d = this.position.distanceTo(other.position);
        if (d > 0 && d < 2.0) {
          sep.add(new THREE.Vector3().subVectors(this.position, other.position).divideScalar(d));
        }
      }
      if (n > 0) {
        center.divideScalar(n);
        const cohesion = new THREE.Vector3().subVectors(center, this.position).normalize();
        dir.addScaledVector(cohesion, 0.5);
        dir.addScaledVector(sep, 0.35);
        dir.normalize();
      }
    }

    // 진행 방향으로 점진 선회
    const targetRotation = Math.atan2(-dir.z, dir.x);
    let diff = targetRotation - this.group.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.group.rotation.y += diff * 0.04;

    // 상하 피치
    const pitch = dir.y * 0.4;
    this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, pitch, 0.05);

    // 위치 전진
    this.velocity.copy(dir).multiplyScalar(this.currentSpeed);
    this.position.addScaledVector(this.velocity, delta);
    this.group.position.copy(this.position);

    // 꼬리 흔들기 — 속도가 빠른 종일수록 빠르게
    const wagFreq = this.type === 'tetra' ? 14 : this.type === 'betta' ? 5 : 11;
    const wagAmp = this.type === 'betta' ? 0.4 : 0.25;
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

  fishList.push(new Fish(scene, 'betta', 0xd32f2f, [0.85, 0.85, 0.85], 1.4));

  for (let i = 0; i < 6; i++) {
    fishList.push(new Fish(scene, 'tetra', 0x3a3a3a, [0.45, 0.45, 0.45], 3.8));
  }

  for (let i = 0; i < 3; i++) {
    fishList.push(new Fish(scene, 'corydoras', 0xe0c1b3, [0.65, 0.65, 0.65], 2.2));
  }

  return fishList;
}
