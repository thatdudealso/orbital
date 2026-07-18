/**
 * Lightweight GPU point-particle pool: bursts for pickups/deaths/victory
 * and a rolling trail emitter behind the ball. One draw call per pool.
 */

import * as THREE from 'three';

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (240.0 / max(0.1, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.08, d);
    gl_FragColor = vec4(vColor, vAlpha * soft);
  }
`;

export interface BurstOptions {
  color: THREE.ColorRepresentation;
  count: number;
  speed: number;
  life: number;
  size: number;
  up?: number;
  spread?: number; // 1 = full sphere
  gravity?: number;
}

export class ParticlePool {
  readonly points: THREE.Points;
  private readonly capacity: number;
  private cursor = 0;
  private live = 0;

  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly size: Float32Array;
  private readonly grav: Float32Array;

  private readonly posAttr: THREE.BufferAttribute;
  private readonly sizeAttr: THREE.BufferAttribute;
  private readonly alphaAttr: THREE.BufferAttribute;
  private readonly colorAttr: THREE.BufferAttribute;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.grav = new Float32Array(capacity);

    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage);
    this.alphaAttr = new THREE.BufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage);
    this.colorAttr = new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('aSize', this.sizeAttr);
    geo.setAttribute('aAlpha', this.alphaAttr);
    geo.setAttribute('aColor', this.colorAttr);

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  private spawnOne(p: THREE.Vector3, v: THREE.Vector3, life: number, size: number, color: THREE.Color, gravity: number): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size[i] = size;
    this.grav[i] = gravity;
    this.colorAttr.setXYZ(i, color.r, color.g, color.b);
  }

  burst(center: THREE.Vector3, opts: BurstOptions): void {
    const color = new THREE.Color(opts.color);
    const spread = opts.spread ?? 1;
    const up = opts.up ?? 0;
    const gravity = opts.gravity ?? 9;
    for (let n = 0; n < opts.count; n++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(1 - Math.random() * spread);
      const speed = opts.speed * (0.4 + Math.random() * 0.8);
      const v = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed + up,
        Math.sin(phi) * Math.sin(theta) * speed,
      );
      this.spawnOne(center, v, opts.life * (0.6 + Math.random() * 0.7), opts.size * (0.6 + Math.random() * 0.8), color, gravity);
    }
    this.live = Math.min(this.capacity, this.live + opts.count);
  }

  /** Single puff used by the ball trail emitter. */
  puff(p: THREE.Vector3, v: THREE.Vector3, color: THREE.ColorRepresentation, size = 0.5, life = 0.5): void {
    this.spawnOne(p, v, life, size, new THREE.Color(color), 0);
    this.live = Math.min(this.capacity, this.live + 1);
  }

  update(dt: number): void {
    if (this.live === 0) return;
    let anyAlive = false;
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) {
        this.alphaAttr.setX(i, 0);
        continue;
      }
      anyAlive = true;
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      this.posAttr.setXYZ(i, this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
      this.alphaAttr.setX(i, t * t);
      this.sizeAttr.setX(i, this.size[i] * (0.5 + t * 0.5));
    }
    if (!anyAlive) this.live = 0;
    this.posAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
