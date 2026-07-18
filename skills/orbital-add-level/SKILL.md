---
name: orbital-add-level
description: Add a new level or biome to ORBITAL (the 5432wire web game). Use when the user wants a new world, a new biome, physics retuning of a world, or new segment/obstacle types. Covers the segment vocabulary, biome physics presets, level registration, and validation.
---

# ORBITAL: Add / Tune Levels

ORBITAL lives in `frontend/app/orbital/`. Campaign content is data, not engine code. You almost never need to touch the engine - only the content files.

## Where things live

| File | What it owns |
|---|---|
| `game/biomes.ts` | The 10 biome definitions: sky, palette, physics preset, decoration kind |
| `game/levels.ts` | The 10 campaign levels: biome ref, tips, par time, segment list |
| `game/segments.ts` | Segment builders + `SegmentSpec` union (the track vocabulary) |
| `game/obstacles.ts` | Obstacle/pickup/zone spawners used by segments |
| `game/generator.ts` | Random Run pools - update if new segment kinds should appear there |
| `game/decorations.ts` | Per-biome scenery scatter |

## Add a level (recipe)

1. Pick or create a biome in `game/biomes.ts`. A biome needs: `id`, `name`, `tagline`, `briefing` (shown in the intro cutscene - always states the terrain AND the gravity change), `gravityNote` (e.g. `"GRAVITY: 7.8 m/s² - FLOATY ARC"`), `sky` (top/bottom/fog), `palette`, `physics` (gravity, accel, maxSpeed, jumpHeight, friction, restitution, linearDamping, angularDamping, trackFriction), `decoration` kind, `ballColor`, `fogNear`.
2. Append a `LevelDef` to `LEVELS` in `game/levels.ts` with a segment list. Rules of good track design:
   - Open with a safe `{ kind: 'platform', length: 10+ }` so the player settles in.
   - Introduce ONE new mechanic per level, remix earlier ones later.
   - `{ kind: 'checkpoint' }` every 3-5 segments - never adjacent (anti-abuse: the timer never stops, deaths are recorded).
   - Place `{ kind: 'powerup' }` right before the obstacle that needs it.
   - Shard lines (`{ kind: 'shards', pattern: 'line'|'arc'|'ring' }`) go on RISKY lines, not the main path.
   - Always end with `{ kind: 'goal' }`.
   - `parTimeSec`: estimate total length / 8.5 m/s, then add ~15% for deaths. Playtest and adjust.
3. Update `BIOME_ORDER` in `biomes.ts` if the campaign order changes. Index in `LEVELS` = unlock order (level N unlocks when N-1 is completed).

## Segment vocabulary (SegmentSpec)

`platform{length,width?,dy?,rails?}` `gap{length}` `narrow{length,width}` `ramp{length,rise}` `curve{angle,radius,dir:1|-1,width?,bank?}` `halfpipe{length,width?}` `checkpoint` `spinners{length,count,speed?}` `sweepers{length,count,speed?}` `pistons{length,count,speed?}` `movers{count,spacing?,axis:'x'|'y',distance?,speed?}` `falling{length,tile?}` `lasers{length,count,period?}` `wind{length,dirX:1|-1,strength?}` `dragZone{length,strength?}` `slickZone{length,width?}` `gravityZone{length,gravity}` `hazards{length,count}` `bounces{count,spacing?,power?}` `boosts{count,spacing?}` `shards{pattern,over?}` `powerup{power}` `goal`

Gap feasibility sanity: jump distance ~= 2 * sqrt(2*jumpHeight/gravity) * maxSpeed * 0.8. At earth gravity (9.8, jumpHeight 2.1, maxSpeed 14) that's ~9m; keep casual gaps <= 5m, hard gaps <= 7m. Scale by biome gravity (low-g allows much bigger gaps).

## Add a new segment kind

Only if the vocabulary truly can't express it: add the `SegmentSpec` variant in `segments.ts`, add its builder in the `buildSegment` switch, put reusable machinery in `obstacles.ts`, then add it to `generator.ts` pools if Random Run should use it. Keep colliders EXACTLY matching visuals (players feel mismatches instantly). Then update this skill's vocabulary table above.

## Physics retuning rules

- Ball feel lives in the biome preset: `linearDamping` ~0.2 snappy, ~0.5 heavy/sandy, ~0.05 icy/floaty.
- `trackFriction` 0.95 grippy, 0.12 ice. `friction` on the ball mirrors that.
- Never tune per-level; tune per-biome so all levels in a world feel related.
- After ANY physics change: playtest the level start-to-finish (see orbital-playtest skill) - a gap that was fair at 9.8 may be impossible at 8.6.

## Validate

1. `cd frontend && npx tsc` - must pass.
2. Boot dev server, play the level start-to-finish in a real browser (orbital-playtest skill). Verify: briefing card text matches the biome, checkpoints are not adjacent, the goal is reachable, par is beatable with 1-2 deaths.
