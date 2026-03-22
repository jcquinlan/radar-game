# Radar Game

A browser-based radar-themed survival game built with TypeScript and Canvas 2D. The player explores a procedural world through an expanding radar ping, mines asteroids for energy, deploys mining and combat bots, upgrades at a persistent home base, and fights a boss at the end of each timed run.

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
- **Rendering:** Canvas 2D API + optional WebGL2 3D entity rendering + optional WebGL2 post-processing (bloom + damage distortion shaders)
- **Dependencies:** Zero runtime dependencies. Only devDependencies: typescript, vite, vitest, jsdom.

**Keep it zero-dep.** Do not add runtime dependencies. This game runs on Canvas 2D and math. If you think you need a library, you almost certainly don't — write the 20 lines of code instead.

## Architecture

### Game Flow

The game uses a state machine with these states: `menu`, `base_mode`, `run_active`, `final_wave`, `results`, `game_over`, `level_complete`, `playing`, `paused`.

**Core loop:**
1. **Main Menu** — Start Game button enters base_mode
2. **Base Mode** — Home base with 3 upgrade buildings (Player, Mining, Combat). Spend persistent currency on upgrades. Press START RUN to begin.
3. **Run Active** — 60-second timed run. Mine asteroids, deploy bots, collect salvage, fight enemies. Timer counts down.
4. **Final Wave** — Timer expires. All entities cleared. Wave of enemies + boss spawn around the home base. Defend the base and kill the boss.
5. **Results** — Currency awarded based on salvage deposited, kills, and base HP. Return to base_mode.
6. **Repeat** — Upgrades persist between runs via localStorage.

### Systems pattern

The game uses a lightweight entity-systems architecture. Entities are plain data objects (interfaces, no behavior). Systems operate on entities each frame. The main loop in `src/main.ts` orchestrates the update/render cycle.

**This is not a full ECS framework and should not become one.** There is no component registry, no entity manager, no system scheduler. Systems are just functions/classes that take entity arrays and dt. This is intentional — the overhead of a "real" ECS is not justified at this scale.

**Update order** (every frame at 60 Hz fixed timestep):

1. `InputSystem` — reads WASD/arrow key state, returns `{turn, thrust}` for tank-style controls
2. Player turn + thrust — applies turn inertia (`turnVelocity *= exp(-turnFriction * dt)`), accelerates along heading
3. `World.updateSpawning()` — lazy-loads 400px chunks in a 5x5 grid around player, places POIs or ambient entities
4. **Click-to-deploy** — left-click near asteroid = mining bot, right-click = combat bot (launches from player toward click)
5. Blip, particle, HUD updates
6. `PingSystem.update()` — fires expanding detection circle, returns interaction events on contact
7. Event processing — floating text, score from ping events
8. `TowRopeSystem.checkPickups()` — detects salvage within pickup radius (25px), attaches to player
9. `TowRopeSystem.update()` — spring physics for towed salvage items
10. `TowRopeSystem.checkDropoffs()` — checks if towed salvage entered a dropoff zone or home base, awards energy
11. Shield buff countdown
12. `AbilitySystem.update()` — cooldown decrements, HoT healing, missile tracking
13. `MiningBotSystem.update()` — deployed mining bots orbit asteroids, extract energy
14. `CombatBotSystem.update()` — deployed combat bots fire at nearby enemies
15. `CombatSystem.update()` — enemy AI (chase/fire), projectile movement, contact damage, base damage during final_wave
16. `BossSystem.updateBoss()` — boss phase transitions, stat scaling, minion spawning (final_wave only)
17. Motion trail tracking (player, enemies, projectiles, bots)
18. Screen shake + damage flash on damage
19. Level objective / wave end / game over checks
20. `World.cleanup()` — removes inactive/distant entities (preserves towed salvage, skipped during final_wave)

**Canvas stack (z-index order):**

The game uses up to three layered canvases:

| z-index | Canvas | Purpose |
|---------|--------|---------|
| 0 | 3D canvas (WebGL2) | Entity rendering — asteroids, enemies, player, bots, projectiles, salvage, home base |
| 1 | 2D canvas (Canvas 2D) | Radar display, HUD, UI overlays, ability effects, floating text, 2D entity fallback |
| 2 | Shader canvas (WebGL2) | Post-processing — bloom glow, damage distortion |

When 3D is disabled (via pause menu or WebGL2 unavailable), the 3D canvas is unused and the 2D canvas handles entity rendering via `BlipRenderer` with an opaque background fill. The `use3D` flag in `main.ts` controls which render path is active each frame.

**Render order:**

0. **3D pass** (when `use3D` is true — skipped when 3D is off):
   - `Renderer3D.beginFrame()` — clear 3D canvas, set camera matrices
   - `EntityRenderer3D` renders: asteroids, home base, enemies (per subtype), salvage, mining bots, combat bots, projectiles (enemy, bot, homing missiles), player ship
   - `Renderer3D.endFrame()`
1. Background fill — when 3D active: clear 2D canvas and blit 3D canvas via `drawImage`. When 3D off: opaque theme background fill.
2. Radar display (rings, crosshair, ping circle, scanlines — fixed to screen, scaled with zoom)
3. Rotated world layer (canvas transform: `-player.heading - π/2`, scaled by zoom):
   - Ambient particles (deep layer)
   - Entity blips via `BlipRenderer` — when 3D active: ghost-blips and labels only. When 3D off: full entity shapes (asteroids, enemies, salvage) with glow effects.
   - Sweep flash effects
   - Ability visual effects (blast ring, regen glow, missile launch flash)
   - Floating damage/heal/collection text (counter-rotated to stay upright)
   - Ambient particles (foreground layer)
4. Ping range vignette (subtle darkening outside radar ring)
5. Player heading indicator (green triangle at screen center — only when 3D is off; 3D renders the player ship)
6. Damage flash vignette (red overlay on hit)
7. HUD (health bar, energy, score, kills, distance, time, run timer, coordinates)
8. Ability bar (bottom center, cooldown timers and keybind labels)
9. Minimap (bottom-left, expandable with click — shows entities, home base, distance rings)
10. Upgrade panel (right side, E key in base_mode — shows 3 building tabs with persistent upgrades)
11. Game over / results overlay
12. Key remap screen (modal overlay, toggled with K key)
13. Pause menu (Escape key — includes Toggle 3D and Toggle Shaders options)
14. Post-processing shader pass (bloom glow + damage distortion, toggleable)

### Directory layout

```
src/
  main.ts                    # Entry point — game state machine, init, game loop, update/render orchestration
  canvas.ts                  # Canvas element creation and resize handling
  engine/
    GameLoop.ts              # Fixed timestep loop (60 Hz, 250ms max delta cap)
  entities/
    Entity.ts                # Type definitions (Asteroid, Enemy, Salvage, Dropoff, HomeBase, Projectile) + factory functions
    Player.ts                # Player class — stats, damage/heal/shield/energy methods
  systems/
    InputSystem.ts           # Keyboard + mouse input — tank-style controls, click-to-deploy coordinate conversion
    PingSystem.ts            # Expanding circle detection — fires every ~1.5s, interacts with entities on contact
    CombatSystem.ts          # Enemy AI behaviors, projectile lifecycle, contact damage, base targeting during waves
    HomebaseUpgradeSystem.ts # 3 upgrade buildings (player, mining, combat) with persistent currency
    UpgradeSystem.ts         # Legacy in-run upgrade definitions (used by level system)
    AbilitySystem.ts         # 4 cooldown abilities — blast, heal over time, homing missile, dash
    TowRopeSystem.ts         # Salvage towing — spring physics, proximity pickup, dropoff/home deposit
    MiningBotSystem.ts       # Click-deployed mining bots — orbit asteroids, extract energy over ~30s
    CombatBotSystem.ts       # Right-click-deployed combat bots — launch from player, fly to target, orbit enemies while firing
    BossSystem.ts            # Boss phase transitions (HP thresholds), stat scaling, minion spawning
    WaveSpawner.ts           # Final wave enemy spawning + boss spawning (scaled by run count)
    SaveSystem.ts            # localStorage persistence — currency, run count, base upgrade levels
    ZoomState.ts             # Camera zoom state — lerped zoom in/out controls
  world/
    World.ts                 # Chunk-based spawning via POI system, difficulty scaling, entity cleanup
    POIGenerator.ts          # POI type definitions, corridor detection, weighted selection, asteroid veins
  levels/
    LevelConfig.ts           # Level configuration types and objective checking
    LevelManager.ts          # Level progression and selection
    levels.ts                # Tutorial/demo level definitions
  radar/
    RadarDisplay.ts          # Radar rendering — circle, rings, ping circle, scanlines
    BlipRenderer.ts          # Entity blip rendering — full 2D shapes (fallback) or ghost-blips + labels (3D active)
    SweepEffects.ts          # Expanding flash circles on ping interactions
    AbilityEffects.ts        # Blast ring, regen glow, missile launch flash
    AmbientParticles.ts      # Decorative floating particles inside radar
    MotionTrail.ts           # Velocity-based motion streaks behind fast-moving entities
    DeathParticles.ts        # Directional particle burst on entity destruction
  rendering/
    Renderer3D.ts            # WebGL2 3D renderer — canvas, camera, Blinn-Phong lit shader, mesh upload/draw
    EntityRenderer3D.ts      # 3D entity rendering — pre-generates mesh pools, per-frame entity iteration with culling
    meshes.ts                # Procedural mesh generators — asteroids, player, enemies, bots, salvage, projectiles
    math3d.ts                # Minimal 3D math library — mat4 (identity, multiply, translate, rotate, scale, ortho, lookAt), vec3
    ShaderPipeline.ts        # WebGL2 multi-pass post-processing pipeline (reads Canvas 2D as texture, ping-pong FBOs)
    ShaderEffect.ts          # ShaderEffect interface + compile/link helpers
    effects/
      BloomEffect.ts         # Bloom/glow — brightness threshold + 13-tap star blur + additive composite
      DamageDistortionEffect.ts  # On-damage chromatic aberration + barrel warp + noise (driven by damageFlash)
  themes/
    theme.ts                 # Theme accessor and cycling (getTheme, cycleTheme)
    themes.ts                # Color theme definitions (radar, entities, UI, effects palettes)
  ui/
    HUD.ts                   # Health bar, energy, score, kills, distance, time, run timer, coordinates
    UpgradePanel.ts          # Right-side upgrade shop (E key toggle in base_mode, tabbed by building)
    GameOverScreen.ts        # "SIGNAL LOST" overlay with final stats and restart
    ResultsScreen.ts         # Post-run results — salvage, kills, base HP, currency earned
    MainMenuScreen.ts        # Main menu — Start Game button, level selection
    LevelCompleteScreen.ts   # Level completion overlay with next/menu options
    FloatingText.ts          # Rising damage/heal/collection numbers
    ScreenShake.ts           # Camera shake on damage (random offset, 0.15s decay)
    AbilityBar.ts            # Bottom-center ability slots with cooldown timers and keybind labels
    Minimap.ts               # Expandable minimap — collapsed bottom-left, click to expand fullscreen
    HelpScreen.ts            # H key toggle — scrollable help text overlay
    KeyRemapScreen.ts        # K key toggle — rebind ability keys and upgrades key, persists to localStorage
    PauseMenu.ts             # Escape key — pause/resume, restart, toggle 3D, toggle shaders, cycle themes, open keybinds
```

### 3D entity rendering

The game has an optional WebGL2 3D rendering layer that renders entities as lit, textured 3D meshes. When enabled, entities appear as procedurally generated 3D shapes with Blinn-Phong lighting, specular highlights, emissive glow, and per-entity animations (rotation, banking, bobbing, pulsing). When disabled (or if WebGL2 is unavailable), the game falls back to 2D `BlipRenderer` shapes.

**Architecture:**
- `Renderer3D` creates a WebGL2 canvas positioned behind the 2D canvas (`z-index: 0`)
- `Renderer3D.create()` returns `null` if WebGL2 is unavailable — the game runs in 2D-only mode
- `EntityRenderer3D` pre-generates mesh pools at init (one-time GPU upload, never in hot path)
- Each frame: `beginFrame()` clears and sets camera, entity render methods iterate and cull, `endFrame()` finalizes
- The 2D canvas blits the 3D canvas via `drawImage()` so the `ShaderPipeline` can read both layers
- Context loss (`webglcontextlost`) triggers automatic fallback to 2D; context restore reinitializes 3D resources
- The `use3D` flag in `main.ts` controls the active render path, toggleable via the pause menu

**Camera:**
- Orthographic projection, tilted ~65 degrees from horizontal (isometric-like top-down view)
- Camera follows the player, rotated to match player heading
- Zoom scales the orthographic half-size

**Lighting:**
- Single directional light (above-right: `[0.3, 0.9, 0.4]`)
- Slightly blue-tinted ambient (`[0.25, 0.25, 0.28]`)
- Blinn-Phong specular on metallic entities (player, bots)
- Per-entity emissive glow (enemies glow by subtype, projectiles bloom-ready)

**Mesh types:**
- Asteroids: irregular icosphere variants (10 per size), rotation based on position seed
- Player: angular ship mesh, banks on turns, engine glow when thrusting
- Enemies: scout (dart), brute (cube), ranged (diamond), boss (hexagonal prism with phase-based glow)
- Bots: mining (icosphere), combat (chevron with lifetime pulse)
- Salvage: rotating diamond with amber emissive
- Projectiles: elongated capsule, tinted per source (red=enemy, blue=bot, orange=missile)

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

- **Factories over constructors** for entities: `createAsteroid()`, `createEnemy()`, `createBossEnemy()`, `createSalvage()`, `createDropoff()`, `createHomeBase()` in `Entity.ts`
- **Frame-rate independent**: all movement multiplied by `dt` (seconds)
- **Tank-style movement**: A/D (or left/right arrows) rotate the player heading; W/S (or up/down arrows) thrust forward/backward along the heading direction
- **Inertia model**: acceleration + exponential friction (`vel *= exp(-friction * dt)`). Acceleration = `speed * friction` so steady-state velocity equals `speed`. Player friction: 2.0, scouts: 2.5, brutes: 1.2, ranged: 1.8. Turning also uses inertia: `turnVelocity *= exp(-turnFriction * dt)` with turnFriction: 3.0
- **Click-to-deploy**: Left-click near an asteroid deploys a mining bot. Right-click deploys a combat bot that launches from the player and flies toward the click location. Feedback via floating text.
- **Key remapping**: ability keys (1-4) and upgrades key (E) are remappable via K key; bindings persist to `localStorage` under `'radar-game-keybindings'`
- **Events, not mutations**: `PingSystem.update()` returns an array of interaction events; the main loop processes them
- **One ping per wave**: `pingedThisWave` flag on each entity prevents double-interaction until the next ping fires
- **Difficulty scales with distance**: `1 + log2(1 + distFromOrigin / 1000)` — enemies get stronger the further you go from the origin
- **Persistent progression**: Currency and base upgrade levels saved to localStorage via `SaveSystem`. Upgrades apply at the start of each run.

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

- **Player speed (base 60)** — determines how fast the world scrolls. Changing this affects encounter pacing, asteroid mining range, and how many chunks load per second.
- **Ping cooldown (base 1.5s)** — the game's heartbeat. Shorter = more information, easier. Longer = more tension, harder. The entire game rhythm is built around this.
- **Run timer (60s)** — how long the mining/exploration phase lasts before the final wave. Shorter = less time to mine, more urgent. Longer = more resources but less exciting.
- **Mining bot duration (~30s)** — time to fully mine a medium asteroid. This sets the pace of energy income. A 60s run with 3 bots means roughly 2 asteroids per bot per run.
- **Combat bot fire rate (1.5s)** — tuned so a combat bot kills 2-3 scouts in its 20s lifetime. Faster = too strong, slower = not worth deploying.
- **Boss HP (350 base)** — requires 3-4 upgrades (combat damage, combat fleet) to defeat comfortably. Scales by 15% per run count.
- **Home base HP (400)** — can survive a wave but not indefinitely. Creates urgency to kill enemies before they overwhelm the base.
- **Currency economy** — `salvage*50 + kills*10 + floor(baseHP%*50)`. First run typically yields 100-200 currency. Cheapest upgrades cost 25-30, so 2-3 upgrades after the first run.
- **Asteroid density** — 1-2 veins of 5-8 asteroids per chunk, plus POI caches. Enough to always find something to mine, but not so dense that mining is trivial.

### Difficulty Curve

The logarithmic scaling (`1 + log2(1 + dist/1000)`) is deliberately gentle for world-spawned enemies. At 1000px from origin, difficulty is 2x. At 3000px, it's ~3x.

The wave difficulty scales with `runCount`: more enemies per wave (`10 + runCount*5`), stronger enemies (`1 + runCount*0.3` difficulty multiplier), and a boss that scales HP and damage by `1 + runCount*0.15`.

## Game mechanics summary

**Entities:**
- **Asteroids** — three sizes with different energy values and HP:
  - Small: 10-15 energy, 20 HP (50% spawn chance)
  - Medium: 20-35 energy, 40 HP (35% spawn chance)
  - Large: 40-60 energy, 80 HP (15% spawn chance)
  - Mined by deploying mining bots (click near asteroid). Mining takes ~30s for the full yield.
- **Enemies** — three subtypes:
  - Scout: fast (90 speed), low HP (15), low damage (3), chases to 200px
  - Brute: slow (25 speed), tank (80 HP), heavy damage (12), charges to 180px
  - Ranged: medium (30 speed), shoots projectiles (8 dmg) every 2.5s from 300px
- **Boss** — spawned during final_wave. Ranged subtype with 350 base HP, 15 damage, 1.8s fire rate. Three phases based on HP thresholds:
  - Phase 1 (>60% HP): base stats
  - Phase 2 (30-60% HP): 1.0s fire rate, +20% speed, spawns 2 scout minions every 10s
  - Phase 3 (<30% HP): 0.7s fire rate, +50% speed, continues minion spawning
- **Salvage** — amber diamond blips, spawned at ~15% chance per chunk. Must fly within 25px to attach. Towed behind the player on elastic ropes. Each item has a randomized rope length (25-55px).
- **Dropoff** — gold pulsing ring zones (60px radius), spawned as a POI type. Depositing salvage awards +50 energy per item. Home base also accepts salvage deposits.
- **Home Base** — at world origin (0,0). 400 HP, 150px boundary radius. Contains 3 upgrade buildings. Tints red when damaged. Enemies target it during final_wave.

**Bots (click-to-deploy):**
- **Mining Bot** — click near an asteroid to deploy. Flies to asteroid, orbits while mining (~30s for full energy extraction). Returns to player when done or asteroid depleted. 3 charges base (upgradeable). Occasionally aggros nearby enemies toward the mining site.
- **Combat Bot** — right-click to deploy. Launches from the player's position and flies toward the click location. Auto-detects enemies within 250px, chases them, and orbits while firing projectiles (1.5s fire rate, 4 damage). 20s lifetime, 30 HP. 2 charges base (upgradeable).

**World generation:**
- Chunks are 400px squares, loaded in a 5x5 grid around the player
- Each chunk either gets a POI (structured spawn) or ambient spawning (asteroid veins + solo enemies)
- POI chance: 40% base, 56% on corridors (directional axes radiating from origin)
- POI types: asteroid cache, enemy camp, salvage dropoff, empty zone
- Corridors activate 800px+ from origin along 8 cardinal/diagonal axes
- Safe zone: no enemies spawn in the inner 3x3 chunks around the player's start position
- Ambient spawning: 1-2 asteroid veins (5-8 asteroids each) per non-POI chunk

**Homebase Upgrades** (persistent between runs, 3 buildings, purchased with currency in base_mode):

| Building | ID | Max Level | Cost Formula | Effect per Level |
|----------|-----|-----------|-------------|------------------|
| Player | hull_armor | 5 | 30 + lvl*25 | +2 flat damage reduction |
| Player | engine_speed | 5 | 25 + lvl*20 | +15 movement speed |
| Player | ping_range | 5 | 30 + lvl*25 | +40px radar detection radius |
| Player | ping_frequency | 5 | 35 + lvl*30 | -12% ping cooldown |
| Mining | max_mining_bots | 5 | 40 + lvl*35 | +1 max mining bot |
| Mining | mining_speed | 5 | 30 + lvl*25 | +20% mining rate |
| Mining | mining_range | 5 | 25 + lvl*20 | +30px deploy radius |
| Combat | max_combat_bots | 5 | 40 + lvl*35 | +1 max combat bot |
| Combat | combat_damage | 5 | 35 + lvl*30 | +2 combat bot damage |
| Combat | combat_lifetime | 5 | 30 + lvl*25 | +5s combat bot lifetime |

**Abilities** (4 total, activated with number keys 1-4 by default — remappable via K key):

| ID | Key | Cooldown | Effect |
|----|-----|----------|--------|
| damage_blast | 1 | 6s | AoE 20 damage to all enemies within 200px |
| heal_over_time | 2 | 10s | Heals 5 HP/sec for 4 seconds (20 HP total) |
| homing_missile | 3 | 8s | Fires a homing missile that tracks nearest enemy |
| dash | 4 | 5s | Instant velocity burst at 3x max speed in current heading direction |

**Salvage & tow rope physics:**
- Spring constant K = 1.2 (soft pull), damping = 0.25 (allows oscillation), friction = 0.8 (floaty, carries momentum)
- Hub-and-spoke topology: each item attaches directly to the player (not chained together)
- Inter-item repulsion at 20px radius prevents items from bunching
- Max 8 towed items; overflow drops oldest with 0.3s fade-out
- Ropes render as quadratic bezier curves with velocity-based control point offset
- Cleared on player death/restart

**Damage formula:** `effective = max(0, rawDamage - armor) * (1 - shieldReduction)`

**Currency formula:** `salvage_deposited * 50 + enemies_killed * 10 + floor(base_hp_percent * 50)`. Reduced to 25% on game over (player death or base destruction).

**Scoring:** +50 for enemy kills, +50 for depositing salvage, energy from mining asteroids

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

1. **Does this serve one of the core loops?** (mine → collect → upgrade → fight boss → repeat) If not, it's probably scope creep.
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
- The pause menu (Escape) allows toggling shaders, cycling themes, and opening keybind remapping
- Save data persists to `localStorage` under `'radar-game-save'` (currency, run count, base upgrades) and `'radar-game-keybindings'` (key remaps)
- The game supports camera zoom via mouse wheel or +/- keys during gameplay and base_mode
- Minimap (M key toggle) shows entity positions relative to player; click to expand fullscreen
