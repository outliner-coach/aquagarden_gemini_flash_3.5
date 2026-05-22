// 시드 가능한 PRNG (mulberry32). 씬의 모든 난수를 이 모듈로 통일해
// 동일 시드 → 동일 프레임을 보장한다(캡처 결정론). 기본값은 Date.now() 시드라
// 일반 실행 시엔 매번 다른 배치가 나온다(기존 Math.random 동작 보존).

let state = (Date.now() >>> 0) || 0x9e3779b9;

// 캡처 모드에서 고정 시드를 주입한다. 0은 PRNG가 멈추므로 폴백 상수로 대체.
export function seedRng(seed: number): void {
  state = (seed >>> 0) || 0x9e3779b9;
}

// [0, 1) 균등 난수. Math.random()의 드롭인 대체.
export function random(): number {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
