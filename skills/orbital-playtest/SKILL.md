---
name: orbital-playtest
description: Boot ORBITAL locally and playtest it end-to-end in a real browser - verify the game boots, the ball rolls and jumps, checkpoints/respawn work, HUD updates, and screenshot for visual review. Use after changing engine, levels, biomes, physics, or UI.
---

# ORBITAL: Playtest Protocol

Real-browser E2E for the game. Use `chromium-cli`/`chrome-devtools-axi` (preinstalled); never install Playwright ad hoc.

## 1. Boot

```bash
cd frontend && npm run dev   # http://localhost:3000
```

The game is login-gated. For local E2E without a backend, inject a dev JWT into localStorage (auth-context parses it client-side; progress falls back to localStorage when the API is unreachable - that is by design):

```js
const p = btoa(JSON.stringify({'cognito:username':'e2e_pilot',email:'e2e@5432wire.com',sub:'e2e'})).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const t = 'x.'+p+'.y'; localStorage.setItem('auth_token', t); localStorage.setItem('access_token', t);
```

## 2. Drive the browser

```bash
chrome-devtools-axi open "http://localhost:3000/orbital"          # lobby: expect ORBITAL wordmark + LOGIN TO PLAY when logged out
# inject the JWT above via chrome-devtools-axi eval, then:
chrome-devtools-axi open "http://localhost:3000/orbital/play?level=0"
chrome-devtools-axi screenshot /tmp/orbital-<level>.png
```

Hold a key to roll:

```js
const kd = (k) => window.dispatchEvent(new KeyboardEvent('keydown', {key: k, bubbles: true}));
kd('w'); window.__hold = setInterval(() => kd('w'), 100);        // roll forward
// jump: kd(' ')
// stop: clearInterval(window.__hold); dispatch keyup
```

## 3. What to verify (checklist)

- Boot: canvas mounts, no console errors, `BUILDING WORLD` loader clears.
- Briefing: card shows world name + GRAVITY note + tips; any key skips it; 3-2-1-GO countdown fires.
- Roll: holding W raises the HUD speedometer (M/S) and the ball visibly rolls; camera follows smoothly.
- Jump: SPACE lifts the ball when grounded only.
- Shards: HUD shard counter increments on pickup; sparkle burst plays.
- Checkpoints: crossing a gate toasts CHECKPOINT x/y and turns it green; dying (drive off the edge) respawns at the LAST gate, deaths+1, timer keeps running.
- Goal: crossing the ring triggers slow-mo orbit + victory stats panel (time vs par, deaths, shards) + NEXT WORLD unlocks on the lobby grid.
- Random Run: `/orbital/play?mode=random` boots a generated track; two launches differ.
- Pause: ESC/P pauses; resume/restart/quit all work.
- Visual: screenshot and LOOK at it - glow edges visible, sky/fog match the biome, no z-fighting, HUD not overlapping buttons.
- Performance: no long freezes on level load on a mid laptop; mobile UA + narrow viewport boots without layout breakage.

## 4. Common breakpoints

- Ball falls through decks -> collider mismatch: check `addDeck` pitch/bank math in `segments.ts`.
- Ball never grounds after respawn -> `killY` too high or respawn point under the deck: check `track.ts` minY + checkpoint respawn (+1.2 up).
- Cutscene camera inside geometry -> `buildIntroPath` elevation too low: raise the +5.2 offset in `cutscene.ts`.
- WASM never loads -> Rapier init failed: `@dimforge/rapier3d-compat` must stay the `-compat` (base64 wasm) build.
- HUD dead but game runs -> emitter wiring: check the events.on() subscriptions in `routes/orbital.play.tsx`.
