/**
 * Camera rig: smooth follow cam, scripted flythrough paths (intro
 * cutscene) and orbit shots (victory cutscene).
 */

import * as THREE from 'three';
import { RAPIER } from './physics';

const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

type Mode = 'follow' | 'path' | 'orbit';

export class CameraRig {
  private readonly camera: THREE.PerspectiveCamera;
  private mode: Mode = 'follow';

  // follow state
  private readonly smoothPos = new THREE.Vector3();
  private readonly smoothLook = new THREE.Vector3();
  private followYaw = 0;
  private initialized = false;

  // camera obstruction: physics raycast pull-in
  private world: RAPIER.World | null = null;
  private excludeCollider: RAPIER.Collider | null = null;
  private clearDist = 7.2;

  // path state
  private path: THREE.CatmullRomCurve3 | null = null;
  private pathT = 0;
  private pathDuration = 4;
  private pathLookAt: ((t: number) => THREE.Vector3) | null = null;
  private pathDone: (() => void) | null = null;

  // orbit state
  private orbitCenter = new THREE.Vector3();
  private orbitT = 0;
  private orbitRadius = 6;
  private orbitHeight = 3;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  /** Attach the physics world so the follow cam never hides inside geometry. */
  setWorld(world: RAPIER.World, excludeCollider: RAPIER.Collider): void {
    this.world = world;
    this.excludeCollider = excludeCollider;
  }

  getMode(): Mode {
    return this.mode;
  }

  /** Current camera-space yaw used to map input onto the world. */
  getYaw(): number {
    return this.followYaw;
  }

  snapBehind(target: THREE.Vector3, yaw: number): void {
    this.followYaw = yaw;
    const facing = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    this.smoothPos.copy(target).addScaledVector(facing, -7.5).add(new THREE.Vector3(0, 4.2, 0));
    this.smoothLook.copy(target);
    this.camera.position.copy(this.smoothPos);
    this.camera.lookAt(this.smoothLook);
    this.initialized = true;
    this.mode = 'follow';
  }

  // ---------------- follow ----------------

  follow(dt: number, ballPos: THREE.Vector3, ballVel: THREE.Vector3): void {
    this.mode = 'follow';
    // Face along travel direction when moving meaningfully.
    const planar = Math.hypot(ballVel.x, ballVel.z);
    if (planar > 1.2) {
      const targetYaw = Math.atan2(ballVel.x, ballVel.z);
      let d = targetYaw - this.followYaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.followYaw += d * Math.min(1, dt * 2.2);
    }
    const back = new THREE.Vector3(Math.sin(this.followYaw), 0, Math.cos(this.followYaw));
    const desired = new THREE.Vector3()
      .copy(ballPos)
      .addScaledVector(back, -7.2)
      .add(new THREE.Vector3(0, 4.0, 0));

    // Obstruction handling: ray from the ball toward the desired camera
    // spot; if track geometry or scenery blocks the line, pull the camera
    // in front of the obstruction. Snaps in fast, eases back out slowly.
    if (this.world) {
      const toCam = desired.clone().sub(ballPos);
      const dist = toCam.length();
      const dir = toCam.clone().normalize();
      const ray = new RAPIER.Ray(
        { x: ballPos.x, y: ballPos.y, z: ballPos.z },
        { x: dir.x, y: dir.y, z: dir.z },
      );
      const hit = this.world.castRay(ray, dist + 0.4, true, undefined, undefined, this.excludeCollider ?? undefined);
      let maxDist = dist;
      if (hit) {
        maxDist = Math.max(2.6, hit.timeOfImpact - 0.4);
      }
      const k = maxDist < this.clearDist ? 0.55 : 0.055;
      this.clearDist += (maxDist - this.clearDist) * k;
      desired.copy(ballPos).addScaledVector(dir, Math.min(this.clearDist, dist));
    }

    if (!this.initialized) {
      this.smoothPos.copy(desired);
      this.smoothLook.copy(ballPos);
      this.initialized = true;
    }
    const kp = 1 - Math.exp(-dt * 5.5);
    const kl = 1 - Math.exp(-dt * 8.5);
    this.smoothPos.lerp(desired, kp);
    this.smoothLook.lerp(new THREE.Vector3().copy(ballPos).addScaledVector(ballVel, 0.18), kl);
    this.camera.position.copy(this.smoothPos);
    this.camera.lookAt(this.smoothLook);
  }

  // ---------------- scripted path (intro flythrough) ----------------

  startPath(points: THREE.Vector3[], duration: number, lookAt: (t: number) => THREE.Vector3, onDone: () => void): void {
    this.mode = 'path';
    this.path = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
    this.pathT = 0;
    this.pathDuration = Math.max(0.1, duration);
    this.pathLookAt = lookAt;
    this.pathDone = onDone;
  }

  skipPath(): void {
    if (this.mode !== 'path' || !this.path) return;
    this.pathT = this.pathDuration; // finishes on next update
  }

  // ---------------- orbit (victory) ----------------

  startOrbit(center: THREE.Vector3, radius = 6.5, height = 3.2): void {
    this.mode = 'orbit';
    this.orbitCenter.copy(center);
    this.orbitT = 0;
    this.orbitRadius = radius;
    this.orbitHeight = height;
  }

  update(dt: number, ballPos: THREE.Vector3, ballVel: THREE.Vector3): void {
    if (this.mode === 'follow') {
      this.follow(dt, ballPos, ballVel);
      return;
    }
    if (this.mode === 'path' && this.path) {
      this.pathT += dt;
      const t = Math.min(1, this.pathT / this.pathDuration);
      const eased = easeInOutQuad(t);
      const pos = this.path.getPointAt(Math.min(1, eased * 0.999 + 0.0005));
      this.camera.position.copy(pos);
      const look = this.pathLookAt ? this.pathLookAt(eased) : ballPos;
      this.camera.lookAt(look);
      if (t >= 1) {
        const done = this.pathDone;
        this.path = null;
        this.pathDone = null;
        this.initialized = false;
        done?.();
      }
      return;
    }
    if (this.mode === 'orbit') {
      this.orbitT += dt;
      const a = easeOutCubic(Math.min(1, this.orbitT / 1.2)) * 0.6 + this.orbitT * 0.55;
      const r = this.orbitRadius + this.orbitT * 0.55;
      this.camera.position.set(
        this.orbitCenter.x + Math.sin(a) * r,
        this.orbitCenter.y + this.orbitHeight + this.orbitT * 0.35,
        this.orbitCenter.z + Math.cos(a) * r,
      );
      this.camera.lookAt(this.orbitCenter);
    }
  }
}
