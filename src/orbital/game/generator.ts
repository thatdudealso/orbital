/**
 * RANDOM RUN: seeded procedural track generator for logged-in players.
 * Picks a random biome + random difficulty tier, then stitches segment
 * templates into a track that never repeats.
 */

import { mulberry32, pick, range, int } from '../engine/prng';
import { BIOME_ORDER } from './biomes';
import type { SegmentSpec } from './segments';

export interface RandomRunSpec {
  seed: number;
  biomeId: string;
  difficulty: 1 | 2 | 3;
  difficultyLabel: string;
  parTimeSec: number;
  segments: SegmentSpec[];
}

const DIFFICULTY_LABELS = ['', 'CHILL', 'SPICY', 'MERCILESS'] as const;

/** Segment pools that always make sense regardless of biome. */
const FLOW: SegmentSpec[][] = [
  [{ kind: 'platform', length: 12 }],
  [{ kind: 'platform', length: 10 }, { kind: 'shards', pattern: 'line', over: 9 }],
  [{ kind: 'ramp', length: 10, rise: 3 }],
  [{ kind: 'ramp', length: 12, rise: -4 }],
  [{ kind: 'curve', angle: 90, radius: 12, dir: 1, width: 6 }],
  [{ kind: 'curve', angle: 90, radius: 12, dir: -1, width: 6 }],
  [{ kind: 'narrow', length: 12, width: 2.2 }],
  [{ kind: 'halfpipe', length: 16, width: 7 }],
];

const HAZARD_POOLS: Record<number, SegmentSpec[][]> = {
  1: [
    [{ kind: 'gap', length: 3.5 }, { kind: 'platform', length: 8 }],
    [{ kind: 'spinners', length: 12, count: 1, speed: 1.1 }],
    [{ kind: 'bounces', count: 2, spacing: 8, power: 10 }],
    [{ kind: 'dragZone', length: 8, strength: 2.4 }],
  ],
  2: [
    [{ kind: 'gap', length: 5 }, { kind: 'platform', length: 6 }],
    [{ kind: 'spinners', length: 14, count: 2, speed: 1.3 }],
    [{ kind: 'sweepers', length: 14, count: 2, speed: 1.1 }],
    [{ kind: 'movers', count: 2, axis: 'x', distance: 5, speed: 1, spacing: 6.5 }],
    [{ kind: 'falling', length: 12, tile: 2.6 }],
    [{ kind: 'lasers', length: 14, count: 2, period: 2.4 }],
    [{ kind: 'wind', length: 12, dirX: 1, strength: 13 }],
    [{ kind: 'slickZone', length: 12, width: 4.5 }],
  ],
  3: [
    [{ kind: 'gap', length: 6.5 }, { kind: 'platform', length: 6 }],
    [{ kind: 'spinners', length: 16, count: 3, speed: 1.6 }],
    [{ kind: 'pistons', length: 14, count: 3, speed: 0.65 }],
    [{ kind: 'movers', count: 3, axis: 'x', distance: 6, speed: 1.2, spacing: 6.5 }],
    [{ kind: 'falling', length: 16, tile: 2.6 }],
    [{ kind: 'lasers', length: 16, count: 3, period: 2 }],
    [{ kind: 'hazards', length: 14, count: 4 }],
    [{ kind: 'narrow', length: 14, width: 1.7 }],
  ],
};

const POWER_POOL: SegmentSpec[] = [
  { kind: 'powerup', power: 'boost' },
  { kind: 'powerup', power: 'shield' },
  { kind: 'powerup', power: 'magnet' },
];

export function generateRandomRun(seed: number): RandomRunSpec {
  const rng = mulberry32(seed);
  const biomeId = pick(rng, BIOME_ORDER);
  const difficulty = int(rng, 1, 3) as 1 | 2 | 3;

  const segmentCount = 8 + difficulty * 2; // 10 / 12 / 14 body segments
  const segments: SegmentSpec[] = [{ kind: 'platform', length: 14 }];

  for (let i = 0; i < segmentCount; i++) {
    // weave flow pieces with hazard pieces; checkpoint every 3-4
    const isCheckpoint = (i + 1) % 4 === 0;
    if (isCheckpoint) {
      segments.push({ kind: 'checkpoint' });
      continue;
    }
    const useHazard = rng() < 0.45 + difficulty * 0.15;
    if (useHazard) {
      const pool = HAZARD_POOLS[Math.min(difficulty, 3)];
      for (const s of pick(rng, pool)) segments.push(s);
      // sometimes spike with a shard reward right after danger
      if (rng() < 0.35) segments.push({ kind: 'shards', pattern: rng() < 0.5 ? 'line' : 'arc', over: 9 });
    } else {
      for (const s of pick(rng, FLOW)) segments.push({ ...s });
    }
    if (rng() < 0.12) segments.push(pick(rng, POWER_POOL));
  }
  segments.push({ kind: 'goal' });

  // rough par: total length estimate / 9 m/s + deaths buffer
  const est = segments.reduce((acc, s) => acc + ('length' in s ? (s.length as number) : 8), 0);
  const parTimeSec = Math.round((est / 8.5) * (1 + difficulty * 0.12));

  return {
    seed,
    biomeId,
    difficulty,
    difficultyLabel: DIFFICULTY_LABELS[difficulty],
    parTimeSec,
    segments,
  };
}
