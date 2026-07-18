/**
 * Player ball: Rapier rigid body + neon mesh + point light.
 * Camera-relative force movement with speed clamp, coyote-time jumps,
 * and timed power-up state.
 */

import * as THREE from 'three';
import { RAPIER, GROUP, collisionGroups } from '../engine/physics';
import type { MoveVector } from '../engine/input';
import type { PowerupType } from './types';

export interface BallTuning {
  gravity: number;
  accel: number;
  maxSpeed: number;
  jumpHeight: number;
  friction: number;
  restitution: number;
  linearDamping: number;
  angularDamping: number;
}

export const POWER_DURATIONS: Record<PowerupType, number> = {
  boost: 5,
  shield: 999, // until consumed
  magnet: 10,
  slow: 6,
  anchor: 8,
};

export class Ball {
  readonly radius = 0.5;
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  readonly mesh: THREE.Group;
  private readonly shell: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private readonly light: THREE.PointLight;

  grounded = false;
  private coyote = 0;
  private jumpBuffer = 0;
  private baseDamping: number;
  extraDamping = 0;
  invulnerableUntil = 0;

  // power-up state (sim-time timestamps)
  boostUntil = -1;
  shield = false;
  magnetUntil = -1;
  slowUntil = -1;
  anchorUntil = -1;

  constructor(world: RAPIER.World, pos: THREE.Vector3, tune: BallTuning, color: string) {
    this.baseDamping = tune.linearDamping;
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .setLinearDamping(tune.linearDamping)
      .setAngularDamping(tune.angularDamping)
      .setCcdEnabled(true)
      .setCanSleep(false);
    this.body = world.createRigidBody(desc);
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.ball(this.radius)
        .setFriction(tune.friction)
        .setRestitution(tune.restitution)
        .setCollisionGroups(collisionGroups(GROUP.BALL, GROUP.STATIC | GROUP.BALL | GROUP.SENSOR))
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      this.body,
    );

    // visuals
    this.mesh = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(this.radius, 32, 24),
      new THREE.MeshStandardMaterial({ color: '#ccd5cf', roughness: 0.5, metalness: 0.18 }),
    );
    core.castShadow = true;
    this.shell = new THREE.Mesh(
      new THREE.SphereGeometry(this.radius * 1.03, 24, 18),
      new THREE.MeshStandardMaterial({
        color: '#000000',
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.85,
        transparent: true,
        opacity: 0.35,
        roughness: 0.4,
      }),
    );
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(this.radius * 1.35, 0.045, 10, 40),
      new THREE.MeshStandardMaterial({ color: '#000', emissive: new THREE.Color('#fbbf24'), emissiveIntensity: 2.4 }),
    );
    this.ring.rotation.x = Math.PI / 2;
    this.ring.visible = false; // shield indicator
    this.light = new THREE.PointLight(new THREE.Color(color), 14, 12, 1.8);
    this.mesh.add(core, this.shell, this.ring, this.light);
    this.mesh.position.copy(pos);
  }

  apply(p: PowerupType, now: number): void {
    const dur = POWER_DURATIONS[p];
    if (p === 'boost') this.boostUntil = now + dur;
    else if (p === 'shield') { this.shield = true; this.ring.visible = true; }
    else if (p === 'magnet') this.magnetUntil = now + dur;
    else if (p === 'slow') this.slowUntil = now + dur;
    else if (p === 'anchor') this.anchorUntil = now + dur;
  }

  consumeShield(): boolean {
    if (!this.shield) return false;
    this.shield = false;
    this.ring.visible = false;
    return true;
  }

  isBoosting(now: number): boolean { return now < this.boostUntil; }
  isMagnetOn(now: number): boolean { return now < this.magnetUntil; }
  isSlowOn(now: number): boolean { return now < this.slowUntil; }
  isAnchorOn(now: number): boolean { return now < this.anchorUntil; }

  activePowers(now: number): PowerupType[] {
    const out: PowerupType[] = [];
    if (this.isBoosting(now)) out.push('boost');
    if (this.shield) out.push('shield');
    if (this.isMagnetOn(now)) out.push('magnet');
    if (this.isSlowOn(now)) out.push('slow');
    if (this.isAnchorOn(now)) out.push('anchor');
    return out;
  }

  update(
    dt: number,
    now: number,
    world: RAPIER.World,
    input: MoveVector,
    camYaw: number,
    tune: BallTuning,
  ): void {
    // grounded check: short ray down, static geometry only, skip sensors
    const t = this.body.translation();
    const ray = new RAPIER.Ray({ x: t.x, y: t.y, z: t.z }, { x: 0, y: -1, z: 0 });
    const hit = world.castRay(ray, this.radius + 0.14, true, undefined, undefined, this.collider);
    this.grounded = !!hit;
    if (this.grounded) this.coyote = 0.13;
    else this.coyote = Math.max(0, this.coyote - dt);

    // camera-relative move direction
    const fx = Math.sin(camYaw);
    const fz = Math.cos(camYaw);
    const rx = -Math.cos(camYaw);
    const rz = Math.sin(camYaw);
    let mx = rx * input.x + fx * input.z;
    let mz = rz * input.x + fz * input.z;
    const mLen = Math.hypot(mx, mz);
    if (mLen > 1e-4) {
      mx /= Math.max(1, mLen);
      mz /= Math.max(1, mLen);
    }

    const boosting = this.isBoosting(now);
    const accel = tune.accel * (boosting ? 1.85 : 1) * (this.grounded ? 1 : 0.55);
    const mass = this.body.mass();
    this.body.applyImpulse({ x: mx * accel * mass * dt, y: 0, z: mz * accel * mass * dt }, true);

    // anchor power: extra downforce for low-g control
    if (this.isAnchorOn(now)) {
      this.body.applyImpulse({ x: 0, y: -tune.gravity * 0.85 * mass * dt, z: 0 }, true);
    }

    // speed clamp (planar)
    const maxSpeed = tune.maxSpeed * (boosting ? 1.6 : 1);
    const v = this.body.linvel();
    const planar = Math.hypot(v.x, v.z);
    if (planar > maxSpeed) {
      const k = maxSpeed / planar;
      this.body.setLinvel({ x: v.x * k, y: v.y, z: v.z * k }, true);
    }

    // damping (drag zones add extra)
    const damp = this.baseDamping + this.extraDamping;
    this.body.setLinearDamping(damp);

    // jump: buffered + coyote
    if (input.jumpPressed) this.jumpBuffer = 0.13;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.jumpBuffer = 0;
      this.coyote = 0;
      const jumpV = Math.sqrt(2 * tune.gravity * tune.jumpHeight);
      this.body.setLinvel({ x: v.x, y: jumpV, z: v.z }, true);
    }
  }

  syncMesh(): void {
    const t = this.body.translation();
    const r = this.body.rotation();
    this.mesh.position.set(t.x, t.y, t.z);
    this.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    this.ring.rotation.z += 0.03;
  }

  respawn(pos: THREE.Vector3): void {
    this.body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.extraDamping = 0;
  }

  get position(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  get velocity(): THREE.Vector3 {
    const v = this.body.linvel();
    return new THREE.Vector3(v.x, v.y, v.z);
  }
}
