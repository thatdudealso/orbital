# Contributing to ORBITAL

Thanks for looking at ORBITAL. Read this before opening a PR - the repo layout here is a little unusual.

## What this repo is (and isn't)

This repo is the **canonical source mirror** for the ORBITAL game module. It holds only the game's TypeScript/React/Three.js source (`src/orbital/` and `routes/`) - there is no `package.json`, build config, or test runner here, because the game doesn't run standalone. It ships as a route inside the [5432wire](https://github.com/thatdudealso/5432wire) frontend, at `frontend/app/orbital`, and `routes/` mirrors `frontend/app/orbital/routes` in that monorepo (import paths in those files are written relative to that location, not this repo).

Practically, this means:

- You can read, edit, and review game logic here.
- To actually **run, build, or test** a change, you need a local checkout of [5432wire](https://github.com/thatdudealso/5432wire) with this game module's files in place at `frontend/app/orbital`.
- Bigger changes usually want a companion PR (or a synced copy of the files) in 5432wire so the change can be verified end-to-end. If you're unsure how your change should land in both places, say so in your PR description and a maintainer will help route it.

## Dev setup

```bash
git clone https://github.com/thatdudealso/5432wire.git
cd 5432wire/frontend
npm install
npm run dev
# http://localhost:3000/orbital
```

Copy or symlink your edited files from `src/orbital/` and `routes/` in this repo into the corresponding paths under `frontend/app/orbital/` in your 5432wire checkout, then reload the dev server.

## Build & test

There's no automated test suite for the game module today. Verify changes by hand:

- Run the game via the 5432wire frontend dev server (see above) and playtest the level(s) or system you touched, on desktop and, if the change touches controls/camera/UI, on a mobile viewport too (TILT and EDGE CONTROLS both).
- Run whatever TypeScript typecheck/lint scripts are defined in 5432wire's `frontend/package.json` against your changed files - the game module is plain TypeScript and should pass the monorepo's existing checks without special-casing.
- If you touch physics tuning (`src/orbital/game/biomes.ts`, `ball.ts`) or a level (`src/orbital/game/levels.ts`), play the affected level start-to-finish, including all checkpoints and the goal.

## Code style

Match what's already here:

- TypeScript, 2-space indent, single quotes, semicolons, named exports (no default exports).
- Discriminated unions (`kind: '...'`) for segment and obstacle specs - see `src/orbital/game/segments.ts` and `obstacles.ts` for the pattern.
- Level and biome data are plain data tables (`levels.ts`, `biomes.ts`), not classes - new levels/biomes should follow that shape.
- Keep gameplay tuning (gravity, friction, speeds) inside the relevant `biomes.ts` entry rather than hardcoding it in engine/obstacle code.
- Comments are sparse and explain *why*, not *what* - keep new code consistent with that.

## Filing issues

Open a GitHub issue with:

- **Bug reports**: which world/level, desktop or mobile (and which control mode), steps to reproduce, expected vs. actual behavior. Screenshots or a screen recording help a lot for physics/visual bugs.
- **Feature requests**: the player-facing problem you're trying to solve, not just the mechanic you have in mind - it's easier to evaluate against the existing biome/level design.

## Pull requests

- Base branch is `master`.
- Use a short, descriptive branch name prefixed by type, e.g. `fix/tide-break-geyser-timing`, `feat/new-biome-cavern`, `docs/readme-levels`.
- Keep PRs scoped to one change (one level, one system, one bug) where possible - it makes review and in-browser verification tractable.
- Describe what you tested and how (which level(s), desktop/mobile) in the PR description, since there's no CI test suite to lean on here.
- If your change needs a corresponding update in the 5432wire monorepo (route wiring, backend API, deploy config), link that PR too.
