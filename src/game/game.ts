/**
 * ORBITAL game orchestrator: owns the loop, the state machine, sensor
 * events, zones, power-ups, checkpoints, cutscenes, and the React bridge.
 */

import * as THREE from 'three';
import { Stage } from '../engine/renderer';
import { Physics, RAPIER } from '../engine/physics';
import { CameraRig } from '../engine/camera';
import { InputManager } from '../engine/input';
import { ParticlePool } from '../engine/particles';
import { Sfx } from '../engine/audio';
import { Emitter } from '../engine/events';
import { detectQuality, qualitySettings, type Quality, type QualitySettings } from '../engine/quality';
import { mulberry32 } from '../engine/prng';

import { BIOMES, type BiomeDef } from './biomes';
import { buildMaterials } from './materials';
import { buildTrack, type TrackResult } from './track';
import { buildDecorations } from './decorations';
import { markCheckpointActivated } from './obstacles';
import { Ball } from './ball';
import { buildIntroPath, introLookAt } from './cutscene';
import type { LevelDef } from './levels';
import type { RandomRunSpec } from './generator';
import type { BuildCtx, SensorData, ZoneEffect, PowerupType } from './types';
import { SensorRegistry } from './types';

export type GameState =
  | 'boot'
  | 'briefing'
  | 'countdown'
  | 'playing'
  | 'paused'
  | 'dead'
  | 'victory'
  | 'done';

export interface BriefingInfo {
  worldNumber: string;
  name: string;
  tagline: string;
  briefing: string;
  gravityNote: string;
  tips: string[];
  parTimeSec: number;
  modeLabel: string;
}

export interface CompleteStats {
  timeMs: number;
  parMs: number;
  deaths: number;
  shards: number;
  shardTotal: number;
  levelId: string;
  levelIndex: number;
  mode: 'campaign' | 'random';
}

export type GameEvents = {
  state: { state: GameState };
  briefing: { info: BriefingInfo } | null;
  countdown: { n: number | 'GO' | null };
  hud: { ms: number; speed: number; maxSpeed: number; shards: number; shardTotal: number; deaths: number };
  powerups: { active: PowerupType[] };
  checkpoint: { index: number; total: number };
  toast: { text: string; tone: 'ok' | 'bad' | 'info' };
  complete: { stats: CompleteStats };
};

interface GameConfig {
  canvas: HTMLCanvasElement;
  level?: LevelDef;
  randomRun?: RandomRunSpec;
  biomeId: string;
  parTimeSec: number;
  tips: string[];
  worldNumber: string;
  modeLabel: string;
  levelIndex: number;
  levelId: string;
  mode: 'campaign' | 'random';
  quality: Quality | 'auto';
  muted: boolean;
  events: Emitter<GameEvents>;
}

export class Game {
  private readonly cfg: GameConfig;
  private readonly events: Emitter<GameEvents>;

  private stage!: Stage;
  private physics!: Physics;
  private rig!: CameraRig;
  private input!: InputManager;
  private particles!: ParticlePool;
  private sfx!: Sfx;
  private ball!: Ball;
  private biome!: BiomeDef;
  private qs!: QualitySettings;

  private state: GameState = 'boot';
  private track!: TrackResult;
  private ctx!: BuildCtx;

  private raf = 0;
  private lastT = 0;
  private simTime = 0;
  private playTimeMs = 0;
  private deaths = 0;
  private shardsGot = 0;
  private timeScale = 1;
  private hudTimer = 0;
  private countdownT = 0;
  private respawnPos = new THREE.Vector3();
  private activeZones = new Set<ZoneEffect>();
  private baseGravity = 9.8;
  private deathT = 0;
  private victoryT = 0;
  private statsEmitted = false;
  private disposed = false;
  private trailT = 0;
  private delayedTimers = new Set<number>();

  constructor(cfg: GameConfig) {
    this.cfg = cfg;
    this.events = cfg.events;
  }

  // ---------------------------------------------------------------- boot

  async init(): Promise<void> {
    const quality = this.cfg.quality === 'auto' ? detectQuality() : this.cfg.quality;
    this.qs = qualitySettings(quality);
    this.biome = BIOMES[this.cfg.biomeId];
    this.baseGravity = this.biome.physics.gravity;

    this.stage = new Stage(this.cfg.canvas, this.qs);
    this.stage.setSky(this.biome.sky);
    this.physics = await Physics.create(this.baseGravity);
    if (this.disposed) {
      this.physics.free();
      return;
    }
    this.rig = new CameraRig(this.stage.camera);
    this.input = new InputManager();
    this.sfx = new Sfx();
    this.sfx.setMuted(this.cfg.muted);
    this.particles = new ParticlePool(this.qs.particleBudget);
    this.stage.scene.add(this.particles.points);

    // build world
    const scene = new THREE.Group();
    this.stage.scene.add(scene);
    this.ctx = {
      scene,
      world: this.physics.world,
      mats: buildMaterials(this.biome.palette),
      biome: this.biome,
      rng: mulberry32(0x0b17a1),
      qs: this.qs,
      sensors: new SensorRegistry(),
      updatables: [],
      shards: [],
      powerups: [],
      checkpoints: [],
      contactWatch: new Map(),
      pathPoints: [],
      minY: Infinity,
      particles: this.particles,
      sfx: this.sfx,
    };

    const segments = this.cfg.level ? this.cfg.level.segments : this.cfg.randomRun!.segments;
    this.track = buildTrack(this.ctx, segments);
    buildDecorations({
      scene,
      rng: mulberry32(0xdec0 ^ (this.cfg.randomRun?.seed ?? this.cfg.levelIndex * 977)),
      biome: this.biome,
      path: this.track.pathPoints,
      density: this.qs.decorationDensity,
      updatables: this.ctx.updatables,
    });

    this.ball = new Ball(this.physics.world, this.track.startPos, this.biome.physics, this.biome.ballColor);
    scene.add(this.ball.mesh);
    this.respawnPos.copy(this.track.startPos);
    this.rig.setWorld(this.physics.world, this.ball.collider);

    // input wiring
    this.input.attach();
    this.input.onPause = () => this.togglePause();
    this.input.onAnyInput = () => this.sfx.resume();

    this.resize();
    window.addEventListener('resize', this.resize);

    // enter briefing + flythrough
    this.setState('briefing');
    this.events.emit('briefing', {
      info: {
        worldNumber: this.cfg.worldNumber,
        name: this.biome.name,
        tagline: this.biome.tagline,
        briefing: this.biome.briefing,
        gravityNote: this.biome.gravityNote,
        tips: this.cfg.tips,
        parTimeSec: this.cfg.parTimeSec,
        modeLabel: this.cfg.modeLabel,
      },
    });
    const path = buildIntroPath(this.track.pathPoints, this.track.startPos);
    this.rig.startPath(path, 4.6, introLookAt(this.track.pathPoints, this.track.startPos), () => {
      this.startCountdown();
    });

    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  // ---------------------------------------------------------------- state

  private setState(s: GameState): void {
    this.state = s;
    this.events.emit('state', { state: s });
  }

  getState(): GameState {
    return this.state;
  }

  skipBriefing(): void {
    if (this.state === 'briefing') {
      this.rig.skipPath();
      this.events.emit('briefing', null);
    }
  }

  private startCountdown(): void {
    this.events.emit('briefing', null);
    this.setState('countdown');
    this.countdownT = 0;
    this.rig.snapBehind(this.ball.position, this.track.startYaw);
  }

  togglePause(): void {
    if (this.state === 'playing') {
      this.setState('paused');
      this.events.emit('toast', { text: 'PAUSED', tone: 'info' });
    } else if (this.state === 'paused') {
      this.setState('playing');
    }
  }

  resume(): void {
    if (this.state === 'paused') this.setState('playing');
  }

  /** Full restart of the current level/run. */
  restart(): void {
    this.dispose();
    this.events.emit('state', { state: 'boot' });
    // React re-mounts the game; see OrbitalGame host component.
    this.events.emit('toast', { text: 'RESTARTING', tone: 'info' });
  }

  // ---------------------------------------------------------------- loop

  private readonly loop = (now: number): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const rawDt = Math.min(0.1, (now - this.lastT) / 1000);
    this.lastT = now;
    const paused = this.state === 'paused';

    // effective time scale
    let scale = 1;
    if (this.state === 'playing' && this.ball.isSlowOn(this.simTime)) scale *= 0.55;
    if (this.state === 'dead' || this.state === 'victory') scale *= 0.28;
    if (paused) scale = 0;
    this.timeScale = scale;
    const dt = rawDt * scale;
    if (!paused) this.simTime += dt;

    if (this.state === 'countdown') this.tickCountdown(rawDt);
    if (this.state === 'playing') this.tickPlaying(rawDt, dt);
    if (this.state === 'dead') this.tickDead(rawDt);
    if (this.state === 'victory') this.tickVictory(rawDt);

    // world animation always runs (except hard pause)
    if (this.state !== 'paused') {
      for (const u of this.ctx.updatables) u.update(dt, this.simTime);
      this.particles.update(dt);
    }

    // camera + render
    if (this.state !== 'paused') {
      this.rig.update(rawDt, this.ball.position, this.ball.velocity);
      this.ball.syncMesh();
      this.stage.trackFocus(this.ball.position);
      this.emitTrail(dt);
    }
    this.stage.render();
    this.emitHud(rawDt);
  };

  private tickCountdown(rawDt: number): void {
    const prev = Math.floor(this.countdownT);
    this.countdownT += rawDt;
    const cur = Math.floor(this.countdownT);
    if (cur !== prev && cur <= 3) {
      if (cur < 3) {
        this.events.emit('countdown', { n: 3 - cur });
        this.sfx.countdownTick();
      } else {
        this.events.emit('countdown', { n: 'GO' });
        this.sfx.countdownGo();
        this.setState('playing');
        this.queueTimer(() => {
          if (!this.disposed) this.events.emit('countdown', { n: null });
        }, 600);
      }
    }
  }

  private tickPlaying(rawDt: number, dt: number): void {
    this.playTimeMs += rawDt * 1000;
    const move = this.input.poll();
    this.ball.update(dt, this.simTime, this.physics.world, move, this.rig.getYaw(), this.biome.physics);
    this.physics.step(dt);
    this.drainSensors();
    this.applyZones(dt);
    this.tickMagnet();

    if (move.jumpPressed && this.ball.grounded) this.sfx.jump();

    // kill plane
    if (this.ball.position.y < this.track.killY) this.die('void');
    // powerup states for HUD
    this.events.emit('powerups', { active: this.ball.activePowers(this.simTime) });
    // FOV kick while boosting
    const targetFov = this.ball.isBoosting(this.simTime) ? 72 : 62;
    const cam = this.stage.camera;
    cam.fov += (targetFov - cam.fov) * Math.min(1, rawDt * 6);
    cam.updateProjectionMatrix();
  }

  private tickDead(rawDt: number): void {
    this.deathT += rawDt;
    if (this.deathT > 0.55) {
      this.ball.respawn(this.respawnPos);
      this.ball.invulnerableUntil = this.simTime + 1.2;
      this.rig.snapBehind(this.respawnPos, this.track.startYaw);
      this.setState('playing');
    }
  }

  private tickVictory(rawDt: number): void {
    this.victoryT += rawDt;
    if (this.victoryT > 2.1 && !this.statsEmitted) {
      this.statsEmitted = true;
      this.setState('done');
      this.events.emit('complete', {
        stats: {
          timeMs: Math.round(this.playTimeMs),
          parMs: this.cfg.parTimeSec * 1000,
          deaths: this.deaths,
          shards: this.shardsGot,
          shardTotal: this.track.shardTotal,
          levelId: this.cfg.levelId,
          levelIndex: this.cfg.levelIndex,
          mode: this.cfg.mode,
        },
      });
    }
  }

  // ---------------------------------------------------------------- sensors

  private drainSensors(): void {
    const ballHandle = this.ball.collider.handle;
    this.physics.eventQueue.drainCollisionEvents((h1, h2, started) => {
      const other = h1 === ballHandle ? h2 : h2 === ballHandle ? h1 : -1;
      if (other === -1) {
        // non-ball contact (falling tiles watch ball only, ignore)
        return;
      }
      // contact watchers (falling tiles)
      const watcher = this.ctx.contactWatch.get(other);
      if (watcher && started) watcher.onBallContact();

      const data = this.ctx.sensors.get(other);
      if (!data) return;
      if (started) this.onSensorEnter(data);
      else this.onSensorExit(data);
    });
  }

  private onSensorEnter(data: SensorData): void {
    switch (data.type) {
      case 'checkpoint': {
        this.respawnPos.copy(data.pos);
        markCheckpointActivated(this.ctx, data.index);
        this.sfx.checkpoint();
        this.particles.burst(data.pos, { color: '#4ade80', count: 26, speed: 5, life: 0.7, size: 0.5, up: 2 });
        this.events.emit('checkpoint', { index: data.index, total: this.ctx.checkpoints.length });
        this.events.emit('toast', { text: `CHECKPOINT ${data.index + 1}/${this.ctx.checkpoints.length}`, tone: 'ok' });
        break;
      }
      case 'shard': {
        const shard = this.ctx.shards[data.id];
        if (shard && !shard.collected) this.collectShard(shard.id);
        break;
      }
      case 'powerup': {
        const p = this.ctx.powerups[data.id];
        if (p && !p.taken) {
          p.taken = true;
          p.mesh.visible = false;
          this.ball.apply(p.power, this.simTime);
          this.sfx.powerup();
          this.particles.burst(p.pos, { color: this.powerColor(p.power), count: 30, speed: 5, life: 0.8, size: 0.55, up: 2 });
          this.events.emit('toast', { text: p.power.toUpperCase(), tone: 'info' });
        }
        break;
      }
      case 'hazard': {
        if (this.simTime < this.ball.invulnerableUntil) break;
        if (this.ball.consumeShield()) {
          this.sfx.hazard();
          this.ball.invulnerableUntil = this.simTime + 1;
          // knock upward away from the hazard
          const v = this.ball.velocity;
          this.ball.body.setLinvel({ x: v.x * 0.3, y: 6, z: v.z * 0.3 }, true);
          this.events.emit('toast', { text: 'SHIELD SPENT', tone: 'bad' });
        } else {
          this.die(data.kind);
        }
        break;
      }
      case 'goal': {
        if (this.state === 'playing') this.win();
        break;
      }
      case 'zone': {
        this.activeZones.add(data.zone);
        break;
      }
      case 'bounce': {
        const v = this.ball.velocity;
        const boost = data.forward ? data.forward.clone().multiplyScalar(3) : new THREE.Vector3();
        this.ball.body.setLinvel({ x: v.x * 0.6 + boost.x, y: data.power, z: v.z * 0.6 + boost.z }, true);
        this.sfx.bounce();
        this.particles.burst(this.ball.position, { color: this.biome.palette.accent, count: 16, speed: 3.5, life: 0.5, size: 0.5 });
        break;
      }
      case 'boostpad': {
        const v = this.ball.velocity;
        const d = data.dir;
        this.ball.body.setLinvel(
          { x: v.x * 0.4 + d.x * data.power, y: Math.max(v.y, 1.5), z: v.z * 0.4 + d.z * data.power },
          true,
        );
        this.sfx.boost();
        this.particles.burst(this.ball.position, { color: '#22d3ee', count: 22, speed: 6, life: 0.5, size: 0.5 });
        break;
      }
    }
  }

  private onSensorExit(data: SensorData): void {
    if (data.type === 'zone') {
      this.activeZones.delete(data.zone);
      if (data.zone.kind === 'drag') this.ball.extraDamping = 0;
    }
  }

  private applyZones(dt: number): void {
    let gravity: number | null = null;
    for (const zone of this.activeZones) {
      if (zone.kind === 'wind' && zone.dir) {
        const mass = this.ball.body.mass();
        this.ball.body.applyImpulse(
          { x: zone.dir.x * zone.value * mass * dt, y: 0, z: zone.dir.z * zone.value * mass * dt },
          true,
        );
        if (Math.random() < 0.25) {
          const p = this.ball.position.add(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 1.5, (Math.random() - 0.5) * 3));
          this.particles.puff(p, zone.dir.clone().multiplyScalar(6), this.biome.palette.accent, 0.35, 0.5);
        }
      } else if (zone.kind === 'drag') {
        this.ball.extraDamping = zone.value;
      } else if (zone.kind === 'gravity') {
        gravity = zone.value;
      }
    }
    this.physics.setGravity(gravity ?? this.baseGravity);
  }

  private tickMagnet(): void {
    if (!this.ball.isMagnetOn(this.simTime)) return;
    const bp = this.ball.position;
    for (const shard of this.ctx.shards) {
      if (shard.collected) continue;
      const d = shard.mesh.position.distanceTo(bp);
      if (d < 8) {
        shard.mesh.position.lerp(bp, 0.12);
        if (d < 1.1) this.collectShard(shard.id);
      }
    }
  }

  private collectShard(id: number): void {
    const shard = this.ctx.shards[id];
    if (!shard || shard.collected) return;
    shard.collected = true;
    shard.mesh.visible = false;
    this.shardsGot++;
    this.sfx.shard();
    this.particles.burst(shard.mesh.position, { color: this.biome.palette.shard, count: 10, speed: 2.5, life: 0.4, size: 0.4, up: 1.5 });
  }

  private powerColor(p: PowerupType): string {
    return { boost: '#22d3ee', shield: '#fbbf24', magnet: '#a78bfa', slow: '#f0abfc', anchor: '#4ade80' }[p];
  }

  // ---------------------------------------------------------------- death & victory

  private die(kind: string): void {
    if (this.state !== 'playing') return;
    this.deaths++;
    this.setState('dead');
    this.deathT = 0;
    this.sfx.death();
    this.particles.burst(this.ball.position, {
      color: kind === 'void' ? this.biome.palette.edge : '#ef4444',
      count: 46,
      speed: 8,
      life: 0.9,
      size: 0.6,
      up: 3,
    });
    this.ball.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.events.emit('toast', {
      text: kind === 'void' ? 'LOST TO THE VOID' : kind === 'lava' ? 'INCINERATED' : 'TERMINATED',
      tone: 'bad',
    });
  }

  private win(): void {
    this.setState('victory');
    this.victoryT = 0;
    this.sfx.victory();
    const goal = this.track.goalPos.clone().add(new THREE.Vector3(0, 2.2, 0));
    this.rig.startOrbit(goal, 6, 2.8);
    for (let i = 0; i < 3; i++) {
      this.queueTimer(() => {
        if (!this.disposed) {
          this.particles.burst(goal, { color: [this.biome.palette.edge, this.biome.palette.accent, '#ffffff'][i], count: 60, speed: 9, life: 1.4, size: 0.7, up: 5, gravity: 6 });
        }
      }, i * 260);
    }
    // freeze the ball gently at the gate
    this.ball.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }

  // ---------------------------------------------------------------- hud / trail

  private emitHud(rawDt: number): void {
    this.hudTimer += rawDt;
    if (this.hudTimer < 0.08) return;
    this.hudTimer = 0;
    const v = this.ball.velocity;
    this.events.emit('hud', {
      ms: Math.round(this.playTimeMs),
      speed: Math.hypot(v.x, v.z),
      maxSpeed: this.biome.physics.maxSpeed * (this.ball.isBoosting(this.simTime) ? 1.6 : 1),
      shards: this.shardsGot,
      shardTotal: this.track.shardTotal,
      deaths: this.deaths,
    });
  }

  private emitTrail(dt: number): void {
    if (this.state !== 'playing') return;
    this.trailT += dt;
    const v = this.ball.velocity;
    const speed = v.length();
    if (speed < 4 || this.trailT < 0.03) return;
    this.trailT = 0;
    const p = this.ball.position;
    p.y -= 0.2;
    this.particles.puff(p, v.clone().multiplyScalar(-0.06), this.biome.ballColor, 0.42, 0.45);
  }

  // ---------------------------------------------------------------- misc

  private readonly resize = (): void => {
    const parent = this.cfg.canvas.parentElement;
    if (!parent) return;
    this.stage.resize(parent.clientWidth, parent.clientHeight);
  };

  private queueTimer(callback: () => void, delayMs: number): number {
    const id = window.setTimeout(() => {
      this.delayedTimers.delete(id);
      callback();
    }, delayMs);
    this.delayedTimers.add(id);
    return id;
  }

  setMuted(m: boolean): void {
    this.sfx.setMuted(m);
  }

  getInput(): InputManager {
    return this.input;
  }

  recalibrateTilt(): void {
    this.input.calibrateTilt();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const id of this.delayedTimers) window.clearTimeout(id);
    this.delayedTimers.clear();
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.input?.detach();
    this.physics?.free();
    this.particles?.dispose();
    this.stage?.dispose();
  }
}

/** Load Rapier once per session (WASM init is async + cached). */
export async function preloadEngine(): Promise<void> {
  await RAPIER.init();
}
