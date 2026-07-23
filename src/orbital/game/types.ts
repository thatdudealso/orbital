/**
 * Shared gameplay types: sensors, zones, updatables, build context.
 */

import * as THREE from 'three';
import type { RAPIER } from '../engine/physics';
import type { PRNG } from '../engine/prng';
import type { QualitySettings } from '../engine/quality';
import type { ParticlePool } from '../engine/particles';
import type { Sfx } from '../engine/audio';
import type { Materials } from './materials';
import type { BiomeDef } from './biomes';

export type PowerupType =
  | 'boost'
  | 'shield'
  | 'magnet'
  | 'slow'
  | 'anchor'
  | 'phase'
  | 'dash'
  | 'echo';

export interface ZoneEffect {
  kind: 'drag' | 'wind' | 'gravity' | 'conveyor';
  value: number;
  dir?: THREE.Vector3;
}

export type SensorData =
  | { type: 'checkpoint'; index: number; pos: THREE.Vector3 }
  | { type: 'powerup'; id: number; power: PowerupType }
  | { type: 'shard'; id: number }
  | { type: 'hazard'; kind: 'lava' | 'laser' | 'crusher' }
  | { type: 'goal' }
  | { type: 'zone'; zone: ZoneEffect }
  | { type: 'bounce'; power: number; forward?: THREE.Vector3 }
  | { type: 'boostpad'; dir: THREE.Vector3; power: number }
  | { type: 'teleport'; exit: THREE.Vector3; heading: number };

/** Collider handle -> gameplay meaning. */
export class SensorRegistry {
  private readonly map = new Map<number, SensorData>();
  register(collider: RAPIER.Collider, data: SensorData): void {
    this.map.set(collider.handle, data);
  }
  get(handle: number): SensorData | undefined {
    return this.map.get(handle);
  }
  remove(handle: number): void {
    this.map.delete(handle);
  }
}

/** Anything animated or stateful that ticks with the sim. */
export interface Updatable {
  update(dt: number, time: number): void;
}

export interface ShardInstance {
  id: number;
  mesh: THREE.Object3D;
  pos: THREE.Vector3;
  collected: boolean;
}

export interface PowerupInstance {
  id: number;
  power: PowerupType;
  mesh: THREE.Object3D;
  pos: THREE.Vector3;
  taken: boolean;
  respawnAt: number;
}

export interface CheckpointInstance {
  index: number;
  pos: THREE.Vector3;
  ring: THREE.Object3D;
  activated: boolean;
}

/** Services passed to every segment/obstacle builder. */
export interface BuildCtx {
  scene: THREE.Group;
  world: RAPIER.World;
  mats: Materials;
  biome: BiomeDef;
  rng: PRNG;
  qs: QualitySettings;
  sensors: SensorRegistry;
  updatables: Updatable[];
  shards: ShardInstance[];
  powerups: PowerupInstance[];
  checkpoints: CheckpointInstance[];
  /** Colliders that notify when the ball touches them (falling tiles). */
  contactWatch: Map<number, { onBallContact: () => void }>;
  pathPoints: THREE.Vector3[];
  minY: number;
  particles: ParticlePool | null;
  sfx: Sfx | null;
}
