<p align="center">
  <img src="https://img.shields.io/badge/ORBITAL-one%20ball%20%C2%B7%20twenty%20worlds%20%C2%B7%20no%20mercy-22d3ee?style=for-the-badge&labelColor=050807" alt="ORBITAL" />
</p>

<h1 align="center">O R B I T A L</h1>

<p align="center">
  <b>A neon physics runner across twenty worlds with shifting gravity.</b><br/>
  Roll. Jump. Survive. Live at <a href="https://5432wire.com/orbital">5432wire.com/orbital</a>.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/three.js-render-black?logo=threedotjs" />
  <img src="https://img.shields.io/badge/rapier-physics%20(WASM)-blue" />
  <img src="https://img.shields.io/badge/react%20router%207-host-61dafb?logo=react" />
  <img src="https://img.shields.io/badge/levels-20%20worlds-a78bfa" />
  <img src="https://img.shields.io/badge/mobile-tilt%20%2B%20edge%20controls-4ade80" />
  <img src="https://img.shields.io/badge/license-MIT-green" />
</p>

---

## What it is

ORBITAL is the web-native rebirth of the original Unity **Rolla-Ball-Game** (preserved on the [`legacy/unity`](../../tree/legacy/unity) branch). One ball, twenty hand-authored worlds across two acts, and a physics engine (Rapier, compiled to WASM) that changes the rules of the universe under you - gravity, friction, damping, and drag all shift per world.

It ships as a route inside the [5432wire](https://github.com/thatdudealso/5432wire) frontend (`frontend/app/orbital`), deployed to S3 + CloudFront, with progress persisted to the site's FastAPI/RDS backend over AWS Cognito auth. This repo is the game's brand home and canonical source mirror.

## The twenty worlds

Act I teaches the fundamentals one mechanic at a time; Act II remixes everything with longer tracks and three new power-ups (PHASE, DASH, ECHO) on top of Act I's BOOST/SHIELD/MAGNET/SLOW-MO/GRAV-ANCHOR.

### Act I - the fundamentals (01-10)

| # | World | Gravity | The twist |
|---|-------|---------|-----------|
| 01 | **GRID ZERO** | 9.8 | Baseline Earth. Tutorial construct. |
| 02 | **DUNE SEA** | 9.8 | Sand drag kills momentum; wind shoves sideways. |
| 03 | **NEON CITY** | 9.8 | Rooftop gaps, traffic platforms, thin beams. |
| 04 | **TIDE BREAK** | 7.8 | Floaty arcs; water drag pools kill momentum; geysers launch you mid-air. |
| 05 | **SUMMIT PASS** | 8.6 | Thin air, ice sheets, crumbling tiles. |
| 06 | **VOID STATION** | 3.2 | LOW-G. Mega jumps, inertia is king. |
| 07 | **MAGMA RIFT** | 9.8 | Lava kills. Geysers launch you. Basalt collapses. |
| 08 | **CRYO DRIFT** | 9.8 | Near-zero friction. Steering, not stopping. |
| 09 | **OVERGROWTH** | 9.8 | Bounce ecology, pendulum vines, half-pipes. |
| 10 | **THE CORE** | 3.2 ⇄ 12 | Gravity SHIFT zones. Everything, everywhere. |

### Act II - the remix (11-20)

| # | World | Gravity | The twist |
|---|-------|---------|-----------|
| 11 | **MIRROR MERE** | 9.5 | Timing trial: beat-synced gates, spinning rings. PHASE ghosts through hazards. |
| 12 | **STORM SPIRE** | 10.4 | Conveyors shove you forward; crosswinds never stop; heavy air shortens jumps. |
| 13 | **CHROME YARD** | 9.8 | Crushers on a brutal clock, tipping seesaws. DASH punches through closing gaps. |
| 14 | **GLASS BLOOM** | 8.9 | Portal pairs, slick glass decks. ECHO pulls shards from a wide radius. |
| 15 | **SILENT ABYSS** | 14.2 | Crush gravity, drag pools, narrow decks - short jumps, hard landings. |
| 16 | **CLOCKWORK VEIL** | 9.8 | Interlocking gates, rings, and crushers on one rhythm. PHASE covers one mistake. |
| 17 | **PRISM FALL** | 5.4 | Long low-g hangs over wide voids. DASH and portals are the only bridges. |
| 18 | **SOLAR FORGE** | 11.2 | Lava, stacked crushers and hazards. SHIELD buys a mistake, conveyors feed the fire. |
| 19 | **NULL SIGNAL** | 2.6 | Near-void gravity, ring gates, laser fences. ANCHOR, PHASE, and DASH all in play. |
| 20 | **EVENT HORIZON** | 2.8 ⇄ 15 | Finale: gravity flips without warning, every mechanic and power-up at once. |

Every world opens with a cinematic flythrough + terrain/gravity briefing, and ends in a slow-mo orbit with your stats: time vs par, deaths, shards.

## Controls

**Desktop** - `WASD` / arrows to roll (hold longer = faster, release to coast, pull back to brake), `SPACE` to jump, `ESC`/`P` to pause.

**Mobile** - two modes, your choice, persisted per device:

- **TILT** (default): gyro zeroed at countdown. Tilt left/right steers, tilt forward accelerates, tilt back brakes. Tap anywhere = jump. Android works instantly; iOS gets a one-tap motion permission.
- **EDGE CONTROLS**: hold the screen edges - `TOP` gas, `BOTTOM` brake, long `LEFT`/`RIGHT` strips steer. Tap anywhere = jump. The center of the screen stays 100% track.

## Game systems

- **Realistic physics** - Rapier rigid-body sim at a fixed 60Hz: rolling friction, restitution, kinematic obstacles with true contact velocities, sensor-driven events.
- **Checkpoints** - glow gates every few segments. Respawn is instant, but the timer never stops and deaths go on your record.
- **Power-ups** - BOOST, SHIELD, MAGNET, SLOW-MO, GRAV-ANCHOR (Act I), plus PHASE, DASH, ECHO (Act II) - placed before the obstacle that needs them.
- **Shards** - optional collectibles on risky lines for bragging rights.
- **RANDOM RUN** - endless login-only mode: a seeded generator stitches segment templates into a track at a random world with random difficulty. Never the same twice.
- **Progression** - 20-level campaign (Act I + Act II) unlocks sequentially; per-level best times, deaths, and shards, plus random-run counts and best times, sync to your account and follow you across devices.

## Repo layout

```
src/            The game module (mirrors frontend/app/orbital in 5432wire)
  engine/       renderer, physics, camera, input, particles, audio, quality
  game/         biomes, levels, segments, obstacles, track, generator, save
  ui/           HUD, briefing, menus, level select, edge controls
routes/         React Router 7 route files (lobby + game host)
```

## Architecture

```
React Router 7 (S3 + CloudFront)
  └─ /orbital            lobby: level select + random run (Cognito-gated)
  └─ /orbital/play       canvas host, lazy-loads the engine
       └─ three.js render + Rapier WASM physics (fixed 60Hz)
       └─ events → React HUD/menus
FastAPI (ECS Fargate)
  └─ GET/PUT /api/v1/game/progress → RDS Postgres game_progress
```

No dedicated game infrastructure: the game rides the existing frontend build and backend service.

## Development

The game lives and runs inside the 5432wire monorepo - see the [5432wire repo](https://github.com/thatdudealso/5432wire) for the full stack.

```bash
cd frontend && npm install && npm run dev
# http://localhost:3000/orbital
```

## Contributing

Bug reports, level ideas, and PRs are welcome. This repo is a source mirror (no build/test tooling lives here) - see [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, how to verify a change, code style, and the PR process.

## License

MIT - see [LICENSE](LICENSE).

---

<p align="center">
  <sub>ORBITAL · a 5432wire production · one ball, twenty worlds, no mercy</sub>
</p>
