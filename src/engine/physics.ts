/**
 * Rapier WASM physics world wrapper.
 * Fixed 60Hz stepping with a clamped accumulator so gameplay feels
 * identical at 30fps mobile dips and 120Hz desktop refresh.
 */

import RAPIER from '@dimforge/rapier3d-compat';

export { RAPIER };

/** Collision membership groups. */
export const GROUP = {
  STATIC: 0x0001,
  BALL: 0x0002,
  SENSOR: 0x0004,
} as const;

/** Rapier packs (membership << 16) | filter. */
export function collisionGroups(membership: number, filter: number): number {
  return (membership << 16) | filter;
}

const FIXED = 1 / 60;

export class Physics {
  readonly world: RAPIER.World;
  readonly eventQueue: RAPIER.EventQueue;
  private accumulator = 0;

  private constructor(world: RAPIER.World) {
    this.world = world;
    this.eventQueue = new RAPIER.EventQueue(true);
  }

  static async create(gravity: number): Promise<Physics> {
    await RAPIER.init();
    const world = new RAPIER.World({ x: 0, y: -gravity, z: 0 });
    return new Physics(world);
  }

  setGravity(g: number): void {
    this.world.gravity = { x: 0, y: -g, z: 0 };
  }

  /** Advance the simulation by render-delta `dt` (already time-scaled). */
  step(dt: number): void {
    this.accumulator = Math.min(this.accumulator + dt, FIXED * 4);
    while (this.accumulator >= FIXED) {
      this.world.timestep = FIXED;
      this.world.step(this.eventQueue);
      this.accumulator -= FIXED;
    }
  }

  free(): void {
    this.eventQueue.free();
    this.world.free();
  }
}
