/**
 * Biome scenery: instanced scatter decoration around the track.
 * Everything is procedural, instanced (one draw call per family),
 * and placed away from the racing line.
 */

import * as THREE from 'three';
import type { PRNG } from '../engine/prng';
import { range, int } from '../engine/prng';
import type { BiomeDef } from './biomes';

interface DecorCtx {
  scene: THREE.Group;
  rng: PRNG;
  biome: BiomeDef;
  path: THREE.Vector3[];
  density: number;
  updatables: { update(dt: number, t: number): void }[];
}

function awayFromTrack(path: THREE.Vector3[], p: THREE.Vector3, minDist: number): boolean {
  for (const q of path) {
    const dx = q.x - p.x;
    const dz = q.z - p.z;
    if (dx * dx + dz * dz < minDist * minDist) return false;
  }
  return true;
}

function scatter(ctx: DecorCtx, count: number, spread: number, minDist: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  const box = new THREE.Box3().setFromPoints(ctx.path);
  let guard = 0;
  while (out.length < count && guard++ < count * 30) {
    const p = new THREE.Vector3(
      range(ctx.rng, box.min.x - spread, box.max.x + spread),
      0,
      range(ctx.rng, box.min.z - spread, box.max.z + spread),
    );
    if (awayFromTrack(ctx.path, p, minDist)) out.push(p);
  }
  return out;
}

function baseY(path: THREE.Vector3[]): number {
  let min = Infinity;
  for (const p of path) min = Math.min(min, p.y);
  return min;
}

export function buildDecorations(ctx: DecorCtx): void {
  const { biome } = ctx;
  const d = ctx.density;
  const floor = baseY(ctx.path);

  switch (biome.decoration) {
    case 'grid': {
      // floating wireframe cubes
      const count = int(ctx.rng, 40, 60) * d;
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshBasicMaterial({ color: biome.palette.edge, wireframe: true, transparent: true, opacity: 0.35 });
      const inst = new THREE.InstancedMesh(geo, mat, Math.floor(count));
      const m = new THREE.Matrix4();
      const pts = scatter(ctx, Math.floor(count), 70, 9);
      pts.forEach((p, i) => {
        const s = range(ctx.rng, 0.8, 4);
        m.makeRotationY(ctx.rng() * Math.PI);
        m.setPosition(p.x, floor + range(ctx.rng, -6, 18), p.z);
        m.scale(new THREE.Vector3(s, s, s));
        inst.setMatrixAt(i, m);
      });
      ctx.scene.add(inst);
      ctx.updatables.push({ update(_dt, t) { inst.rotation.y = t * 0.02; } });
      break;
    }
    case 'dunes': {
      const count = Math.floor(int(ctx.rng, 50, 70) * d);
      const geo = new THREE.SphereGeometry(1, 12, 8);
      const mat = new THREE.MeshStandardMaterial({ color: '#6b4c1e', roughness: 1 });
      const inst = new THREE.InstancedMesh(geo, mat, count);
      const m = new THREE.Matrix4();
      scatter(ctx, count, 110, 14).forEach((p, i) => {
        const s = range(ctx.rng, 6, 22);
        m.identity();
        m.setPosition(p.x, floor - s * 0.55, p.z);
        m.scale(new THREE.Vector3(s, s * 0.35, s * 1.4));
        inst.setMatrixAt(i, m);
      });
      ctx.scene.add(inst);
      break;
    }
    case 'city': {
      const count = Math.floor(int(ctx.rng, 46, 64) * d);
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshStandardMaterial({ color: '#12122a', roughness: 0.9 });
      const inst = new THREE.InstancedMesh(geo, mat, count);
      const winGeo = new THREE.BoxGeometry(1.02, 0.06, 1.02);
      const winMat = new THREE.MeshStandardMaterial({ color: '#000', emissive: new THREE.Color('#22d3ee'), emissiveIntensity: 0.9 });
      const winInst = new THREE.InstancedMesh(winGeo, winMat, count);
      const m = new THREE.Matrix4();
      // buildings sit far from the racing line and low, so they frame the
      // track as a skyline instead of swallowing the camera
      scatter(ctx, count, 100, 26).forEach((p, i) => {
        const w = range(ctx.rng, 3.5, 8);
        const h = range(ctx.rng, 8, 30);
        m.identity();
        m.setPosition(p.x, floor + h / 2 - 14, p.z);
        m.scale(new THREE.Vector3(w, h, w));
        inst.setMatrixAt(i, m);
        // lit band near the top
        m.setPosition(p.x, floor + h - 14 - range(ctx.rng, 1, h * 0.4), p.z);
        m.scale(new THREE.Vector3(w, 1, w));
        winInst.setMatrixAt(i, m);
      });
      ctx.scene.add(inst, winInst);
      break;
    }
    case 'ocean': {
      // water plane + buoys
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(600, 600, 1, 1),
        new THREE.MeshStandardMaterial({
          color: '#0a3042',
          emissive: new THREE.Color('#0a5a7a'),
          emissiveIntensity: 0.25,
          transparent: true,
          opacity: 0.85,
          roughness: 0.3,
        }),
      );
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = floor - 7;
      ctx.scene.add(plane);
      ctx.updatables.push({
        update(_dt, t) {
          plane.position.y = floor - 7 + Math.sin(t * 0.5) * 0.35;
        },
      });
      const count = Math.floor(24 * d);
      const geo = new THREE.CylinderGeometry(0.5, 0.7, 1.4, 8);
      const mat = new THREE.MeshStandardMaterial({ color: '#0e4a5f', emissive: new THREE.Color('#38bdf8'), emissiveIntensity: 0.4 });
      const inst = new THREE.InstancedMesh(geo, mat, count);
      const m = new THREE.Matrix4();
      scatter(ctx, count, 80, 10).forEach((p, i) => {
        m.identity();
        m.setPosition(p.x, floor - 6.4, p.z);
        inst.setMatrixAt(i, m);
      });
      ctx.scene.add(inst);
      break;
    }
    case 'peaks': {
      const count = Math.floor(int(ctx.rng, 40, 60) * d);
      const geo = new THREE.ConeGeometry(1, 1, 6);
      const mat = new THREE.MeshStandardMaterial({ color: '#39424c', roughness: 1 });
      const snowMat = new THREE.MeshStandardMaterial({ color: '#dbe7ee', roughness: 0.9 });
      const inst = new THREE.InstancedMesh(geo, mat, count);
      const snow = new THREE.InstancedMesh(geo, snowMat, count);
      const m = new THREE.Matrix4();
      scatter(ctx, count, 110, 15).forEach((p, i) => {
        const s = range(ctx.rng, 8, 26);
        m.identity();
        m.setPosition(p.x, floor + s * 0.28 - 6, p.z);
        m.scale(new THREE.Vector3(s, s * 0.9, s));
        inst.setMatrixAt(i, m);
        m.setPosition(p.x, floor + s * 0.62 - 6, p.z);
        m.scale(new THREE.Vector3(s * 0.36, s * 0.35, s * 0.36));
        snow.setMatrixAt(i, m);
      });
      ctx.scene.add(inst, snow);
      break;
    }
    case 'space': {
      // starfield + planet + station ring
      const starCount = Math.floor(900 * d);
      const positions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(range(ctx.rng, 180, 420));
        positions.set([v.x, v.y, v.z], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const stars = new THREE.Points(
        geo,
        new THREE.PointsMaterial({ color: '#cfd4ff', size: 1.1, sizeAttenuation: false, transparent: true, opacity: 0.85 }),
      );
      ctx.scene.add(stars);
      const planet = new THREE.Mesh(
        new THREE.SphereGeometry(60, 32, 24),
        new THREE.MeshStandardMaterial({ color: '#2c2a4a', emissive: new THREE.Color('#151230'), roughness: 0.85 }),
      );
      planet.position.set(140, -60, -260);
      ctx.scene.add(planet);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(84, 1.6, 8, 64),
        new THREE.MeshStandardMaterial({ color: '#000', emissive: new THREE.Color(biome.palette.edge), emissiveIntensity: 0.8 }),
      );
      ring.position.copy(planet.position);
      ring.rotation.x = Math.PI / 2.6;
      ctx.scene.add(ring);
      ctx.updatables.push({ update(_dt, t) { ring.rotation.z = t * 0.05; } });
      break;
    }
    case 'magma': {
      // lava plane + obsidian spikes + ember particles handled by pool
      const lava = new THREE.Mesh(
        new THREE.PlaneGeometry(600, 600),
        new THREE.MeshStandardMaterial({
          color: '#3d0c00',
          emissive: new THREE.Color('#ff4d00'),
          emissiveIntensity: 1.4,
          roughness: 0.7,
        }),
      );
      lava.rotation.x = -Math.PI / 2;
      lava.position.y = floor - 5;
      ctx.scene.add(lava);
      ctx.updatables.push({
        update(_dt, t) {
          (lava.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.3 + Math.sin(t * 1.4) * 0.25;
        },
      });
      const count = Math.floor(46 * d);
      const geo = new THREE.ConeGeometry(1, 1, 5);
      const mat = new THREE.MeshStandardMaterial({ color: '#190b06', roughness: 1 });
      const inst = new THREE.InstancedMesh(geo, mat, count);
      const m = new THREE.Matrix4();
      scatter(ctx, count, 90, 11).forEach((p, i) => {
        const s = range(ctx.rng, 2, 9);
        m.identity();
        m.makeRotationY(ctx.rng() * Math.PI);
        m.setPosition(p.x, floor + s * 0.4 - 4.5, p.z);
        m.scale(new THREE.Vector3(s * 0.5, s, s * 0.5));
        inst.setMatrixAt(i, m);
      });
      ctx.scene.add(inst);
      break;
    }
    case 'glacier': {
      const count = Math.floor(int(ctx.rng, 50, 70) * d);
      const geo = new THREE.OctahedronGeometry(1, 0);
      const mat = new THREE.MeshStandardMaterial({
        color: '#9fd4f0',
        emissive: new THREE.Color('#2c6a8f'),
        emissiveIntensity: 0.35,
        roughness: 0.1,
        metalness: 0.4,
        transparent: true,
        opacity: 0.92,
      });
      const inst = new THREE.InstancedMesh(geo, mat, count);
      const m = new THREE.Matrix4();
      scatter(ctx, count, 100, 12).forEach((p, i) => {
        const s = range(ctx.rng, 1.5, 8);
        m.identity();
        m.makeRotationY(ctx.rng() * Math.PI);
        m.setPosition(p.x, floor + s * 0.4 - 4, p.z);
        m.scale(new THREE.Vector3(s * 0.45, s, s * 0.45));
        inst.setMatrixAt(i, m);
      });
      ctx.scene.add(inst);
      break;
    }
    case 'jungle': {
      const count = Math.floor(int(ctx.rng, 60, 90) * d);
      const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 3.2, 6);
      const canopyGeo = new THREE.ConeGeometry(1.6, 3.4, 7);
      const trunkMat = new THREE.MeshStandardMaterial({ color: '#1c2a12', roughness: 1 });
      const canopyMat = new THREE.MeshStandardMaterial({ color: '#163d1e', emissive: new THREE.Color('#0d3416'), emissiveIntensity: 0.4, roughness: 0.9 });
      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
      const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, count);
      const m = new THREE.Matrix4();
      scatter(ctx, count, 90, 11).forEach((p, i) => {
        const s = range(ctx.rng, 0.8, 2.6);
        m.identity();
        m.setPosition(p.x, floor + 1.6 * s - 3, p.z);
        m.scale(new THREE.Vector3(s, s, s));
        trunks.setMatrixAt(i, m);
        m.setPosition(p.x, floor + (3.2 + 1.4) * s - 3, p.z);
        canopies.setMatrixAt(i, m);
      });
      ctx.scene.add(trunks, canopies);
      break;
    }
    case 'core': {
      // concentric machinery rings + floating shards
      const ringCount = Math.floor(10 * d);
      for (let i = 0; i < ringCount; i++) {
        const r = range(ctx.rng, 20, 90);
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(r, 0.35, 8, 72),
          new THREE.MeshStandardMaterial({ color: '#000', emissive: new THREE.Color(biome.palette.edge), emissiveIntensity: 0.55, transparent: true, opacity: 0.7 }),
        );
        const p = ctx.path[Math.floor(ctx.rng() * ctx.path.length)];
        ring.position.set(p.x + range(ctx.rng, -30, 30), floor + range(ctx.rng, 4, 40), p.z + range(ctx.rng, -30, 30));
        ring.rotation.set(ctx.rng() * Math.PI, ctx.rng() * Math.PI, 0);
        ctx.scene.add(ring);
        const speed = range(ctx.rng, 0.05, 0.25) * (i % 2 === 0 ? 1 : -1);
        ctx.updatables.push({ update(_dt, t) { ring.rotation.z = t * speed; } });
      }
      break;
    }
  }
}
