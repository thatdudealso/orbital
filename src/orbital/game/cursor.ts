/**
 * Track cursor: walks the centerline of the track, advancing position
 * and heading as segments are laid. Track forward at heading 0 is -Z.
 */

import * as THREE from 'three';

export class Cursor {
  readonly pos = new THREE.Vector3();
  heading = 0;

  constructor(x = 0, y = 0, z = 0, heading = 0) {
    this.pos.set(x, y, z);
    this.heading = heading;
  }

  clone(): Cursor {
    const c = new Cursor();
    c.pos.copy(this.pos);
    c.heading = this.heading;
    return c;
  }

  /** Unit forward vector on the XZ plane. */
  dir(): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(this.heading), 0, -Math.cos(this.heading));
  }

  /** Unit right vector on the XZ plane. */
  right(): THREE.Vector3 {
    return new THREE.Vector3(Math.cos(this.heading), 0, Math.sin(this.heading));
  }

  /** Advance along current heading, optionally changing elevation. */
  advance(dist: number, dy = 0): this {
    this.pos.addScaledVector(this.dir(), dist);
    this.pos.y += dy;
    return this;
  }

  /** Move sideways relative to heading. */
  strafe(dist: number): this {
    this.pos.addScaledVector(this.right(), dist);
    return this;
  }

  yaw(angle: number): this {
    this.heading += angle;
    return this;
  }
}

/** Quaternion orienting a box whose local -Z points along `heading`,
 * pitched by `pitch` (positive = rising) and rolled by `bank`. */
export function trackQuat(heading: number, pitch = 0, bank = 0): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, -heading, bank, 'YXZ'));
}
