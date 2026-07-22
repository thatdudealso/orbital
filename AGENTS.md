# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- This repo is a **source mirror only**: `src/orbital/` and `routes/` hold the ORBITAL game module's TypeScript/React/Three.js/Rapier source, but there is no `package.json`, build config, test runner, or lockfile here. The game actually runs as a route inside the [5432wire](https://github.com/thatdudealso/5432wire) frontend at `frontend/app/orbital` - `routes/*.tsx` import paths are written relative to that location, not this repo. To build/run/test a change, mirror the edited files into a 5432wire checkout. See `CONTRIBUTING.md`.
- The levels/worlds are code-authoritative in `src/orbital/game/levels.ts` (campaign order + per-level segments/tips) and `src/orbital/game/biomes.ts` (name, gravity, tagline/briefing, palette) - currently 20 levels across Act I (indices 0-9) and Act II (indices 10-19). `src/orbital/ui/level-select.tsx` just renders those two. If the README's "worlds" tables and this code ever disagree, the code wins - update the README, not the other way around. `src/orbital` is synced from `projects/5432wire/frontend/app/orbital` (prod source of truth); re-sync rather than hand-editing drift away.
- Licensed MIT (see `LICENSE`), copyright thatdudealso.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
