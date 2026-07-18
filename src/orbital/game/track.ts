/**
 * Track builder: walks a cursor through the segment list, producing
 * the full physical + visual track plus cutscene waypoints.
 */

import * as THREE from 'three';
import { Cursor } from './cursor';
import { buildSegment, type SegmentSpec, addDeck } from './segments';
import type { BuildCtx } from './types';

export interface TrackResult {
  startPos: THREE.Vector3;
  startYaw: number;
  goalPos: THREE.Vector3;
  pathPoints: THREE.Vector3[];
  killY: number;
  shardTotal: number;
  lengthMeters: number;
}

export function buildTrack(ctx: BuildCtx, specs: SegmentSpec[]): TrackResult {
  const cursor = new Cursor(0, 0, 0, 0);

  // spawn pad: wide, safe, with a glowing spawn ring
  addDeck(ctx, cursor, 8, { width: 10 });
  const startPos = cursor.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
  const spawnRing = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.05, 8, 32),
    ctx.mats.edge,
  );
  spawnRing.rotation.x = Math.PI / 2;
  spawnRing.position.copy(cursor.pos).add(new THREE.Vector3(0, 0.06, 0));
  ctx.scene.add(spawnRing);

  for (const spec of specs) {
    buildSegment(ctx, cursor, spec);
  }

  const goalPos = cursor.pos.clone();

  return {
    startPos,
    startYaw: Math.PI, // camera faces -Z at spawn (yaw convention: facing = (sin, 0, cos))
    goalPos,
    pathPoints: ctx.pathPoints,
    killY: ctx.minY - 6,
    shardTotal: ctx.shards.length,
    lengthMeters: cursor.pos.length(),
  };
}
