# Radar Game

A browser-based radar-themed survival game built with TypeScript and Canvas 2D. The player navigates an infinite procedural world viewed through an expanding radar ping, collecting resources, fighting enemies, towing salvage to dropoff points, and upgrading their ship.

## Indie Dev Philosophy

This is a solo/small-team indie game. Every decision should optimize for **shipping playable builds fast** and **keeping the codebase small enough to hold in one person's head.** Guard against scope creep and over-architecture relentlessly.

### Core Principles

1. **Gameplay first, code second.** A janky feature that's fun beats a clean abstraction nobody plays. Always ask: "does this make the game more fun?" If the answer is "no, but it's cleaner code," it's not a priority.

2. **Finish, don't polish prematurely.** Resist the urge to refactor working systems before the game has all its core loops. Refactoring is earned by shipping — if a system works and isn't blocking new features, leave it alone.

3. **Scope is the enemy.** Before adding any feature, ask: "is this in the critical path to a playable, fun game?" New entity types, new abilities, new upgrade tiers — each one adds testing surface, balance complexity, and rendering work. Be ruthless about saying "not yet."

4. **Playtest constantly.** After any gameplay change, play the game for 30+ seconds to feel the change. Numbers in code don't tell you if something feels good — only playing does.

5. **One file should do one thing.** If a file is doing two unrelated jobs, split it. If two files are doing the same job, merge them. But don't split a file just because it's long — split it because its responsibilities are distinct.

### What "Simple" Means Here

- Flat data structures over nested hierarchies
- Functions over classes (except Player, which is a genuine singleton with state)
- Arrays and linear iteration over spatial data structures — until profiling proves otherwise
- Direct property access over getters/setters unless access control is genuinely needed
- Hardcoded constants in the file that uses them, not a shared config — until the same value appears in 3+ places

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
- **Rendering:** Canvas 2D API + optional WebGL2 post-processing (bloom + damage distortion shaders)
- **Dependencies:** Zero runtime dependencies. Only devDependencies: typescript, vite, vitest, jsdom.

**Keep it zero-dep.** Do not add runtime dependencies. This game runs on Canvas 2D and math. If you think you need a library, you almost certainly don't — write the 20 lines of code instead.

## Architecture

### Systems pattern

The game uses a lightweight entity-systems architecture. Entities are plain data objects (interfaces, no behavior). Systems operate on entities each frame. The main loop in `src/main.ts` orchestrates the update/render cycle.

**This is not a full ECS framework and should not become one.** There is no component registry, no entity manager, no system scheduler. Systems are just functions/classes that take entity arrays and dt. This is intentional — the overhead of a "real" ECS is not justified at this scale.

**Update order** (every frame at 60 Hz fixed timestep):

1. `InputSystem` — reads WASD/arrow key state, returns `{turn, thrust}` for tank-style controls
2. Player turn + thrust — applies turn inertia (`turnVelocity *= exp(-turnFriction * dt)`), accelerates along heading
3. `World.updateSpawning()` — lazy-loads 400px chunks in a 5x5 grid around player, places POIs or ambient entities
4. Blip, particle, HUD updates
5. `PingSystem.update()` — fires expanding detection circle, returns interaction events on contact
6. Event processing — floating text, score, energy collection from ping events
7. Energy magnet — auto-collects nearby resources if upgrade is active
8. `TowRopeSystem.checkPickups()` — detects salvage within pickup radius (25px), attaches to player
9. `TowRopeSystem.update()` — spring physics for towed salvage items
10. `TowRopeSystem.checkDropoffs()` — checks if towed salvage entered a dropoff zone, awards energy
11. Shield countdown, beacon passive energy generation
12. `AbilitySystem.update()` — cooldown decrements, HoT healing, drone AI
13. `CombatSystem.update()` — enemy AI (chase/fire), projectile movement, contact damage
14. Motion trail tracking (player, enemies, projectiles, drones)
15. Screen shake + damage flash on damage
16. Game over check
17. `World.cleanup()` — removes inactive/distant entities (preserves towed salvage)

**Render order:**

1. Black background fill
2. Radar display (rings, crosshair, ping circle, scanlines — fixed to screen)
3. Rotated world layer (canvas transform: `-player.heading - π/2`):
   - Ambient particles (deep layer)
   - Motion trails (velocity streaks behind fast entities)
   - Dropoff zones (pulsing gold rings with center diamond marker)
   - Tow ropes (amber bezier curves from player to each salvage item)
   - Towed salvage blips (amber diamond shapes)
   - Entity blips via `BlipRenderer` (color-coded by type)
   - Sweep flash effects
   - Ability visual effects (blast ring, regen glow, drone spawn flash)
   - Enemy projectiles (red circles with glow)
   - Helper drones (cyan circles)
   - Floating damage/heal/collection text (counter-rotated to stay upright)
   - Ambient particles (foreground layer)
4. Ping range vignette (subtle darkening outside radar ring)
5. Player heading indicator (green triangle at screen center)
6. Damage flash vignette (red overlay on hit)
7. HUD (health bar, energy, score, kills, distance, time, threat level, coordinates)
8. Ability bar (bottom center, cooldown timers and keybind labels)
9. Upgrade panel (right side, toggled with E key — remappable)
10. Game over overlay
11. Key remap screen (modal overlay, toggled with K key)
12. Pause menu (Escape key)
13. Post-processing shader pass (bloom glow + damage distortion, toggleable)

### Directory layout

```
src/
  main.ts                    # Entry point — init, game loop, update/render orchestration
  canvas.ts                  # Canvas element creation and resize handling
  engine/
    GameLoop.ts              # Fixed timestep loop (60 Hz, 250ms max delta cap)
  entities/
    Entity.ts                # Type definitions (Resource, Enemy, Ally, Salvage, Dropoff, Projectile) + factory functions
    Player.ts                # Player class — stats, damage/heal/shield/energy methods
  systems/
    InputSystem.ts           # Keyboard input — tank-style controls (A/D turn, W/S thrust)
    PingSystem.ts            # Expanding circle detection — fires every ~1.5s, interacts with entities on contact
    CombatSystem.ts          # Enemy AI behaviors, projectile lifecycle, contact damage
    UpgradeSystem.ts         # 7 upgrades with cost formulas and apply callbacks
    AbilitySystem.ts         # 4 cooldown abilities — blast, heal over time, helper drone, dash
    TowRopeSystem.ts         # Salvage towing — spring physics, proximity pickup, dropoff deposit
  world/
    World.ts                 # Chunk-based spawning via POI system, difficulty scaling, entity cleanup
    POIGenerator.ts          # POI type definitions, corridor detection, weighted selection, resource veins
  radar/
    RadarDisplay.ts          # Radar rendering — circle, rings, ping circle, scanlines
    BlipRenderer.ts          # Entity blip rendering — colors, sizes, pulse animations, labels
    SweepEffects.ts          # Expanding flash circles on ping interactions
    AbilityEffects.ts        # Blast ring, regen glow, drone spawn flash
    AmbientParticles.ts      # Decorative floating particles inside radar
    MotionTrail.ts           # Velocity-based motion streaks behind fast-moving entities
  rendering/
    ShaderPipeline.ts        # WebGL2 multi-pass post-processing pipeline (reads Canvas 2D as texture, ping-pong FBOs)
    ShaderEffect.ts          # ShaderEffect interface + compile/link helpers
    effects/
      BloomEffect.ts         # Bloom/glow — brightness threshold + 13-tap star blur + additive composite
      DamageDistortionEffect.ts  # On-damage chromatic aberration + barrel warp + noise (driven by damageFlash)
  ui/
    HUD.ts                   # Health bar, energy, score, kills, distance, time, threat level, coordinates
    UpgradePanel.ts          # Right-side upgrade shop (E key toggle, click to buy)
    GameOverScreen.ts        # "SIGNAL LOST" overlay with final stats and restart
    FloatingText.ts          # Rising damage/heal/collection numbers
    ScreenShake.ts           # Camera shake on damage (random offset, 0.15s decay)
    AbilityBar.ts            # Bottom-center ability slots with cooldown timers and keybind labels
    KeyRemapScreen.ts        # K key toggle — rebind ability keys and upgrades key, persists to localStorage
    PauseMenu.ts             # Escape key — pause/resume, restart, toggle shaders, open keybinds
```

### Post-processing shader pipeline

The game uses an optional WebGL2 overlay canvas for post-processing effects. The pipeline reads the completed Canvas 2D frame as a texture and applies shader effects in sequence.

**Architecture:**
- `ShaderPipeline` creates a WebGL2 canvas layered on top of the 2D canvas (`pointer-events: none`)
- Effects implement the `ShaderEffect` interface: `init()`, `getFragmentSource()`, `setUniforms()`, `dispose()`
- Multi-pass rendering uses ping-pong framebuffers — each effect reads the previous output, last effect renders to screen
- The pipeline auto-sets a `uFlipY` uniform: `1.0` for the first effect (canvas texture has inverted Y vs WebGL), `0.0` for subsequent effects (FBO textures are already in WebGL coordinates)
- If WebGL2 is unavailable, `ShaderPipeline.create()` returns `null` and the game runs without post-processing

**Current effects (render order):**

| Effect | File | What it does | Key config |
|--------|------|-------------|------------|
| Bloom | `BloomEffect.ts` | Extracts bright pixels above luminance threshold, applies 13-tap star blur, composites additively | threshold: 0.3, intensity: 0.3, radius: 3.5 |
| Damage Distortion | `DamageDistortionEffect.ts` | Chromatic aberration + barrel warp + animated noise, scaled by `damageIntensity` (0 = passthrough) | maxAberration: 0.008, maxCurvature: 0.03, maxNoise: 0.08 |

**Adding a new shader effect:**
1. Create a new file in `src/rendering/effects/` implementing `ShaderEffect`
2. Write a `#version 300 es` fragment shader with `uniform sampler2D uSource` and `uniform float uFlipY`
3. Use `if (uFlipY > 0.5) uv.y = 1.0 - uv.y;` after computing UV from `gl_FragCoord`
4. Add to the pipeline in `main.ts` via `shaderPipeline.addEffect(new MyEffect())` — order matters (first added = first rendered)
5. The pipeline handles FBO management, texture binding, and Y-flip coordination automatically

### Key conventions

- **Factories over constructors** for entities: `createResource()`, `createEnemy()`, `createAlly()`, `createSalvage()`, `createDropoff()` in `Entity.ts`
- **Frame-rate independent**: all movement multiplied by `dt` (seconds)
- **Tank-style movement**: A/D (or left/right arrows) rotate the player heading; W/S (or up/down arrows) thrust forward/backward along the heading direction
- **Inertia model**: acceleration + exponential friction (`vel *= exp(-friction * dt)`). Acceleration = `speed * friction` so steady-state velocity equals `speed`. Player friction: 2.0, scouts: 2.5, brutes: 1.2, ranged: 1.8. Turning also uses inertia: `turnVelocity *= exp(-turnFriction * dt)` with turnFriction: 3.0
- **Key remapping**: ability keys (1-4) and upgrades key (E) are remappable via K key; bindings persist to `localStorage` under `'radar-game-keybindings'`
- **Events, not mutations**: `PingSystem.update()` returns an array of interaction events; the main loop processes them
- **One ping per wave**: `pingedThisWave` flag on each entity prevents double-interaction until the next ping fires
- **Difficulty scales with distance**: `1 + log2(1 + distFromOrigin / 1000)` — enemies get stronger the further you go from the origin

## Browser Game Performance Rules

These rules are specific to this project: a 60 Hz Canvas 2D game running in the browser. Follow them to avoid the performance pitfalls that kill browser games.

### Allocation & GC

- **Never allocate in the hot path.** The update and render functions run 60 times per second. Creating objects, arrays, or closures inside them triggers garbage collection pauses that cause visible stuttering. Pre-allocate and reuse.
- **Reuse arrays** instead of creating new ones each frame. Clear with `length = 0`, not `= []`.
- **Avoid string concatenation in render loops.** Template literals and string concat create garbage. Cache formatted strings when the underlying value hasn't changed.
- **Use `Math.hypot()` sparingly in hot loops.** It's slower than manual `sqrt(dx*dx + dy*dy)`. When you only need to *compare* distances (not compute exact values), use squared distances: `dx*dx + dy*dy < radius * radius`.

### Canvas 2D

- **Minimize state changes.** Group draws by `fillStyle`/`strokeStyle`/`globalAlpha` — switching these is cheap but not free. Don't alternate colors back and forth.
- **`save()`/`restore()` are expensive in tight loops.** Use them for transform changes, but don't nest them unnecessarily. If you only change `fillStyle`, just set it back manually instead of save/restore.
- **`shadowBlur` is very expensive.** Every draw call with a non-zero `shadowBlur` effectively renders twice. Use sparingly — one or two glowing elements per frame is fine, not every blip.
- **Batch draw calls.** Instead of calling `fillRect()` per entity, batch with a single `beginPath()` + multiple `rect()` + one `fill()` where possible.
- **Skip off-screen entities.** Before drawing any world-space entity, check if it's within the visible radar radius. A quick distance check is cheaper than an invisible draw call.

### Frame Budget

At 60 Hz you have **16.67ms per frame** for update + render combined. Profile with the browser's Performance tab, not `console.time`. Watch for:
- GC pauses (yellow bars in Chrome DevTools)
- Layout thrashing (don't read DOM properties in the game loop)
- Long frames from `shadowBlur` or too many `save()`/`restore()` calls

### When to Optimize

Don't optimize speculatively. The current entity count (typically <100 on screen) does not need spatial partitioning. If profiling shows a bottleneck:
1. First, skip unnecessary work (visibility culling, early returns)
2. Then, reduce allocations (object pooling, pre-allocated arrays)
3. Only then consider algorithmic changes (spatial grid, quadtree)

## Game Balance & Tuning

### How to Tune

Game balance is best done by **playing, not by staring at spreadsheets.** When adjusting values:

1. Change one variable at a time
2. Play 2-3 runs to feel the difference
3. Commit the change with a note about what felt different

### Current Balance Anchors

These values define the game's feel. Changing them has cascading effects — be intentional:

- **Player speed (base 60)** — determines how fast the world scrolls. Changing this affects encounter pacing, resource collection rate, and how many chunks load per second.
- **Ping cooldown (base 1.5s)** — the game's heartbeat. Shorter = more information, easier. Longer = more tension, harder. The entire game rhythm is built around this.
- **Enemy spawn density** — controlled by POI weights and ambient spawn rates in `World.ts`. More enemies = more energy from kills but more damage taken. This is the primary difficulty lever.
- **Energy economy** — resources give 5-15 energy; upgrades cost 20-200+. The ratio determines progression speed. Currently tuned for ~2-3 upgrades in the first 5 minutes.

### Difficulty Curve

The logarithmic scaling (`1 + log2(1 + dist/1000)`) is deliberately gentle. At 1000px from origin, difficulty is 2x. At 3000px, it's ~3x. This means early exploration feels safe but distant regions are genuinely dangerous. Don't change this formula without playing the full progression.

## Game mechanics summary

**Entities:**
- **Resources** — green blips, 5-15 energy each, collected by ping sweep or magnet
- **Enemies** — three subtypes:
  - Scout: fast (90 speed), low HP (15), low damage (3), chases to 200px
  - Brute: slow (25 speed), tank (80 HP), heavy damage (12), charges to 180px
  - Ranged: medium (30 speed), shoots projectiles (8 dmg) every 2.5s from 300px
- **Allies** — three subtypes:
  - Healer: heals 8-16 HP on ping (3s cooldown)
  - Shield: applies 50% damage reduction for 5s on ping
  - Beacon: passively generates 2 energy/sec while player is within 150px
- **Salvage** — rare amber diamond blips, spawned at ~15% chance per chunk. Must fly within 25px to attach. Towed behind the player on elastic ropes with spring physics. Each item has a randomized rope length (25-55px) so they spread out naturally.
- **Dropoff** — gold pulsing ring zones (60px radius), spawned as a POI type. When towed salvage enters the zone (based on the salvage item's position, not the player's), it is deposited for +50 energy per item.

**World generation:**
- Chunks are 400px squares, loaded in a 5x5 grid around the player
- Each chunk either gets a POI (structured spawn) or ambient spawning (resource veins + solo enemies)
- POI chance: 40% base, 56% on corridors (directional axes radiating from origin)
- POI types: resource cache, ally outpost, enemy camp, salvage dropoff, empty zone
- Corridors activate 800px+ from origin along 8 cardinal/diagonal axes (±15° cones)
- Safe zone: no enemies spawn in the inner 3x3 chunks around the player's start position

**Upgrades** (6 total, energy currency, purchased via E key panel):

| ID | Max Level | Cost Formula | Effect per Level |
|----|-----------|-------------|------------------|
| sweep_speed | 5 | 20 + lvl*30 | -12% ping cooldown |
| sweep_range | 5 | 30 + lvl*40 | +40px ping radius |
| radar_resolution | 3 | 50 + lvl*50 | Shows entity type labels at level 2+ |
| hull_armor | 5 | 35 + lvl*40 | +2 flat damage reduction |
| engine_speed | 5 | 25 + lvl*30 | +15 movement speed |
| energy_magnet | 5 | 40 + lvl*45 | Auto-collect resources within 50+lvl*30 px |

**Abilities** (4 total, activated with number keys 1-4 by default — remappable via K key):

| ID | Key | Cooldown | Effect |
|----|-----|----------|--------|
| damage_blast | 1 | 6s | AoE 20 damage to all enemies within 200px |
| heal_over_time | 2 | 10s | Heals 5 HP/sec for 4 seconds (20 HP total) |
| helper_drone | 3 | 15s | Spawns a drone that chases enemies, deals 5 dmg/s contact, lasts 10s |
| dash | 4 | 5s | Instant velocity burst at 3x max speed in current heading direction |

**Salvage & tow rope physics:**
- Spring constant K = 1.2 (soft pull), damping = 0.25 (allows oscillation), friction = 0.8 (floaty, carries momentum)
- Hub-and-spoke topology: each item attaches directly to the player (not chained together)
- Inter-item repulsion at 20px radius prevents items from bunching
- Max 8 towed items; overflow drops oldest with 0.3s fade-out
- Ropes render as quadratic bezier curves with velocity-based control point offset
- Cleared on player death/restart

**Damage formula:** `effective = max(0, rawDamage - armor) * (1 - shieldReduction)`

**Scoring:** +energy_value for collecting resources, +50 for enemy kills, +50 for depositing salvage at dropoffs

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

**What to test in a game:**
- System logic (does the combat system apply damage correctly?)
- State transitions (does game over trigger when HP reaches 0?)
- Math-heavy code (physics, difficulty scaling, cost formulas)
- Edge cases (max upgrades, empty entity lists, zero dt)

**What NOT to test:**
- Rendering output (canvas draw calls are not worth asserting on)
- Exact pixel positions (these change constantly during development)
- "Does the game feel fun" (that's playtesting, not unit testing)

## Adding New Features — Checklist

When adding a new entity type, ability, upgrade, or system:

1. **Does this serve one of the core loops?** (explore → collect → upgrade → go further) If not, it's probably scope creep.
2. **Can it reuse existing patterns?** New enemy subtypes reuse the enemy factory + combat system. New abilities reuse AbilitySystem's cooldown logic. Don't build new systems for things that fit existing ones.
3. **Update the factory** in `Entity.ts` if adding entities
4. **Update the relevant system** — not main.ts. Main.ts should only change if the update/render order needs a new phase.
5. **Add tests** for the system logic, not for rendering
6. **Play the game** and verify it feels right
7. **Update this file** if the change affects architecture, update order, or game balance anchors

## Commit Convention

Commits follow the pattern: `prd-NNN: <description>` for features, `review:` / `fix:` / `qa:` / `chore:` / `merge:` / `feat:` for other work.

## Development Notes

- The game has no linter configured — `npm run lint` is a no-op
- All rendering is procedural (no sprite sheets, no image assets, no audio)
- The `index.html` contains a single `<canvas id="game-canvas">` element
- The main branch contains the full codebase
- World chunks are 400px squares; the game loads a 5x5 grid around the player and cleans up entities beyond 2000px
- Post-processing shaders (bloom + damage distortion) require WebGL2; if unavailable, the game runs with Canvas 2D only (no post-processing)
- The pause menu (Escape) allows toggling shaders and opening keybind remapping
