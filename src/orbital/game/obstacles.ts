/**
 * Obstacle + interactable spawners: spinners, sweepers, pistons, movers,
 * falling tiles, lasers, bounce/boost pads, wind & drag volumes, geysers.
 * Motion uses kinematic bodies so the solver gives true contact velocities.
 */

import * as THREE from 'three';
import { RAPIER, GROUP, collisionGroups } from '../engine/physics';
import { trackQuat } from './cursor';
import type { BuildCtx, Updatable, ZoneEffect, PowerupType } from './types';

const staticGroups = collisionGroups(GROUP.STATIC, GROUP.BALL);
const sensorGroups = collisionGroups(GROUP.SENSOR, GROUP.BALL);

function box(
  ctx: BuildCtx,
  size: THREE.Vector3,
  pos: THREE.Vector3,
  quat: THREE.Quaternion,
  mat: THREE.Material,
  collide = true,
  friction?: number,
): { mesh: THREE.Mesh; collider: RAPIER.Collider | null } {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), mat);
  mesh.position.copy(pos);
  mesh.quaternion.copy(quat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  ctx.scene.add(mesh);
  let collider: RAPIER.Collider | null = null;
  if (collide) {
    collider = ctx.world.createCollider(
      RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
        .setTranslation(pos.x, pos.y, pos.z)
        .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
        .setFriction(friction ?? ctx.biome.physics.trackFriction)
        .setCollisionGroups(staticGroups),
    );
  }
  return { mesh, collider };
}

// ---------------------------------------------------------------- spinners

export interface SpinOpts {
  length?: number;
  speed?: number;
  bar?: number;
  armHeight?: number;
  clockwise?: boolean;
  hub?: boolean;
}

export function addSpinner(ctx: BuildCtx, center: THREE.Vector3, opts: SpinOpts = {}): void {
  const length = opts.length ?? 5;
  const speed = opts.speed ?? 1.6;
  const bar = opts.bar ?? 0.38;
  const armY = center.y + (opts.armHeight ?? 0.55);
  const dir = opts.clockwise === false ? 1 : -1;

  const body = ctx.world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(center.x, armY, center.z),
  );
  ctx.world.createCollider(
    RAPIER.ColliderDesc.cuboid(length / 2, bar / 2, bar / 2)
      .setFriction(0.35)
      .setCollisionGroups(staticGroups),
    body,
  );

  const group = new THREE.Group();
  const barMesh = new THREE.Mesh(new THREE.BoxGeometry(length, bar, bar), ctx.mats.hazard);
  barMesh.castShadow = true;
  group.add(barMesh);
  if (opts.hub !== false) {
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 1.4, 10), ctx.mats.trackSide);
    hub.position.y = -0.4;
    group.add(hub);
  }
  group.position.set(center.x, armY, center.z);
  ctx.scene.add(group);

  const phase = ctx.rng() * Math.PI * 2;
  ctx.updatables.push({
    update(_dt: number, t: number) {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), phase + t * speed * dir);
      body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
      group.quaternion.copy(q);
    },
  });
}

// ---------------------------------------------------------------- pistons

export function addPiston(
  ctx: BuildCtx,
  deckPos: THREE.Vector3,
  opts: { travel?: number; speed?: number; head?: number; phase?: number } = {},
): void {
  const travel = opts.travel ?? 3.4;
  const speed = opts.speed ?? 0.55; // cycles per second
  const head = opts.head ?? 1.7;
  const phase = opts.phase ?? ctx.rng();

  const body = ctx.world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(deckPos.x, deckPos.y + travel, deckPos.z),
  );
  ctx.world.createCollider(
    RAPIER.ColliderDesc.cuboid(head / 2, head / 2, head / 2)
      .setFriction(0.3)
      .setCollisionGroups(staticGroups),
    body,
  );

  const group = new THREE.Group();
  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(head, head, head), ctx.mats.hazard);
  headMesh.castShadow = true;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(head * 0.18, head * 0.18, travel, 8), ctx.mats.trackSide);
  rod.position.y = travel / 2 + head / 2;
  group.add(headMesh, rod);
  ctx.scene.add(group);

  ctx.updatables.push({
    update(_dt: number, t: number) {
      const cycle = (t * speed + phase) % 1;
      // fast smash, short hold, slow retract
      let k: number;
      if (cycle < 0.18) k = 1 - cycle / 0.18;
      else if (cycle < 0.34) k = 0;
      else k = (cycle - 0.34) / 0.66;
      const y = deckPos.y + head * 0.4 + travel * k;
      body.setNextKinematicTranslation({ x: deckPos.x, y, z: deckPos.z });
      group.position.set(deckPos.x, y, deckPos.z);
    },
  });
}

// ---------------------------------------------------------------- movers

export interface MoverOpts {
  size?: THREE.Vector3;
  axis?: 'x' | 'y' | 'z';
  distance?: number;
  speed?: number;
  phase?: number;
  heading?: number;
}

export function addMover(ctx: BuildCtx, center: THREE.Vector3, opts: MoverOpts = {}): void {
  const size = opts.size ?? new THREE.Vector3(3.2, 0.5, 3.2);
  const distance = opts.distance ?? 6;
  const speed = opts.speed ?? 0.8;
  const phase = opts.phase ?? ctx.rng() * Math.PI * 2;
  const localAxis = opts.axis ?? 'x';
  const heading = opts.heading ?? 0;

  const baseAxis = new THREE.Vector3(
    localAxis === 'x' ? 1 : 0,
    localAxis === 'y' ? 1 : 0,
    localAxis === 'z' ? 1 : 0,
  );
  // rotate axis by heading so 'x' means "perpendicular to travel"
  const axis = baseAxis.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -heading);

  const body = ctx.world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(center.x, center.y, center.z),
  );
  ctx.world.createCollider(
    RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
      .setFriction(ctx.biome.physics.trackFriction)
      .setCollisionGroups(staticGroups),
    body,
  );

  const group = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), ctx.mats.track);
  deck.castShadow = true;
  deck.receiveShadow = true;
  const glow = new THREE.Mesh(new THREE.BoxGeometry(size.x * 0.98, 0.07, size.z * 0.98), ctx.mats.edge);
  glow.position.y = size.y / 2 + 0.035;
  group.add(deck, glow);
  ctx.scene.add(group);

  ctx.updatables.push({
    update(_dt: number, t: number) {
      const k = Math.sin(t * speed + phase) * (distance / 2);
      const p = new THREE.Vector3().copy(center).addScaledVector(axis, k);
      body.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
      group.position.copy(p);
    },
  });
}

// ---------------------------------------------------------------- falling tiles

const TILE_GROUPS = staticGroups;

export class FallingTile implements Updatable {
  private state: 'idle' | 'shaking' | 'falling' | 'gone' = 'idle';
  private timer = 0;
  private collider: RAPIER.Collider;
  private body: RAPIER.RigidBody | null = null;
  private readonly mesh: THREE.Mesh;
  private readonly pos: THREE.Vector3;
  private readonly size: THREE.Vector3;

  constructor(
    private readonly ctx: BuildCtx,
    pos: THREE.Vector3,
    size: THREE.Vector3,
  ) {
    this.pos = pos.clone();
    this.size = size.clone();
    this.collider = ctx.world.createCollider(
      RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
        .setTranslation(pos.x, pos.y, pos.z)
        .setFriction(ctx.biome.physics.trackFriction)
        .setCollisionGroups(TILE_GROUPS)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    );
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), ctx.mats.track);
    this.mesh.position.copy(pos);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    const crack = new THREE.Mesh(
      new THREE.BoxGeometry(size.x * 0.9, 0.05, 0.12),
      ctx.mats.hazard,
    );
    crack.position.y = size.y / 2 + 0.03;
    this.mesh.add(crack);
    ctx.scene.add(this.mesh);

    ctx.contactWatch.set(this.collider.handle, {
      onBallContact: () => {
        if (this.state === 'idle') {
          this.state = 'shaking';
          this.timer = 0;
        }
      },
    });
  }

  update(dt: number): void {
    if (this.state === 'shaking') {
      this.timer += dt;
      this.mesh.position.set(
        this.pos.x + (Math.random() - 0.5) * 0.07,
        this.pos.y,
        this.pos.z + (Math.random() - 0.5) * 0.07,
      );
      if (this.timer > 0.45) {
        this.state = 'falling';
        this.timer = 0;
        this.ctx.world.removeCollider(this.collider, false);
        this.body = this.ctx.world.createRigidBody(
          RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(this.pos.x, this.pos.y, this.pos.z)
            .setLinearDamping(0.1),
        );
        this.ctx.world.createCollider(
          RAPIER.ColliderDesc.cuboid(this.size.x / 2, this.size.y / 2, this.size.z / 2)
            .setCollisionGroups(TILE_GROUPS)
            .setDensity(2),
          this.body,
        );
      }
    } else if (this.state === 'falling' && this.body) {
      this.timer += dt;
      const t = this.body.translation();
      const r = this.body.rotation();
      this.mesh.position.set(t.x, t.y, t.z);
      this.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      if (this.timer > 2.4) {
        this.state = 'gone';
        this.timer = 0;
        this.ctx.world.removeRigidBody(this.body);
        this.body = null;
        this.mesh.visible = false;
      }
    } else if (this.state === 'gone') {
      this.timer += dt;
      if (this.timer > 2.2) {
        this.state = 'idle';
        this.collider = this.ctx.world.createCollider(
          RAPIER.ColliderDesc.cuboid(this.size.x / 2, this.size.y / 2, this.size.z / 2)
            .setTranslation(this.pos.x, this.pos.y, this.pos.z)
            .setFriction(this.ctx.biome.physics.trackFriction)
            .setCollisionGroups(TILE_GROUPS)
            .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
        );
        this.ctx.contactWatch.set(this.collider.handle, {
          onBallContact: () => {
            if (this.state === 'idle') {
              this.state = 'shaking';
              this.timer = 0;
            }
          },
        });
        this.mesh.visible = true;
        this.mesh.position.copy(this.pos);
        this.mesh.quaternion.identity();
      }
    }
  }
}

export function addFallingTile(ctx: BuildCtx, pos: THREE.Vector3, size: THREE.Vector3): void {
  const tile = new FallingTile(ctx, pos, size);
  ctx.updatables.push(tile);
}

// ---------------------------------------------------------------- lasers

export function addLaser(
  ctx: BuildCtx,
  center: THREE.Vector3,
  width: number,
  heading: number,
  opts: { period?: number; duty?: number; phase?: number } = {},
): void {
  const period = opts.period ?? 2.2;
  const duty = opts.duty ?? 0.45;
  const phase = opts.phase ?? ctx.rng() * period;
  const quat = trackQuat(heading);

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.16, 0.16), ctx.mats.hazard);
  mesh.position.copy(center);
  mesh.quaternion.copy(quat);
  ctx.scene.add(mesh);
  const emitterL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.3), ctx.mats.trackSide);
  emitterL.position.copy(center).add(new THREE.Vector3(Math.cos(heading), 0, Math.sin(heading)).multiplyScalar(width / 2));
  const emitterR = emitterL.clone();
  emitterR.position.copy(center).add(new THREE.Vector3(Math.cos(heading), 0, Math.sin(heading)).multiplyScalar(-width / 2));
  ctx.scene.add(emitterL, emitterR);

  const sensor = ctx.world.createCollider(
    RAPIER.ColliderDesc.cuboid(width / 2, 0.5, 0.5)
      .setTranslation(center.x, center.y, center.z)
      .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
      .setSensor(true)
      .setCollisionGroups(sensorGroups)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
  );
  ctx.sensors.register(sensor, { type: 'hazard', kind: 'laser' });

  ctx.updatables.push({
    update(_dt: number, t: number) {
      const cyc = (t + phase) % period;
      const on = cyc < duty * period;
      const warn = !on && cyc > period - 0.35;
      mesh.visible = on || warn;
      (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 2.6 : 0.8;
      sensor.setEnabled(on);
    },
  });
}

// ---------------------------------------------------------------- pads

export function addBouncePad(ctx: BuildCtx, pos: THREE.Vector3, power = 10, forward?: THREE.Vector3): void {
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 0.22, 20), ctx.mats.accent);
  pad.position.copy(pos).add(new THREE.Vector3(0, 0.11, 0));
  ctx.scene.add(pad);
  const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 8, 24), ctx.mats.edge);
  ringMesh.rotation.x = Math.PI / 2;
  ringMesh.position.copy(pos).add(new THREE.Vector3(0, 0.26, 0));
  ctx.scene.add(ringMesh);

  const sensor = ctx.world.createCollider(
    RAPIER.ColliderDesc.cylinder(0.4, 0.95)
      .setTranslation(pos.x, pos.y + 0.4, pos.z)
      .setSensor(true)
      .setCollisionGroups(sensorGroups)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
  );
  ctx.sensors.register(sensor, { type: 'bounce', power, forward });

  ctx.updatables.push({
    update(_dt: number, t: number) {
      const s = 1 + Math.sin(t * 3.2) * 0.06;
      ringMesh.scale.setScalar(s);
    },
  });
}

export function addBoostPad(ctx: BuildCtx, pos: THREE.Vector3, dir: THREE.Vector3, heading: number, power = 14): void {
  const quat = trackQuat(heading);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 3), ctx.mats.accent);
  plate.position.copy(pos).add(new THREE.Vector3(0, 0.05, 0));
  plate.quaternion.copy(quat);
  ctx.scene.add(plate);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 4), ctx.mats.edge);
  arrow.rotation.x = -Math.PI / 2;
  arrow.position.copy(pos).add(new THREE.Vector3(0, 0.16, 0));
  arrow.quaternion.premultiply(quat);
  ctx.scene.add(arrow);

  const sensor = ctx.world.createCollider(
    RAPIER.ColliderDesc.cuboid(1.2, 0.6, 1.6)
      .setTranslation(pos.x, pos.y + 0.5, pos.z)
      .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
      .setSensor(true)
      .setCollisionGroups(sensorGroups)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
  );
  ctx.sensors.register(sensor, { type: 'boostpad', dir: dir.clone(), power });
}

// ---------------------------------------------------------------- volumes (wind / drag / gravity)

export function addZoneVolume(
  ctx: BuildCtx,
  center: THREE.Vector3,
  size: THREE.Vector3,
  heading: number,
  zone: ZoneEffect,
  visual: 'wind' | 'drag' | 'gravity',
): void {
  const quat = trackQuat(heading);
  const sensor = ctx.world.createCollider(
    RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
      .setTranslation(center.x, center.y, center.z)
      .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
      .setSensor(true)
      .setCollisionGroups(sensorGroups)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
  );
  ctx.sensors.register(sensor, { type: 'zone', zone });

  const color =
    visual === 'wind' ? ctx.mats.accent : visual === 'drag' ? ctx.mats.checkpoint : ctx.mats.power.slow;
  const mat = (color as THREE.MeshStandardMaterial).clone();
  mat.transparent = true;
  mat.opacity = visual === 'drag' ? 0.35 : 0.08;
  mat.emissiveIntensity = visual === 'drag' ? 0.5 : 0.7;
  const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, visual === 'drag' ? 0.1 : size.y, size.z), mat);
  boxMesh.position.copy(center);
  if (visual === 'drag') boxMesh.position.y = center.y - size.y / 2 + 0.06;
  boxMesh.quaternion.copy(quat);
  ctx.scene.add(boxMesh);
}

// ---------------------------------------------------------------- hazard plane (lava strips)

export function addHazardStrip(ctx: BuildCtx, center: THREE.Vector3, size: THREE.Vector3, heading: number): void {
  const quat = trackQuat(heading);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, 0.12, size.z), ctx.mats.hazard);
  mesh.position.copy(center);
  mesh.quaternion.copy(quat);
  ctx.scene.add(mesh);

  const sensor = ctx.world.createCollider(
    RAPIER.ColliderDesc.cuboid(size.x / 2, 0.5, size.z / 2)
      .setTranslation(center.x, center.y + 0.2, center.z)
      .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
      .setSensor(true)
      .setCollisionGroups(sensorGroups)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
  );
  ctx.sensors.register(sensor, { type: 'hazard', kind: 'lava' });

  const baseY = center.y;
  ctx.updatables.push({
    update(_dt: number, t: number) {
      mesh.position.y = baseY + Math.sin(t * 2.1) * 0.05;
      (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.2 + Math.sin(t * 3.7) * 0.5;
    },
  });
}

// ---------------------------------------------------------------- pickups

export function addShard(ctx: BuildCtx, pos: THREE.Vector3): void {
  const id = ctx.shards.length;
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), ctx.mats.shard);
  mesh.position.copy(pos);
  ctx.scene.add(mesh);
  const sensor = ctx.world.createCollider(
    RAPIER.ColliderDesc.ball(0.55)
      .setTranslation(pos.x, pos.y, pos.z)
      .setSensor(true)
      .setCollisionGroups(sensorGroups)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
  );
  ctx.sensors.register(sensor, { type: 'shard', id });
  ctx.shards.push({ id, mesh, pos: pos.clone(), collected: false });
  ctx.updatables.push({
    update(_dt: number, t: number) {
      if (mesh.visible) {
        mesh.rotation.y = t * 2.4 + id;
        mesh.position.y = pos.y + Math.sin(t * 2 + id * 0.7) * 0.12;
      }
    },
  });
}

export function addPowerup(ctx: BuildCtx, pos: THREE.Vector3, power: PowerupType): void {
  const id = ctx.powerups.length;
  const group = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), ctx.mats.power[power]);
  const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 8, 28), ctx.mats.power[power]);
  group.add(core, ringMesh);
  group.position.copy(pos);
  ctx.scene.add(group);

  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.3, 12), ctx.mats.trackSide);
  pedestal.position.copy(pos).add(new THREE.Vector3(0, -1.05, 0));
  ctx.scene.add(pedestal);

  const sensor = ctx.world.createCollider(
    RAPIER.ColliderDesc.ball(0.95)
      .setTranslation(pos.x, pos.y, pos.z)
      .setSensor(true)
      .setCollisionGroups(sensorGroups)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
  );
  ctx.sensors.register(sensor, { type: 'powerup', id, power });
  ctx.powerups.push({ id, power, mesh: group, pos: pos.clone(), taken: false, respawnAt: 0 });

  ctx.updatables.push({
    update(_dt: number, t: number) {
      group.rotation.y = t * 1.8 + id;
      ringMesh.rotation.x = t * 1.2;
      group.position.y = pos.y + Math.sin(t * 1.6 + id) * 0.15;
    },
  });
}

// ---------------------------------------------------------------- checkpoint gate

export function addCheckpointGate(ctx: BuildCtx, surface: THREE.Vector3, width: number, heading: number): void {
  const index = ctx.checkpoints.length;
  const quat = trackQuat(heading);
  const right = new THREE.Vector3(Math.cos(heading), 0, Math.sin(heading));

  const group = new THREE.Group();
  const postGeo = new THREE.BoxGeometry(0.28, 3, 0.28);
  const postL = new THREE.Mesh(postGeo, ctx.mats.checkpoint);
  const postR = new THREE.Mesh(postGeo, ctx.mats.checkpoint);
  postL.position.copy(right).multiplyScalar(width / 2).add(new THREE.Vector3(0, 1.5, 0));
  postR.position.copy(right).multiplyScalar(-width / 2).add(new THREE.Vector3(0, 1.5, 0));
  const beam = new THREE.Mesh(new THREE.BoxGeometry(width, 0.28, 0.28), ctx.mats.checkpoint);
  beam.position.y = 3;
  group.add(postL, postR, beam);
  group.position.copy(surface);
  group.quaternion.copy(quat);
  ctx.scene.add(group);

  const sensor = ctx.world.createCollider(
    RAPIER.ColliderDesc.cuboid(width / 2, 1.8, 0.6)
      .setTranslation(surface.x, surface.y + 1.5, surface.z)
      .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
      .setSensor(true)
      .setCollisionGroups(sensorGroups)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
  );
  const respawn = surface.clone().add(new THREE.Vector3(0, 1.2, 0));
  ctx.sensors.register(sensor, { type: 'checkpoint', index, pos: respawn });
  ctx.checkpoints.push({ index, pos: respawn, ring: group, activated: false });
}

export function markCheckpointActivated(ctx: BuildCtx, index: number): void {
  const cp = ctx.checkpoints.find((c) => c.index === index);
  if (!cp || cp.activated) return;
  cp.activated = true;
  cp.ring.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) mesh.material = ctx.mats.checkpointOn;
  });
}

// ---------------------------------------------------------------- goal gate

export function addGoalGate(ctx: BuildCtx, surface: THREE.Vector3, heading: number): THREE.Vector3 {
  const quat = trackQuat(heading);
  const group = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.16, 12, 48), ctx.mats.accent);
  ring.position.y = 2.6;
  const inner = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 40),
    new THREE.MeshStandardMaterial({
      color: '#000',
      emissive: new THREE.Color(ctx.mats.accent.emissive),
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    }),
  );
  inner.position.y = 2.6;
  const base = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 3), ctx.mats.trackSide);
  base.position.y = 0.2;
  group.add(ring, inner, base);
  group.position.copy(surface);
  group.quaternion.copy(quat);
  ctx.scene.add(group);

  const sensor = ctx.world.createCollider(
    RAPIER.ColliderDesc.cuboid(2.2, 2.2, 0.5)
      .setTranslation(surface.x, surface.y + 2.6, surface.z)
      .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
      .setSensor(true)
      .setCollisionGroups(sensorGroups)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
  );
  ctx.sensors.register(sensor, { type: 'goal' });

  ctx.updatables.push({
    update(_dt: number, t: number) {
      ring.rotation.z = t * 0.9;
      (ring.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.7 + Math.sin(t * 2.4) * 0.5;
    },
  });
  return surface.clone();
}
