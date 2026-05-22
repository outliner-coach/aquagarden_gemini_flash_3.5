import * as THREE from 'three';
import { tankWidth, tankHeight, tankDepth } from '../aquascape';
import { random } from '../../lib/rng';

// 저서 무척추 — 아마노 새우(바닥 청소부)·달팽이(유리벽 거주). §5.
// 공통 인터페이스 { group, update(delta, time) } 로 씬 루프가 물고기와 동일하게 다룬다(ARCHITECTURE).

export interface Critter {
  readonly group: THREE.Group;
  update(delta: number, time: number): void;
}

const BOTTOM_Y = -tankHeight / 2;

/** 아마노 새우 — 소형·반투명, 바닥을 따라 천천히 기어다니며 더듬이를 흔든다. */
export class Shrimp implements Critter {
  readonly group = new THREE.Group();
  private readonly position: THREE.Vector3;
  private readonly target = new THREE.Vector3();
  private readonly speed: number;
  private readonly phase: number;
  private antennae!: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.group.userData = { interactiveType: 'shrimp' };
    this.speed = 0.25 + random() * 0.18;
    this.phase = random() * Math.PI * 2;
    this.position = new THREE.Vector3(
      (random() - 0.5) * (tankWidth - 6),
      BOTTOM_Y + 0.5,
      (random() - 0.5) * (tankDepth - 4),
    );
    this.pickTarget();
    this.buildModel();
    this.group.scale.setScalar(0.5);
    this.group.position.copy(this.position);
    scene.add(this.group);
  }

  private pickTarget(): void {
    this.target.set(
      (random() - 0.5) * (tankWidth - 6),
      BOTTOM_Y + 0.5,
      (random() - 0.5) * (tankDepth - 4),
    );
  }

  private buildModel(): void {
    // 반투명 아마노 톤(맑은 회녹).
    const mat = new THREE.MeshStandardMaterial({
      color: 0xcdbfae,
      roughness: 0.5,
      metalness: 0.0,
      transparent: true,
      opacity: 0.6,
    });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.7, 4, 8), mat);
    body.rotation.z = Math.PI / 2;
    body.rotation.x = 0.3;
    this.group.add(body);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.3, 6), mat);
    tail.position.set(-0.5, 0.05, 0);
    tail.rotation.z = Math.PI / 2;
    this.group.add(tail);
    this.antennae = new THREE.Group();
    const antMat = new THREE.MeshStandardMaterial({ color: 0xb7a896, transparent: true, opacity: 0.5 });
    for (const s of [-1, 1]) {
      // 더듬이를 조금 굵고 길게 — 위젯 크기에서 '새우' 존재감을 살린다(Codex 리뷰).
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.014, 0.85, 4), antMat);
      ant.position.set(0.55, 0.12, s * 0.06);
      ant.rotation.z = -0.7;
      this.antennae.add(ant);
    }
    this.group.add(this.antennae);
  }

  update(delta: number, time: number): void {
    if (this.position.distanceTo(this.target) < 0.5) this.pickTarget();
    const dir = new THREE.Vector3().subVectors(this.target, this.position);
    dir.y = 0;
    dir.normalize();
    this.position.addScaledVector(dir, this.speed * delta);
    this.position.y = BOTTOM_Y + 0.5;
    this.group.position.copy(this.position);
    this.group.position.y += Math.sin(time * 5 + this.phase) * 0.03; // 미세 들썩임
    const targetRotation = Math.atan2(-dir.z, dir.x);
    let diff = targetRotation - this.group.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.group.rotation.y += diff * 0.06;
    this.antennae.rotation.y = Math.sin(time * 3 + this.phase) * 0.3; // 더듬이 흔들림
  }
}

/** 달팽이 — 거의 정지. 아주 느린 좌우 기어가기 + 눈자루(더듬이) 흔들림. */
export class Snail implements Critter {
  readonly group = new THREE.Group();
  private readonly phase: number;
  private readonly creepDir: number;
  private readonly baseX: number;
  private eyeStalks!: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.group.userData = { interactiveType: 'snail' };
    this.phase = random() * Math.PI * 2;
    this.creepDir = random() < 0.5 ? -1 : 1;
    this.baseX = (random() - 0.5) * (tankWidth - 8);
    this.group.position.set(this.baseX, BOTTOM_Y + 0.4, (random() - 0.5) * (tankDepth - 5));
    this.buildModel();
    this.group.scale.setScalar(0.6);
    scene.add(this.group);
  }

  private buildModel(): void {
    const shellMat = new THREE.MeshStandardMaterial({ color: 0x9c6b3f, roughness: 0.6, metalness: 0.05 });
    const footMat = new THREE.MeshStandardMaterial({ color: 0xd8c2b0, roughness: 0.85 });
    const shell = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.18, 8, 16), shellMat);
    shell.position.y = 0.3;
    shell.rotation.x = Math.PI / 2;
    this.group.add(shell);
    const shellCap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), shellMat);
    shellCap.position.set(0, 0.35, 0);
    this.group.add(shellCap);
    // 어두운 나선 띠 — 작은 위젯에서 껍데기 실루엣을 또렷이(Codex 리뷰).
    const accent = new THREE.Mesh(
      new THREE.TorusGeometry(0.33, 0.05, 6, 16),
      new THREE.MeshStandardMaterial({ color: 0x5e3a1f, roughness: 0.7 }),
    );
    accent.position.y = 0.3;
    accent.rotation.x = Math.PI / 2;
    this.group.add(accent);
    const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.7, 4, 8), footMat);
    foot.rotation.z = Math.PI / 2;
    foot.scale.set(1, 0.5, 0.7);
    foot.position.y = 0.05;
    this.group.add(foot);
    this.eyeStalks = new THREE.Group();
    this.eyeStalks.position.set(0.45, 0.1, 0);
    for (const s of [-1, 1]) {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 4), footMat);
      stalk.position.set(0, 0.15, s * 0.1);
      stalk.rotation.z = -0.4;
      this.eyeStalks.add(stalk);
    }
    this.group.add(this.eyeStalks);
  }

  update(_delta: number, time: number): void {
    this.group.position.x = this.baseX + Math.sin(time * 0.15 + this.phase) * 0.6 * this.creepDir;
    this.eyeStalks.rotation.z = Math.sin(time * 1.5 + this.phase) * 0.2;
  }
}

/** 무척추 생물을 스폰한다 — 새우 3, 달팽이 2. */
export function spawnInverts(scene: THREE.Scene): Critter[] {
  const critters: Critter[] = [];
  for (let i = 0; i < 3; i++) critters.push(new Shrimp(scene));
  for (let i = 0; i < 2; i++) critters.push(new Snail(scene));
  return critters;
}
