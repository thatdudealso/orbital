/**
 * The twenty worlds of ORBITAL (Act I + Act II). Each biome is a full identity:
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
  | 'core'
  // Act II
  | 'mirror'
  | 'storm'
  | 'chrome'
  | 'bloom'
  | 'abyss'
  | 'clock'
  | 'prism'
  | 'forge'
  | 'signal'
  | 'horizon';

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
    sky: { top: '#12203a', bottom: '#04080f', fogColor: '#0f1c2e', fogDensity: 0.014 },
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

  // ------------------------------------------------------------------ ACT II

  mirror_mere: {
    id: 'mirror_mere',
    name: 'MIRROR MERE',
    tagline: 'reflected causeway',
    briefing:
      'A still black lake under twin moons. The deck is honest Earth gravity, but oscillating gates and spinning rings demand timing over brute speed. PHASE slips you through the worst of it.',
    gravityNote: 'GRAVITY: 9.5 m/s² - TIMING TRIAL',
    sky: { top: '#061018', bottom: '#02060c', fogColor: '#050e16', fogDensity: 0.013 },
    palette: {
      track: '#0f2430',
      trackSide: '#0a1820',
      edge: '#67e8f9',
      accent: '#a5f3fc',
      hazard: '#f472b6',
      shard: '#e0f2fe',
    },
    physics: { ...basePhysics, gravity: 9.5, maxSpeed: 14.5, linearDamping: 0.22 },
    decoration: 'mirror',
    ballColor: '#67e8f9',
    fogNear: 58,
  },
  storm_spire: {
    id: 'storm_spire',
    name: 'STORM SPIRE',
    tagline: 'crosswind cathedral',
    briefing:
      'A needle tower punched through a living storm. Side winds never rest, conveyors hurl you forward, and the air is thick. Lean hard or get thrown into the void.',
    gravityNote: 'GRAVITY: 10.4 m/s² - HEAVY AIR + WIND',
    sky: { top: '#1a1030', bottom: '#080412', fogColor: '#140c24', fogDensity: 0.018 },
    palette: {
      track: '#2a1f45',
      trackSide: '#1a1430',
      edge: '#c084fc',
      accent: '#818cf8',
      hazard: '#f43f5e',
      shard: '#e9d5ff',
    },
    physics: { ...basePhysics, gravity: 10.4, maxSpeed: 13.5, linearDamping: 0.38, jumpHeight: 1.95 },
    decoration: 'storm',
    ballColor: '#c084fc',
    fogNear: 48,
  },
  chrome_yard: {
    id: 'chrome_yard',
    name: 'CHROME YARD',
    tagline: 'industrial scrap rail',
    briefing:
      'Abandoned freight spines and slam-doors. Crushers pulse on a brutal clock; seesaws dump the careless. DASH punches you through closing gaps - miss the window and you are scrap.',
    gravityNote: 'GRAVITY: 9.8 m/s² - MACHINERY KILLS',
    sky: { top: '#1c1410', bottom: '#0a0806', fogColor: '#16100c', fogDensity: 0.016 },
    palette: {
      track: '#3a322c',
      trackSide: '#241e1a',
      edge: '#fb923c',
      accent: '#fbbf24',
      hazard: '#ef4444',
      shard: '#fed7aa',
    },
    physics: { ...basePhysics, gravity: 9.8, maxSpeed: 14.5, friction: 0.95 },
    decoration: 'chrome',
    ballColor: '#fb923c',
    fogNear: 52,
  },
  glass_bloom: {
    id: 'glass_bloom',
    name: 'GLASS BLOOM',
    tagline: 'crystal greenhouse',
    briefing:
      'A shattered arboretum of light. Low friction glass runs, bounce pads rewrite arcs, and portal pairs skip the broken spans. ECHO pulls every shard within a wide radius - greed is optional, beauty is not.',
    gravityNote: 'GRAVITY: 8.9 m/s² - LIGHT + SLICK',
    sky: { top: '#102018', bottom: '#040c08', fogColor: '#0c1812', fogDensity: 0.014 },
    palette: {
      track: '#1a3a32',
      trackSide: '#102820',
      edge: '#2dd4bf',
      accent: '#a3e635',
      hazard: '#f43f5e',
      shard: '#99f6e4',
    },
    physics: {
      ...basePhysics,
      gravity: 8.9,
      trackFriction: 0.28,
      friction: 0.4,
      linearDamping: 0.1,
      maxSpeed: 15,
      jumpHeight: 2.25,
    },
    decoration: 'bloom',
    ballColor: '#2dd4bf',
    fogNear: 55,
  },
  silent_abyss: {
    id: 'silent_abyss',
    name: 'SILENT ABYSS',
    tagline: 'pressure trench',
    briefing:
      'A trench so deep the light dies. Crush gravity pins you to the deck; drag pools swallow speed. Jump arcs are short and mean. ANCHOR is already the world - survive the crush.',
    gravityNote: 'GRAVITY: 14.2 m/s² - CRUSH PRESSURE',
    sky: { top: '#020816', bottom: '#000206', fogColor: '#020610', fogDensity: 0.022 },
    palette: {
      track: '#0c1a28',
      trackSide: '#061018',
      edge: '#38bdf8',
      accent: '#6366f1',
      hazard: '#e11d48',
      shard: '#7dd3fc',
    },
    physics: {
      ...basePhysics,
      gravity: 14.2,
      maxSpeed: 12.5,
      jumpHeight: 1.55,
      linearDamping: 0.42,
      accel: 34,
    },
    decoration: 'abyss',
    ballColor: '#38bdf8',
    fogNear: 40,
  },
  clockwork_veil: {
    id: 'clockwork_veil',
    name: 'CLOCKWORK VEIL',
    tagline: 'gear cathedral',
    briefing:
      'Brass gears the size of districts. Gates, rings, and crushers tick on interlocking rhythms. Memorize one cycle, then chain the openings. PHASE buys a mistake; rhythm buys the run.',
    gravityNote: 'GRAVITY: 9.8 m/s² - TIMED MACHINERY',
    sky: { top: '#1a1208', bottom: '#0a0703', fogColor: '#14100a', fogDensity: 0.015 },
    palette: {
      track: '#3d2e18',
      trackSide: '#261c10',
      edge: '#fbbf24',
      accent: '#f59e0b',
      hazard: '#dc2626',
      shard: '#fde68a',
    },
    physics: { ...basePhysics, gravity: 9.8, maxSpeed: 14, linearDamping: 0.26 },
    decoration: 'clock',
    ballColor: '#fbbf24',
    fogNear: 50,
  },
  prism_fall: {
    id: 'prism_fall',
    name: 'PRISM FALL',
    tagline: 'shattered lightwell',
    briefing:
      'A vertical shaft of broken glass and soft gravity. Long hangs, wide gaps, portal warps across empty air. DASH and boost pads are the only honest bridges.',
    gravityNote: 'GRAVITY: 5.4 m/s² - LONG HANG',
    sky: { top: '#180828', bottom: '#060210', fogColor: '#12061e', fogDensity: 0.011 },
    palette: {
      track: '#2a1840',
      trackSide: '#1a0e2a',
      edge: '#e879f9',
      accent: '#22d3ee',
      hazard: '#fb7185',
      shard: '#f5d0fe',
    },
    physics: {
      ...basePhysics,
      gravity: 5.4,
      maxSpeed: 15.5,
      jumpHeight: 2.8,
      linearDamping: 0.08,
      angularDamping: 1.1,
    },
    decoration: 'prism',
    ballColor: '#e879f9',
    fogNear: 70,
  },
  solar_forge: {
    id: 'solar_forge',
    name: 'SOLAR FORGE',
    tagline: 'starheart foundry',
    briefing:
      'A foundry built inside a dying star. Lava strips, pulse crushers, and heat-haze drag. Conveyors feed the fire; SHIELD and PHASE are the only things between you and ash.',
    gravityNote: 'GRAVITY: 11.2 m/s² - HEAT CRUSH',
    sky: { top: '#2a0a00', bottom: '#100200', fogColor: '#220800', fogDensity: 0.019 },
    palette: {
      track: '#4a2010',
      trackSide: '#2e1408',
      edge: '#f97316',
      accent: '#facc15',
      hazard: '#ff1a00',
      shard: '#fdba74',
    },
    physics: { ...basePhysics, gravity: 11.2, maxSpeed: 14, jumpHeight: 1.85, linearDamping: 0.3 },
    decoration: 'forge',
    ballColor: '#fb923c',
    fogNear: 44,
  },
  null_signal: {
    id: 'null_signal',
    name: 'NULL SIGNAL',
    tagline: 'dead broadcast array',
    briefing:
      'A derelict deep-space antenna farm. Near-void gravity, spinning ring gates, and laser fences. GRAV-ANCHOR, PHASE, and DASH are all on the table - pick wrong and you drift forever.',
    gravityNote: 'GRAVITY: 2.6 m/s² - NEAR VOID',
    sky: { top: '#04040e', bottom: '#000004', fogColor: '#060610', fogDensity: 0.007 },
    palette: {
      track: '#1a1a32',
      trackSide: '#101022',
      edge: '#818cf8',
      accent: '#22d3ee',
      hazard: '#f43f5e',
      shard: '#c7d2fe',
    },
    physics: {
      ...basePhysics,
      gravity: 2.6,
      maxSpeed: 16.5,
      jumpHeight: 3.4,
      linearDamping: 0.04,
      angularDamping: 0.75,
      friction: 0.7,
    },
    decoration: 'signal',
    ballColor: '#818cf8',
    fogNear: 95,
  },
  event_horizon: {
    id: 'event_horizon',
    name: 'EVENT HORIZON',
    tagline: 'the last orbit',
    briefing:
      'The rim of a black hole. Gravity zones flip from feather to crush without warning. Portals, crushers, rings, conveyors - every tool, every threat. This is the end of the map.',
    gravityNote: 'GRAVITY: 2.8 ⇄ 15 m/s² - HORIZON SHIFT',
    sky: { top: '#0c0418', bottom: '#020008', fogColor: '#0a0314', fogDensity: 0.012 },
    palette: {
      track: '#221030',
      trackSide: '#140820',
      edge: '#f0abfc',
      accent: '#22d3ee',
      hazard: '#ef4444',
      shard: '#fae8ff',
    },
    physics: { ...basePhysics, gravity: 9.8, maxSpeed: 15.5, jumpHeight: 2.2 },
    decoration: 'horizon',
    ballColor: '#f0abfc',
    fogNear: 60,
  },
};

/** Campaign unlock order: Act I (0-9) then Act II (10-19). */
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
  'mirror_mere',
  'storm_spire',
  'chrome_yard',
  'glass_bloom',
  'silent_abyss',
  'clockwork_veil',
  'prism_fall',
  'solar_forge',
  'null_signal',
  'event_horizon',
] as const;
