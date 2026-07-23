/**
 * Track segment library: the vocabulary every level is composed from.
 * Each builder lays geometry + colliders at the cursor and advances it.
 */

import * as THREE from 'three';
import { RAPIER, GROUP, collisionGroups } from '../engine/physics';
import { Cursor, trackQuat } from './cursor';
import type { BuildCtx, PowerupType } from './types';
import {
  addSpinner,
  addPiston,
  addMover,
  addFallingTile,
  addLaser,
  addBouncePad,
  addBoostPad,
  addZoneVolume,
  addHazardStrip,
  addShard,
  addPowerup,
  addCheckpointGate,
  addGoalGate,
  addConveyor,
  addGate,
  addSeesaw,
  addRingGate,
  addCrusher,
  addPortalPair,
} from './obstacles';

const staticGroups = collisionGroups(GROUP.STATIC, GROUP.BALL);

// ------------------------------------------------------------------ spec

export type SegmentSpec =
  | { kind: 'platform'; length: number; width?: number; dy?: number; rails?: boolean }
  | { kind: 'gap'; length: number }
  | { kind: 'narrow'; length: number; width: number }
  | { kind: 'ramp'; length: number; rise: number; width?: number }
  | { kind: 'curve'; angle: number; radius: number; dir: 1 | -1; width?: number; bank?: number }
  | { kind: 'halfpipe'; length: number; width?: number }
  | { kind: 'checkpoint' }
  | { kind: 'spinners'; length: number; count: number; speed?: number }
  | { kind: 'sweepers'; length: number; count: number; speed?: number }
  | { kind: 'pistons'; length: number; count: number; speed?: number }
  | { kind: 'movers'; count: number; spacing?: number; axis?: 'x' | 'y'; distance?: number; speed?: number }
  | { kind: 'falling'; length: number; tile?: number }
  | { kind: 'lasers'; length: number; count: number; period?: number }
  | { kind: 'wind'; length: number; dirX: 1 | -1; strength?: number }
  | { kind: 'dragZone'; length: number; strength?: number }
  | { kind: 'slickZone'; length: number; width?: number }
  | { kind: 'gravityZone'; length: number; gravity: number }
  | { kind: 'hazards'; length: number; count: number }
  | { kind: 'bounces'; count: number; spacing?: number; power?: number }
  | { kind: 'boosts'; count: number; spacing?: number }
  | { kind: 'shards'; pattern: 'line' | 'arc' | 'ring'; over?: number }
  | { kind: 'powerup'; power: PowerupType }
  | { kind: 'conveyor'; length: number; strength?: number }
  | { kind: 'gates'; length: number; count: number; period?: number }
  | { kind: 'seesaws'; count: number; spacing?: number; amp?: number; speed?: number }
  | { kind: 'rings'; length: number; count: number; speed?: number }
  | { kind: 'crushers'; length: number; count: number; period?: number }
  | { kind: 'portal'; gap: number }
  | { kind: 'goal' };

// ------------------------------------------------------------------ deck helper

export interface DeckOpts {
  width?: number;
  dy?: number;
  bank?: number;
  rails?: boolean;
  slick?: boolean;
  edge?: boolean;
  advance?: boolean;
}

export function addDeck(ctx: BuildCtx, cursor: Cursor, length: number, opts: DeckOpts = {}): void {
  const width = opts.width ?? 6;
  const dy = opts.dy ?? 0;
  const bank = opts.bank ?? 0;
  const thickness = 0.5;
  const pitch = Math.atan2(dy, length);
  const quat = trackQuat(cursor.heading, pitch, bank);
  const dir = cursor.dir();

  const center = cursor.pos.clone().addScaledVector(dir, length / 2);
  center.y += dy / 2 - thickness / 2;

  const mat = opts.slick ? ctx.mats.slick : ctx.mats.track;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, thickness, length), mat);
  mesh.position.copy(center);
  mesh.quaternion.copy(quat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  ctx.scene.add(mesh);

  const collider = ctx.world.createCollider(
    RAPIER.ColliderDesc.cuboid(width / 2, thickness / 2, length / 2)
      .setTranslation(center.x, center.y, center.z)
      .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
      .setFriction(opts.slick ? 0.04 : ctx.biome.physics.trackFriction)
      .setCollisionGroups(staticGroups),
  );
  void collider;

  // glow edge strips
  if (opts.edge !== false) {
    const right = cursor.right();
    for (const side of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, length), ctx.mats.edge);
      strip.position.copy(center).addScaledVector(right, (side * width) / 2);
      strip.position.y += thickness / 2 + 0.02;
      strip.quaternion.copy(quat);
      ctx.scene.add(strip);
    }
  }

  // low rails
  if (opts.rails) {
    const right = cursor.right();
    for (const side of [-1, 1]) {
      const railPos = center.clone().addScaledVector(right, (side * (width + 0.3)) / 2);
      railPos.y += thickness / 2 + 0.35;
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, length), ctx.mats.trackSide);
      rail.position.copy(railPos);
      rail.quaternion.copy(quat);
      ctx.scene.add(rail);
      ctx.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.12, 0.35, length / 2)
          .setTranslation(railPos.x, railPos.y, railPos.z)
          .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
          .setFriction(0.2)
          .setCollisionGroups(staticGroups),
      );
    }
  }

  // path breadcrumbs for cutscenes + decorations
  ctx.pathPoints.push(cursor.pos.clone());
  const mid = cursor.pos.clone().addScaledVector(dir, length / 2);
  mid.y += dy / 2;
  ctx.pathPoints.push(mid);
  ctx.minY = Math.min(ctx.minY, center.y - 4);

  if (opts.advance !== false) cursor.advance(length, dy);
}

// ------------------------------------------------------------------ builders

function buildCurve(ctx: BuildCtx, cursor: Cursor, spec: Extract<SegmentSpec, { kind: 'curve' }>): void {
  const total = (Math.abs(spec.angle) * Math.PI) / 180;
  const steps = Math.max(3, Math.ceil(total / 0.14));
  const dA = (total / steps) * spec.dir;
  const chord = 2 * spec.radius * Math.sin(total / steps / 2) * 1.08;
  const peakBank = spec.bank ?? 0.22;
  for (let i = 0; i < steps; i++) {
    const k = Math.sin((Math.PI * (i + 0.5)) / steps);
    addDeck(ctx, cursor, chord, { width: spec.width, bank: peakBank * k * spec.dir, advance: false });
    cursor.advance(chord);
    cursor.yaw(dA);
  }
  ctx.pathPoints.push(cursor.pos.clone());
}

function buildHalfpipe(ctx: BuildCtx, cursor: Cursor, spec: Extract<SegmentSpec, { kind: 'halfpipe' }>): void {
  const width = spec.width ?? 7;
  const length = spec.length;
  const quat = trackQuat(cursor.heading);
  const dir = cursor.dir();
  const right = cursor.right();
  const center = cursor.pos.clone().addScaledVector(dir, length / 2);

  // channel floor
  const floor = new THREE.Mesh(new THREE.BoxGeometry(width * 0.55, 0.4, length), ctx.mats.track);
  floor.position.copy(center).add(new THREE.Vector3(0, -0.2, 0));
  floor.quaternion.copy(quat);
  floor.receiveShadow = true;
  ctx.scene.add(floor);
  ctx.world.createCollider(
    RAPIER.ColliderDesc.cuboid((width * 0.55) / 2, 0.2, length / 2)
      .setTranslation(floor.position.x, floor.position.y, floor.position.z)
      .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
      .setFriction(ctx.biome.physics.trackFriction)
      .setCollisionGroups(staticGroups),
  );

  // angled walls
  for (const side of [-1, 1]) {
    const wallQuat = trackQuat(cursor.heading, 0, side * 0.72);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width * 0.4, 0.4, length), ctx.mats.trackSide);
    wall.position
      .copy(center)
      .addScaledVector(right, (side * width) / 2.55)
      .add(new THREE.Vector3(0, width * 0.145, 0));
    wall.quaternion.copy(wallQuat);
    ctx.scene.add(wall);
    ctx.world.createCollider(
      RAPIER.ColliderDesc.cuboid(width * 0.2, 0.2, length / 2)
        .setTranslation(wall.position.x, wall.position.y, wall.position.z)
        .setRotation({ x: wallQuat.x, y: wallQuat.y, z: wallQuat.z, w: wallQuat.w })
        .setFriction(ctx.biome.physics.trackFriction)
        .setCollisionGroups(staticGroups),
    );
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, length), ctx.mats.edge);
    strip.position
      .copy(center)
      .addScaledVector(right, (side * width) / 2.05)
      .add(new THREE.Vector3(0, width * 0.29, 0));
    ctx.scene.add(strip);
  }
  ctx.pathPoints.push(cursor.pos.clone(), center.clone());
  ctx.minY = Math.min(ctx.minY, center.y - 4);
  cursor.advance(length);
}

function buildShards(ctx: BuildCtx, cursor: Cursor, spec: Extract<SegmentSpec, { kind: 'shards' }>): void {
  const over = spec.over ?? 8;
  if (spec.pattern === 'line') {
    for (let i = 0; i < 5; i++) {
      const p = cursor.pos.clone().addScaledVector(cursor.dir(), 1.5 + i * ((over - 3) / 4));
      p.y += 1.1;
      addShard(ctx, p);
    }
  } else if (spec.pattern === 'arc') {
    // jump arc over a gap: peak in the middle
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const p = cursor.pos.clone().addScaledVector(cursor.dir(), t * over);
      p.y += 0.9 + Math.sin(t * Math.PI) * 1.8;
      addShard(ctx, p);
    }
  } else {
    // ring
    const c = cursor.pos.clone().addScaledVector(cursor.dir(), over / 2);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const p = c.clone();
      p.x += Math.cos(a) * 1.5;
      p.y += 1.2 + Math.sin(a) * 1.5;
      addShard(ctx, p);
    }
  }
}

const noopAdvance = (ctx: BuildCtx, cursor: Cursor, length: number) => {
  ctx.pathPoints.push(cursor.pos.clone());
  cursor.advance(length);
};

export function buildSegment(ctx: BuildCtx, cursor: Cursor, spec: SegmentSpec): void {
  switch (spec.kind) {
    case 'platform':
      addDeck(ctx, cursor, spec.length, { width: spec.width, dy: spec.dy ?? 0, rails: spec.rails });
      break;
    case 'gap':
      noopAdvance(ctx, cursor, spec.length);
      break;
    case 'narrow':
      addDeck(ctx, cursor, spec.length, { width: spec.width });
      break;
    case 'ramp':
      addDeck(ctx, cursor, spec.length, { width: spec.width, dy: spec.rise });
      break;
    case 'curve':
      buildCurve(ctx, cursor, spec);
      break;
    case 'halfpipe':
      buildHalfpipe(ctx, cursor, spec);
      break;
    case 'checkpoint': {
      addDeck(ctx, cursor, 2.5, { advance: true });
      const surface = cursor.pos.clone();
      surface.y += 0;
      addCheckpointGate(ctx, surface, 6, cursor.heading);
      break;
    }
    case 'spinners': {
      const start = cursor.pos.clone();
      addDeck(ctx, cursor, spec.length, { width: 7 });
      const n = spec.count;
      for (let i = 0; i < n; i++) {
        const p = start.clone().addScaledVector(cursor.dir(), ((i + 1) * spec.length) / (n + 1));
        addSpinner(ctx, p, {
          length: 6.2,
          speed: (spec.speed ?? 1.5) * (i % 2 === 0 ? 1 : -1) * -1,
          clockwise: i % 2 === 0,
        });
      }
      break;
    }
    case 'sweepers': {
      const start = cursor.pos.clone();
      addDeck(ctx, cursor, spec.length, { width: 8 });
      const n = spec.count;
      for (let i = 0; i < n; i++) {
        const p = start.clone().addScaledVector(cursor.dir(), ((i + 1) * spec.length) / (n + 1));
        addSpinner(ctx, p, {
          length: 8.4,
          speed: spec.speed ?? 1.2,
          bar: 0.3,
          armHeight: 0.32,
          clockwise: i % 2 === 1,
        });
      }
      break;
    }
    case 'pistons': {
      const start = cursor.pos.clone();
      addDeck(ctx, cursor, spec.length, { width: 6 });
      const n = spec.count;
      for (let i = 0; i < n; i++) {
        const p = start.clone().addScaledVector(cursor.dir(), ((i + 1) * spec.length) / (n + 1));
        addPiston(ctx, p, { speed: spec.speed ?? 0.55, phase: i / n });
      }
      break;
    }
    case 'movers': {
      const spacing = spec.spacing ?? 5.5;
      for (let i = 0; i < spec.count; i++) {
        const p = cursor.pos.clone().addScaledVector(cursor.dir(), spacing * (i + 1));
        p.y += i % 2 === 0 ? 0 : 0.4;
        addMover(ctx, p, {
          axis: spec.axis ?? 'x',
          distance: spec.distance ?? 5,
          speed: spec.speed ?? 0.9,
          heading: cursor.heading,
          phase: i * 1.3,
          size: new THREE.Vector3(3, 0.5, 3),
        });
        ctx.pathPoints.push(p.clone());
      }
      cursor.advance(spacing * (spec.count + 1));
      addDeck(ctx, cursor, 4, {});
      break;
    }
    case 'falling': {
      const tile = spec.tile ?? 2.6;
      const cols = 2;
      const rows = Math.floor(spec.length / tile);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const p = cursor.pos
            .clone()
            .addScaledVector(cursor.dir(), tile * (r + 0.5))
            .addScaledVector(cursor.right(), (c - (cols - 1) / 2) * tile);
          p.y -= 0.25;
          addFallingTile(ctx, p, new THREE.Vector3(tile - 0.08, 0.5, tile - 0.08));
        }
      }
      ctx.pathPoints.push(cursor.pos.clone());
      cursor.advance(rows * tile);
      break;
    }
    case 'lasers': {
      const start = cursor.pos.clone();
      addDeck(ctx, cursor, spec.length, {});
      const n = spec.count;
      for (let i = 0; i < n; i++) {
        const p = start.clone().addScaledVector(cursor.dir(), ((i + 1) * spec.length) / (n + 1));
        p.y += 0.9;
        addLaser(ctx, p, 6.4, cursor.heading, {
          period: spec.period ?? 2.4,
          phase: i * 0.7,
        });
      }
      break;
    }
    case 'wind': {
      const start = cursor.pos.clone();
      addDeck(ctx, cursor, spec.length, { width: 7 });
      const center = start.clone().addScaledVector(cursor.dir(), spec.length / 2);
      center.y += 1.6;
      const dir = cursor.right().multiplyScalar(spec.dirX).normalize();
      addZoneVolume(
        ctx,
        center,
        new THREE.Vector3(7, 3.4, spec.length),
        cursor.heading,
        { kind: 'wind', value: spec.strength ?? 14, dir },
        'wind',
      );
      break;
    }
    case 'dragZone': {
      const start = cursor.pos.clone();
      addDeck(ctx, cursor, spec.length, {});
      const center = start.clone().addScaledVector(cursor.dir(), spec.length / 2);
      center.y += 1.2;
      addZoneVolume(
        ctx,
        center,
        new THREE.Vector3(6, 2.4, spec.length),
        cursor.heading,
        { kind: 'drag', value: spec.strength ?? 2.4 },
        'drag',
      );
      break;
    }
    case 'slickZone':
      addDeck(ctx, cursor, spec.length, { width: spec.width, slick: true });
      break;
    case 'gravityZone': {
      const start = cursor.pos.clone();
      addDeck(ctx, cursor, spec.length, {});
      const center = start.clone().addScaledVector(cursor.dir(), spec.length / 2);
      center.y += 2;
      addZoneVolume(
        ctx,
        center,
        new THREE.Vector3(7, 4.5, spec.length),
        cursor.heading,
        { kind: 'gravity', value: spec.gravity },
        'gravity',
      );
      break;
    }
    case 'hazards': {
      const start = cursor.pos.clone();
      addDeck(ctx, cursor, spec.length, { width: 7 });
      const n = spec.count;
      for (let i = 0; i < n; i++) {
        const p = start.clone().addScaledVector(cursor.dir(), ((i + 1) * spec.length) / (n + 1));
        p.y += 0.06;
        const w = 2 + ctx.rng() * 2.4;
        addHazardStrip(ctx, p, new THREE.Vector3(w, 0.12, 1.6 + ctx.rng() * 1.4), cursor.heading);
      }
      break;
    }
    case 'bounces': {
      const start = cursor.pos.clone();
      addDeck(ctx, cursor, spec.count * (spec.spacing ?? 7), {});
      for (let i = 0; i < spec.count; i++) {
        const p = start
          .clone()
          .addScaledVector(cursor.dir(), (spec.spacing ?? 7) * (i + 0.5))
          .addScaledVector(cursor.right(), (i % 2 === 0 ? -1 : 1) * 1.2);
        addBouncePad(ctx, p, spec.power ?? 11);
      }
      cursor.advance(0);
      break;
    }
    case 'boosts': {
      const start = cursor.pos.clone();
      addDeck(ctx, cursor, spec.count * (spec.spacing ?? 8), {});
      for (let i = 0; i < spec.count; i++) {
        const p = start.clone().addScaledVector(cursor.dir(), (spec.spacing ?? 8) * (i + 0.5));
        addBoostPad(ctx, p, cursor.dir(), cursor.heading);
      }
      break;
    }
    case 'shards':
      buildShards(ctx, cursor, spec);
      break;
    case 'powerup': {
      addDeck(ctx, cursor, 4, {});
      const p = cursor.pos.clone();
      p.y += 1.6;
      addPowerup(ctx, p, spec.power);
      break;
    }
    case 'conveyor': {
      const start = cursor.pos.clone();
      addDeck(ctx, cursor, spec.length, { width: 6, edge: false });
      const center = start.clone().addScaledVector(cursor.dir(), spec.length / 2);
      center.y += 0.12;
      addConveyor(ctx, center, new THREE.Vector3(5.4, 0.18, spec.length * 0.92), cursor.heading, spec.strength ?? 18);
      break;
    }
    case 'gates': {
      const start = cursor.pos.clone();
      addDeck(ctx, cursor, spec.length, { width: 7 });
      const n = spec.count;
      for (let i = 0; i < n; i++) {
        const p = start.clone().addScaledVector(cursor.dir(), ((i + 1) * spec.length) / (n + 1));
        p.y += 0.05;
        addGate(ctx, p, 6.5, cursor.heading, {
          period: spec.period ?? 2.6,
          phase: i * 0.55,
          opening: 1.5,
        });
      }
      break;
    }
    case 'seesaws': {
      const spacing = spec.spacing ?? 9;
      for (let i = 0; i < spec.count; i++) {
        const p = cursor.pos.clone().addScaledVector(cursor.dir(), spacing * (i + 0.5));
        p.y -= 0.1;
        addSeesaw(ctx, p, cursor.heading, {
          length: 7.5,
          width: 4.8,
          amp: spec.amp ?? 0.32,
          speed: spec.speed ?? 0.75,
          phase: i * 1.1,
        });
        ctx.pathPoints.push(p.clone());
      }
      cursor.advance(spacing * spec.count);
      addDeck(ctx, cursor, 4, {});
      break;
    }
    case 'rings': {
      const start = cursor.pos.clone();
      addDeck(ctx, cursor, spec.length, { width: 5.5 });
      const n = spec.count;
      for (let i = 0; i < n; i++) {
        const p = start.clone().addScaledVector(cursor.dir(), ((i + 1) * spec.length) / (n + 1));
        p.y += 1.5;
        addRingGate(ctx, p, cursor.heading, {
          radius: 2.0,
          speed: (spec.speed ?? 1.5) * (i % 2 === 0 ? 1 : -1),
          phase: i * 0.9,
        });
      }
      break;
    }
    case 'crushers': {
      const start = cursor.pos.clone();
      addDeck(ctx, cursor, spec.length, { width: 6.5 });
      const n = spec.count;
      for (let i = 0; i < n; i++) {
        const p = start.clone().addScaledVector(cursor.dir(), ((i + 1) * spec.length) / (n + 1));
        addCrusher(ctx, p, 5.5, cursor.heading, {
          period: spec.period ?? 2.1,
          phase: i * 0.6,
          length: 2.8,
        });
      }
      break;
    }
    case 'portal': {
      // entry pad, void gap, exit pad - warp skips the void
      addDeck(ctx, cursor, 5, { width: 6 });
      const entry = cursor.pos.clone();
      entry.y += 0.05;
      cursor.advance(spec.gap);
      ctx.pathPoints.push(cursor.pos.clone());
      addDeck(ctx, cursor, 6, { width: 6 });
      const exit = cursor.pos.clone().addScaledVector(cursor.dir(), -3);
      exit.y += 0.05;
      addPortalPair(ctx, entry, exit, cursor.heading);
      break;
    }
    case 'goal': {
      addDeck(ctx, cursor, 8, { width: 8 });
      const surface = cursor.pos.clone();
      addGoalGate(ctx, surface, cursor.heading);
      cursor.advance(2);
      break;
    }
  }
}
