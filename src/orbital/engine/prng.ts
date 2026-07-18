/**
 * Seeded pseudo-random number generation for procedural track work.
 * Mulberry32: tiny, fast, deterministic.
 */

export type PRNG = () => number;

export function mulberry32(seed: number): PRNG {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng: PRNG, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function int(rng: PRNG, min: number, max: number): number {
  return Math.floor(range(rng, min, max + 1));
}

export function pick<T>(rng: PRNG, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function shuffle<T>(rng: PRNG, arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Random seed from the clock, used for random runs. */
export function randomSeed(): number {
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
}
