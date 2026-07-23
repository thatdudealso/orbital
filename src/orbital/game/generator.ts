/**
 * RANDOM RUN: seeded procedural track generator for logged-in players.
 * Picks a random biome (Act I + Act II) + difficulty tier, then stitches
 * segment templates - including the full Act II kit - into a track that
 * never repeats. Controls are unrelated; this only authors SegmentSpec[].
 */

import { mulberry32, pick, int } from '../engine/prng';
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
  // Act II flow spice
  [{ kind: 'conveyor', length: 12, strength: 16 }],
  [{ kind: 'slickZone', length: 12, width: 5 }],
];

/** Classic Act I hazards + Act II kit, tuned per difficulty. */
const HAZARD_POOLS: Record<number, SegmentSpec[][]> = {
  1: [
    [{ kind: 'gap', length: 3.5 }, { kind: 'platform', length: 8 }],
    [{ kind: 'spinners', length: 12, count: 1, speed: 1.1 }],
    [{ kind: 'bounces', count: 2, spacing: 8, power: 10 }],
    [{ kind: 'dragZone', length: 8, strength: 2.4 }],
    [{ kind: 'conveyor', length: 10, strength: 14 }],
    [{ kind: 'gates', length: 12, count: 1, period: 2.8 }],
    [{ kind: 'rings', length: 12, count: 1, speed: 1.1 }],
    [{ kind: 'seesaws', count: 1, spacing: 9, amp: 0.26, speed: 0.65 }],
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
    [{ kind: 'gates', length: 14, count: 2, period: 2.5 }],
    [{ kind: 'rings', length: 14, count: 2, speed: 1.3 }],
    [{ kind: 'seesaws', count: 2, spacing: 9, amp: 0.3, speed: 0.75 }],
    [{ kind: 'conveyor', length: 12, strength: 18 }],
    [{ kind: 'crushers', length: 14, count: 2, period: 2.2 }],
    [{ kind: 'portal', gap: 10 }],
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
    [{ kind: 'crushers', length: 16, count: 3, period: 2 }],
    [{ kind: 'gates', length: 16, count: 3, period: 2.2 }],
    [{ kind: 'rings', length: 16, count: 3, speed: 1.5 }],
    [{ kind: 'portal', gap: 11 }],
    [{ kind: 'seesaws', count: 3, spacing: 8.5, amp: 0.34, speed: 0.85 }],
    [{ kind: 'conveyor', length: 14, strength: 22 }],
    [{ kind: 'wind', length: 14, dirX: -1, strength: 16 }],
    [{ kind: 'gravityZone', length: 12, gravity: 3.2 }, { kind: 'gap', length: 7 }, { kind: 'platform', length: 6 }],
    [{ kind: 'gravityZone', length: 10, gravity: 12.5 }, { kind: 'crushers', length: 12, count: 2, period: 2 }],
  ],
};

/** All campaign powerups - Act I classics + Act II phase/dash/echo. */
const POWER_POOL: SegmentSpec[] = [
  { kind: 'powerup', power: 'boost' },
  { kind: 'powerup', power: 'shield' },
  { kind: 'powerup', power: 'magnet' },
  { kind: 'powerup', power: 'slow' },
  { kind: 'powerup', power: 'anchor' },
  { kind: 'powerup', power: 'phase' },
  { kind: 'powerup', power: 'dash' },
  { kind: 'powerup', power: 'echo' },
];

/** Act II-only hazard set - used to guarantee at least one new-kit beat per run. */
const ACT2_HAZARDS: SegmentSpec[][] = [
  [{ kind: 'gates', length: 14, count: 2, period: 2.5 }],
  [{ kind: 'rings', length: 14, count: 2, speed: 1.3 }],
  [{ kind: 'seesaws', count: 2, spacing: 9, amp: 0.3, speed: 0.75 }],
  [{ kind: 'crushers', length: 14, count: 2, period: 2.15 }],
  [{ kind: 'conveyor', length: 12, strength: 18 }],
  [{ kind: 'portal', gap: 11 }],
];

const ACT2_POWERS: SegmentSpec[] = [
  { kind: 'powerup', power: 'phase' },
  { kind: 'powerup', power: 'dash' },
  { kind: 'powerup', power: 'echo' },
];

function isAct2Biome(id: string): boolean {
  const idx = (BIOME_ORDER as readonly string[]).indexOf(id);
  return idx >= 10;
}

export function generateRandomRun(seed: number): RandomRunSpec {
  const rng = mulberry32(seed);
  // Full campaign biome pool (Act I + Act II) - equal weight.
  const biomeId = pick(rng, BIOME_ORDER as unknown as string[]);
  const difficulty = int(rng, 1, 3) as 1 | 2 | 3;

  // Longer than pre-Act-II runs so generated tracks feel closer to campaign length.
  // CHILL ~14 body slots, SPICY ~18, MERCILESS ~22 (+ checkpoints).
  const segmentCount = 12 + difficulty * 4;
  const segments: SegmentSpec[] = [{ kind: 'platform', length: 14 }];

  let injectedAct2Hazard = false;
  let injectedAct2Power = false;

  for (let i = 0; i < segmentCount; i++) {
    // checkpoint every 3-4 body slots - never adjacent
    const isCheckpoint = (i + 1) % 4 === 0;
    if (isCheckpoint) {
      segments.push({ kind: 'checkpoint' });
      continue;
    }

    // Guarantee one Act II hazard beat mid-run so new kit always appears.
    if (!injectedAct2Hazard && i >= Math.floor(segmentCount * 0.35)) {
      for (const s of pick(rng, ACT2_HAZARDS)) segments.push(s);
      if (rng() < 0.45) segments.push({ kind: 'shards', pattern: rng() < 0.5 ? 'line' : 'arc', over: 9 });
      injectedAct2Hazard = true;
      // often pair the new hazard with its matching powerup
      if (rng() < 0.55) {
        segments.push(pick(rng, ACT2_POWERS));
        injectedAct2Power = true;
      }
      continue;
    }

    const useHazard = rng() < 0.45 + difficulty * 0.15;
    if (useHazard) {
      const pool = HAZARD_POOLS[Math.min(difficulty, 3)];
      for (const s of pick(rng, pool)) segments.push(s);
      if (rng() < 0.35) segments.push({ kind: 'shards', pattern: rng() < 0.5 ? 'line' : 'arc', over: 9 });
    } else {
      for (const s of pick(rng, FLOW)) segments.push({ ...s });
    }

    // powerups a bit more often on Act II biomes / higher difficulty
    const powerChance = 0.12 + (isAct2Biome(biomeId) ? 0.06 : 0) + difficulty * 0.02;
    if (rng() < powerChance) {
      const p = pick(rng, POWER_POOL);
      segments.push(p);
      if (p.kind === 'powerup' && (p.power === 'phase' || p.power === 'dash' || p.power === 'echo')) {
        injectedAct2Power = true;
      }
    }
  }

  // If the mid-run injection somehow missed a power, drop one before the goal.
  if (!injectedAct2Power) {
    segments.push(pick(rng, ACT2_POWERS));
  }

  segments.push({ kind: 'goal' });

  // rough par: total length estimate / 8.5 m/s + difficulty buffer
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
