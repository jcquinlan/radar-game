# Radar Game

A browser-based radar-themed survival game built with TypeScript and Canvas 2D. The player navigates an infinite procedural world viewed through a rotating radar display, collecting resources, fighting enemies, and upgrading their ship.

## Quick Reference

```bash
npm run dev          # Vite dev server on http://localhost:3232
npm run build        # TypeScript check + Vite production bundle
npm run test         # Vitest (jsdom environment)
npm run test:watch   # Vitest in watch mode
npm run lint         # (not configured — echoes a no-op)
```

## Tech Stack

- **Language:** TypeScript 5.7 (strict mode, ES2022 target)
- **Bundler:** Vite 6.2 (dev server port 3232)
- **Tests:** Vitest 3.0 with jsdom
- **Rendering:** Canvas 2D API — no frameworks, no sprites, all procedural
- **Dependencies:** Zero runtime dependencies. Only devDependencies: typescript, vite, vitest, jsdom.

## Architecture

### Systems pattern

The game uses a lightweight entity-systems architecture. Entities are plain data objects (interfaces, no behavior). Systems operate on entities each frame. The main loop in `src/main.ts` orchestrates the update/render cycle.

**Update order** (every frame at 60 Hz fixed timestep):

1. `InputSystem` — reads WASD/arrow key state, returns `{dx, dy}` unit vector
2. Player position update — `player.x += dx * speed * dt`
3. `World.updateSpawning()` — lazy-loads 400px chunks in a 5x5 grid around player
4. `RadarDisplay.update()` — advances sweep angle
5. `SweepSystem.update()` — detects entities crossed by sweep line, returns interaction events
6. Event processing — floating text, score, energy collection from sweep events
7. Energy magnet — auto-collects nearby resources if upgrade is active
8. Beacon passive healing — allies with beacon subtype generate energy in range
9. `CombatSystem.update()` — enemy AI (chase/fire), projectile movement, contact damage
10. Shield countdown, screen shake decay
11. Game over check
12. `World.cleanup()` — removes inactive/distant entities

**Render order:**

1. Black background fill
2. Radar circle (rings, crosshair, sweep line with glow trail, scanline overlay)
3. Ambient particles (clipped to radar circle)
4. Entity blips via `BlipRenderer` (color-coded by type)
5. Sweep flash effects
6. Enemy projectiles
7. Floating damage/heal text
8. HUD (health bar, energy, score, kills, distance, threat level)
9. Upgrade panel (right side, toggled with E key)
10. Game over overlay

### Directory layout

```
src/
  main.ts                    # Entry point — init, game loop, update/render orchestration
  canvas.ts                  # Canvas element creation and resize handling
  engine/
    GameLoop.ts              # Fixed timestep loop (60 Hz, 250ms max delta cap)
  entities/
    Entity.ts                # Type definitions (Resource, Enemy, Ally, Projectile) + factory functions
    Player.ts                # Player class — stats, damage/heal/shield/energy methods
  systems/
    InputSystem.ts           # Keyboard input (WASD/arrows), diagonal normalization
    SweepSystem.ts           # Sweep-line entity detection using angle math
    CombatSystem.ts          # Enemy AI behaviors, projectile lifecycle, contact damage
    UpgradeSystem.ts         # 7 upgrades with cost formulas and apply callbacks
  world/
    World.ts                 # Chunk-based spawning, difficulty scaling, entity cleanup
  radar/
    RadarDisplay.ts          # Radar rendering — circle, rings, sweep line, CRT scanlines
    BlipRenderer.ts          # Entity blip rendering — colors, sizes, pulse animations, labels
    SweepEffects.ts          # Expanding flash circles on sweep interactions
    AmbientParticles.ts      # Decorative floating particles inside radar
  ui/
    HUD.ts                   # Health bar, energy, score, kills, distance, threat level
    UpgradePanel.ts          # Right-side upgrade shop (E key toggle, click to buy)
    GameOverScreen.ts        # "SIGNAL LOST" overlay with final stats and restart
    FloatingText.ts          # Rising damage/heal/collection numbers
    ScreenShake.ts           # Camera shake on damage (random offset, 0.15s decay)
```

### Key conventions

- **Factories over constructors** for entities: `createResource()`, `createEnemy()`, `createAlly()` in `Entity.ts`
- **Frame-rate independent**: all movement multiplied by `dt` (seconds)
- **Events, not mutations**: `SweepSystem.update()` returns an array of interaction events; the main loop processes them
- **One sweep per rotation**: `sweptThisRotation` flag on each entity prevents double-interaction until the sweep wraps past 2pi
- **Difficulty scales with distance**: `1 + log2(1 + distFromOrigin / 1000)` — enemies get stronger the further you go from the origin

### Game mechanics summary

**Entities:**
- **Resources** — green blips, 5-15 energy each, collected by sweep or magnet
- **Enemies** — three subtypes:
  - Scout: fast (90 speed), low HP (15), low damage (3), chases aggressively
  - Brute: slow (25 speed), tank (80 HP), heavy damage (12), charges at player
  - Ranged: medium (30 speed), shoots projectiles (8 dmg) every 2.5s from 300px range
- **Allies** — three subtypes:
  - Healer: heals 8-16 HP on sweep (3s cooldown)
  - Shield: applies 50% damage reduction for 5s on sweep
  - Beacon: passively generates 2 energy/sec while player is within 150px

**Upgrades** (7 total, energy currency, purchased via E key panel):

| ID | Max Level | Cost Formula | Effect per Level |
|----|-----------|-------------|------------------|
| sweep_speed | 5 | 20 + lvl*30 | +60% rotation speed |
| sweep_range | 5 | 30 + lvl*40 | +40px radar radius |
| sweep_damage | 5 | 25 + lvl*35 | +8 damage |
| radar_resolution | 3 | 50 + lvl*50 | Shows entity type labels at level 2+ |
| hull_armor | 5 | 35 + lvl*40 | +2 flat damage reduction |
| engine_speed | 5 | 25 + lvl*30 | +15 movement speed |
| energy_magnet | 5 | 40 + lvl*45 | Auto-collect resources within 50+lvl*30 px |

**Damage formula:** `effective = max(0, rawDamage - armor) * (1 - shieldReduction)`

**Scoring:** +energy_value for collecting resources, +50 for enemy kills

## Testing

Tests live next to their source files (`*.test.ts`). The test suite uses Vitest with jsdom for Canvas/DOM APIs.

```bash
npm run test         # Run once
npm run test:watch   # Watch mode
```

**Test patterns used:**
- Factory functions return entities with expected properties
- Systems are tested with deterministic inputs (mock entities, explicit dt values)
- `performance.now()` and `requestAnimationFrame` are spied for game loop tests
- Tests are behavioral — they assert on outputs and state changes, not implementation structure

## Commit Convention

Commits follow the pattern: `prd-NNN: <description>` for features, `review:` / `fix:` / `qa:` / `chore:` for other work. The codebase was built incrementally from prd-001 (Vite setup) through prd-015 (score system).

## Development Notes

- The game has no linter configured — `npm run lint` is a no-op
- All rendering is procedural (no sprite sheets, no image assets, no audio)
- The `index.html` contains a single `<canvas id="game-canvas">` element
- The main branch is empty; all code lives on `autopilot/programmable-radar-game`
- World chunks are 400px squares; the game loads a 5x5 grid around the player and cleans up entities beyond 2000px
