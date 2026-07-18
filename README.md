<p align="center">
  <img src="https://img.shields.io/badge/ORBITAL-one%20ball%20%C2%B7%20ten%20worlds%20%C2%B7%20no%20mercy-22d3ee?style=for-the-badge&labelColor=050807" alt="ORBITAL" />
</p>

<h1 align="center">O R B I T A L</h1>

<p align="center">
  <b>A neon physics runner across ten worlds with shifting gravity.</b><br/>
  Roll. Jump. Survive. Live at <a href="https://5432wire.com/orbital">5432wire.com/orbital</a>.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/three.js-render-black?logo=threedotjs" />
  <img src="https://img.shields.io/badge/rapier-physics%20(WASM)-blue" />
  <img src="https://img.shields.io/badge/react%20router%207-host-61dafb?logo=react" />
  <img src="https://img.shields.io/badge/levels-10%20worlds-a78bfa" />
  <img src="https://img.shields.io/badge/mobile-tilt%20%2B%20edge%20controls-4ade80" />
</p>

---

## What it is

ORBITAL is the web-native rebirth of the original Unity **Rolla-Ball-Game** (preserved on the [`legacy/unity`](../../tree/legacy/unity) branch). One ball, ten hand-authored worlds, and a physics engine (Rapier, compiled to WASM) that changes the rules of the universe under you - gravity, friction, damping, and drag all shift per world.

It ships as a route inside the [5432wire](https://github.com/thatdudealso/5432wire) frontend (`frontend/app/orbital`), deployed to S3 + CloudFront, with progress persisted to the site's FastAPI/RDS backend over AWS Cognito auth. This repo is the game's brand home and canonical source mirror.

## The ten worlds

| # | World | Gravity | The twist |
|---|-------|---------|-----------|
| 01 | **GRID ZERO** | 9.8 | Baseline Earth. Tutorial construct. |
| 02 | **DUNE SEA** | 9.8 | Sand drag kills momentum; wind shoves sideways. |
| 03 | **NEON CITY** | 9.8 | Rooftop gaps, traffic platforms, piston billboards. |
| 04 | **TIDE BREAK** | 7.8 | Floaty arcs; water drag pools; bobbing pontoons. |
| 05 | **SUMMIT PASS** | 8.6 | Thin air, ice sheets, crumbling tiles. |
| 06 | **VOID STATION** | 3.2 | LOW-G. Mega jumps, inertia is king. |
| 07 | **MAGMA RIFT** | 9.8 | Lava kills. Geysers launch you. Basalt collapses. |
| 08 | **CRYO DRIFT** | 9.8 | Near-zero friction. Steering, not stopping. |
| 09 | **OVERGROWTH** | 9.8 | Bounce ecology, pendulum vines, half-pipes. |
| 10 | **THE CORE** | 3.2 ⇄ 12 | Gravity SHIFT zones. Everything, everywhere. |

Every world opens with a cinematic flythrough + terrain/gravity briefing, and ends in a slow-mo orbit with your stats: time vs par, deaths, shards.

## Controls

**Desktop** - `WASD` / arrows to roll (hold longer = faster, release to coast, pull back to brake), `SPACE` to jump, `ESC`/`P` to pause.

**Mobile** - two modes, your choice, persisted per device:

- **TILT** (default): gyro zeroed at countdown. Tilt left/right steers, tilt forward accelerates, tilt back brakes. Tap anywhere = jump. Android works instantly; iOS gets a one-tap motion permission.
- **EDGE CONTROLS**: hold the screen edges - `TOP` gas, `BOTTOM` brake, long `LEFT`/`RIGHT` strips steer. Tap anywhere = jump. The center of the screen stays 100% track.

## Game systems

- **Realistic physics** - Rapier rigid-body sim at a fixed 60Hz: rolling friction, restitution, kinematic obstacles with true contact velocities, sensor-driven events.
- **Checkpoints** - glow gates every few segments. Respawn is instant, but the timer never stops and deaths go on your record.
- **Power-ups** - BOOST, SHIELD, MAGNET, SLOW-MO, GRAV-ANCHOR, placed before the obstacle that needs them.
- **Shards** - optional collectibles on risky lines for bragging rights.
- **RANDOM RUN** - endless login-only mode: a seeded generator stitches segment templates into a track at a random world with random difficulty. Never the same twice.
- **Progression** - 10-level campaign unlocks sequentially; per-level best times, deaths, and shards sync to your account and follow you across devices.

## Repo layout

```
src/            The game module (mirrors frontend/app/orbital in 5432wire)
  engine/       renderer, physics, camera, input, particles, audio, quality
  game/         biomes, levels, segments, obstacles, track, generator, save
  ui/           HUD, briefing, menus, level select, edge controls
routes/         React Router 7 route files (lobby + game host)
skills/         Agent skills: orbital-add-level, orbital-playtest
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

The game lives and runs inside the 5432wire monorepo - see the [5432wire repo](https://github.com/thatdudealso/5432wire) for the full stack. Agent-facing skills in `skills/` document how to add levels/biomes and how to playtest in a real browser.

```bash
cd frontend && npm install && npm run dev
# http://localhost:3000/orbital
```

---

<p align="center">
  <sub>ORBITAL · a 5432wire production · one ball, ten worlds, no mercy</sub>
</p>
