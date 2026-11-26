# SKYLANE — Island Ring Runner

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/nelsenwiliam/skylane/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/nelsenwiliam/skylane/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

Entry for the [make.fun "Make the best flight game" bounty](https://make.fun/bounty/best-flight-game-20261126-0057).

A 3D arcade flight game that runs from static files in any desktop browser.
One prop plane, one procedural island, three ways to fly it.

## Play

Serve `game/` with any static server, then open it in desktop Chrome:

```sh
node serve.ts
# http://localhost:8080
```

No network needed — every script, texture and sound is a file under `game/`
or synthesised at run time (three.js is vendored as `game/vendor/three.min.js`).

## Missions

1. **Ring Run** — fly all 10 glowing rings over the island, in order, before the clock runs out.
2. **Landing** — short final onto runway 09. Slow, centred, gentle.
3. **Time Trial** — 90 seconds, rings keep appearing ahead. Grab all you can.

Fuel drains with throttle and damage builds on hard impacts, so every sortie
is a decision: push for the next ring or save enough to get home.

## Controls

| Key | Action |
| --- | --- |
| W / S (or Shift / Ctrl) | Throttle up / down |
| A / D or ← / → | Bank (turn) |
| ↑ / ↓ | Pitch |
| C | Chase / cockpit camera |
| P | Pause |
| R | Restart mission |
| M | Mute |

## Layout

- `main.ts` — the make.fun entry program: copies `game/` + `screenshots/` to `/output` and writes `dossier.json`.
- `game/index.html` — page + HUD.
- `game/src/` — one file per job: `config` (tuning), `terrain` (procedural island), `aircraft` (the plane), `physics` (flight model), `rings` (missions), `hud` (instruments), `audio` (synth sounds), `input`, `camera`, `shots` (screenshot presets), `main` (game loop).
- `game/vendor/three.min.js` — vendored three.js r160.
- `screenshots/` — the four entry screenshots, rendered by the game itself.

## License

MIT — see `LICENSE`.
