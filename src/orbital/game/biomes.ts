/**
 * The ten worlds of ORBITAL. Each biome is a full identity:
 * sky, palette, physics preset, decoration style, ambient behavior.
 */

import type { BiomePalette } from './materials';
import type { BallTuning } from './ball';
import type { SkySpec } from '../engine/renderer';

export type DecorationKind =
  | 'grid'
  | 'dunes'
  | 'city'
  | 'ocean'
  | 'peaks'
  | 'space'
  | 'magma'
  | 'glacier'
  | 'jungle'
  | 'core';

export interface BiomeDef {
  id: string;
  name: string;
  tagline: string;
  briefing: string;
  gravityNote: string;
  sky: SkySpec;
  palette: BiomePalette;
  physics: BallTuning & { trackFriction: number };
  decoration: DecorationKind;
  ballColor: string;
  fogNear: number;
}

const basePhysics = {
  accel: 30,
  maxSpeed: 14,
  jumpHeight: 2.1,
  friction: 0.9,
  restitution: 0.18,
  linearDamping: 0.24,
  angularDamping: 1.6,
  trackFriction: 0.95,
};

export const BIOMES: Record<string, BiomeDef> = {
  grid_zero: {
    id: 'grid_zero',
    name: 'GRID ZERO',
    tagline: 'calibration sector',
    briefing:
      'A flat training construct. Honest Earth gravity, honest friction. Learn the roll, the jump, and respect the void.',
    gravityNote: 'GRAVITY: 9.8 m/s² - EARTH BASELINE',
    sky: { top: '#04120c', bottom: '#010503', fogColor: '#03110a', fogDensity: 0.014 },
    palette: {
      track: '#142b1e',
      trackSide: '#0c1c13',
      edge: '#4ade80',
      accent: '#22d3ee',
      hazard: '#ef4444',
      shard: '#a7f3d0',
    },
    physics: { ...basePhysics, gravity: 9.8 },
    decoration: 'grid',
    ballColor: '#4ade80',
    fogNear: 60,
  },
  dune_sea: {
    id: 'dune_sea',
    name: 'DUNE SEA',
    tagline: 'the slow desert',
    briefing:
      'Endless sand drags at your roll - momentum bleeds fast and stops come late. Wind shoves sideways on the ridges. Carry speed or sink.',
    gravityNote: 'GRAVITY: 9.8 m/s² - HEAVY DRAG ZONES',
    sky: { top: '#2b1a08', bottom: '#120a03', fogColor: '#241505', fogDensity: 0.016 },
    palette: {
      track: '#4a3716',
      trackSide: '#2e2110',
      edge: '#fbbf24',
      accent: '#fb923c',
      hazard: '#ef4444',
      shard: '#fde68a',
    },
    physics: { ...basePhysics, gravity: 9.8, linearDamping: 0.5, maxSpeed: 13 },
    decoration: 'dunes',
    ballColor: '#fbbf24',
    fogNear: 55,
  },
  neon_city: {
    id: 'neon_city',
    name: 'NEON CITY',
    tagline: 'rooftop district',
    briefing:
      'A skyline of glass towers at 3AM. Rooftop gaps are long, beams are thin, and traffic platforms never wait. Precision over speed.',
    gravityNote: 'GRAVITY: 9.8 m/s² - EARTH BASELINE',
    sky: { top: '#0b0620', bottom: '#030209', fogColor: '#0a0618', fogDensity: 0.015 },
    palette: {
      track: '#1e1e3c',
      trackSide: '#12122a',
      edge: '#22d3ee',
      accent: '#f0abfc',
      hazard: '#ef4444',
      shard: '#67e8f9',
    },
    physics: { ...basePhysics, gravity: 9.8, maxSpeed: 15 },
    decoration: 'city',
    ballColor: '#22d3ee',
    fogNear: 60,
  },
  tide_break: {
    id: 'tide_break',
    name: 'TIDE BREAK',
    tagline: 'drowned causeway',
    briefing:
      'A broken highway over open water. Lower gravity floats your jumps; the sea itself grabs the ball and kills momentum. Time the pontoons.',
    gravityNote: 'GRAVITY: 7.8 m/s² - FLOATY ARC',
    sky: { top: '#062a3a', bottom: '#010d14', fogColor: '#052433', fogDensity: 0.016 },
    palette: {
      track: '#16394a',
      trackSide: '#0d2530',
      edge: '#38bdf8',
      accent: '#34d399',
      hazard: '#ef4444',
      shard: '#a5f3fc',
    },
    physics: { ...basePhysics, gravity: 7.8, maxSpeed: 13.5, jumpHeight: 2.0 },
    decoration: 'ocean',
    ballColor: '#38bdf8',
    fogNear: 55,
  },
  summit_pass: {
    id: 'summit_pass',
    name: 'SUMMIT PASS',
    tagline: 'knife-edge ridge',
    briefing:
      'Thin air on a broken ridgeline. Gravity runs a touch light, the ice sheets run frictionless, and the old tiles crumble under the ball.',
    gravityNote: 'GRAVITY: 8.6 m/s² - THIN AIR + ICE',
    sky: { top: '#1b2430', bottom: '#080d13', fogColor: '#16202b', fogDensity: 0.017 },
    palette: {
      track: '#39434d',
      trackSide: '#232b33',
      edge: '#a8a29e',
      accent: '#7dd3fc',
      hazard: '#ef4444',
      shard: '#e7e5e4',
    },
    physics: { ...basePhysics, gravity: 8.6, maxSpeed: 14.5 },
    decoration: 'peaks',
    ballColor: '#e7e5e4',
    fogNear: 50,
  },
  void_station: {
    id: 'void_station',
    name: 'VOID STATION',
    tagline: 'low-g dock ring',
    briefing:
      'A derelict dock ring in open orbit. A third of Earth gravity: jumps hang forever, landings drift, and inertia is the real opponent. GRAV-ANCHOR is your friend.',
    gravityNote: 'GRAVITY: 3.2 m/s² - LOW-G',
    sky: { top: '#02020a', bottom: '#000000', fogColor: '#05050f', fogDensity: 0.008 },
    palette: {
      track: '#232340',
      trackSide: '#141428',
      edge: '#a78bfa',
      accent: '#22d3ee',
      hazard: '#ef4444',
      shard: '#c4b5fd',
    },
    physics: { ...basePhysics, gravity: 3.2, maxSpeed: 16, jumpHeight: 3.2, linearDamping: 0.06, angularDamping: 0.9 },
    decoration: 'space',
    ballColor: '#a78bfa',
    fogNear: 90,
  },
  magma_rift: {
    id: 'magma_rift',
    name: 'MAGMA RIFT',
    tagline: 'the burning cut',
    briefing:
      'A crack in the world with a river of lava at the bottom. Geysers launch you across the gaps; the basalt collapses behind you. Do not touch the glow.',
    gravityNote: 'GRAVITY: 9.8 m/s² - LAVA KILLS',
    sky: { top: '#260802', bottom: '#0d0200', fogColor: '#200601', fogDensity: 0.018 },
    palette: {
      track: '#3d1c11',
      trackSide: '#26110a',
      edge: '#f97316',
      accent: '#fbbf24',
      hazard: '#ff2d00',
      shard: '#fdba74',
    },
    physics: { ...basePhysics, gravity: 9.8, maxSpeed: 14 },
    decoration: 'magma',
    ballColor: '#fb923c',
    fogNear: 45,
  },
  cryo_drift: {
    id: 'cryo_drift',
    name: 'CRYO DRIFT',
    tagline: 'the frictionless field',
    briefing:
      'Glacier ice from edge to edge. Almost no friction: you steer, you never stop. Bank the curves, feather the throttle, respect momentum.',
    gravityNote: 'GRAVITY: 9.8 m/s² - NEAR-ZERO FRICTION',
    sky: { top: '#0a2233', bottom: '#03101c', fogColor: '#0a1f30', fogDensity: 0.013 },
    palette: {
      track: '#1d4560',
      trackSide: '#123043',
      edge: '#7dd3fc',
      accent: '#22d3ee',
      hazard: '#ef4444',
      shard: '#e0f2fe',
    },
    physics: { ...basePhysics, gravity: 9.8, trackFriction: 0.12, friction: 0.25, linearDamping: 0.05, maxSpeed: 15 },
    decoration: 'glacier',
    ballColor: '#bae6fd',
    fogNear: 65,
  },
  overgrowth: {
    id: 'overgrowth',
    name: 'OVERGROWTH',
    tagline: 'ruined greenhouse',
    briefing:
      'Ancient ruins swallowed by engineered jungle. Bounce caps change your lines mid-air, pendulum vines sweep the channels. Rhythm beats speed.',
    gravityNote: 'GRAVITY: 9.8 m/s² - EARTH BASELINE',
    sky: { top: '#06260f', bottom: '#010d05', fogColor: '#05200c', fogDensity: 0.017 },
    palette: {
      track: '#1a3a25',
      trackSide: '#10271a',
      edge: '#34d399',
      accent: '#a3e635',
      hazard: '#ef4444',
      shard: '#bef264',
    },
    physics: { ...basePhysics, gravity: 9.8, maxSpeed: 14 },
    decoration: 'jungle',
    ballColor: '#a3e635',
    fogNear: 50,
  },
  the_core: {
    id: 'the_core',
    name: 'THE CORE',
    tagline: 'gravity engine',
    briefing:
      'The machine that bends gravity itself. Shift gates flip the world between LOW-G and CRUSH between one gate and the next. Everything you learned, all at once.',
    gravityNote: 'GRAVITY: 3.2 ⇄ 12 m/s² - SHIFT ZONES',
    sky: { top: '#16041d', bottom: '#05010a', fogColor: '#120316', fogDensity: 0.014 },
    palette: {
      track: '#2d1838',
      trackSide: '#1a0d24',
      edge: '#f0abfc',
      accent: '#a78bfa',
      hazard: '#ef4444',
      shard: '#f5d0fe',
    },
    physics: { ...basePhysics, gravity: 9.8, maxSpeed: 15 },
    decoration: 'core',
    ballColor: '#f0abfc',
    fogNear: 55,
  },
};

export const BIOME_ORDER = [
  'grid_zero',
  'dune_sea',
  'neon_city',
  'tide_break',
  'summit_pass',
  'void_station',
  'magma_rift',
  'cryo_drift',
  'overgrowth',
  'the_core',
] as const;
