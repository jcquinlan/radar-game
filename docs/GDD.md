# Radar Game — Game Design Document

**Version:** 0.3
**Date:** 2026-03-15

---

## 1. Overview

**Session length:** ~10 minutes
**Core loop:** Timed salvage runs with a base defense finale. The player has 10 minutes to explore, collect resources, and prepare their home base before a final wave hits. Survive and collect loot. Die and lose it.

```
BASE MODE → start run → TIMED RUN (10 min) → FINAL WAVE → RESULTS → back to BASE MODE
```

The 10-minute timer is the central design constraint. Every second spent exploring is a second not spent fortifying. The player decides how to split their time — there are no fixed phases within a run.

---

## 2. Current Codebase State

Before building, understand what already exists:

- **GameState** (`main.ts:35`): `'menu' | 'playing' | 'level_complete' | 'game_over' | 'paused'`
- **LevelManager** (`levels/LevelManager.ts`): manages level selection. Has 2 tutorial levels + a "Full Game" mode with all features enabled and no objectives.
- **LevelConfig** (`levels/LevelConfig.ts`): feature flags (`combat`, `upgrades`, `abilities`, `salvage`, `towRope`), world config, objectives, hints. The "Full Game" level has all features on, infinite chunks, distance-based difficulty, and empty objectives.
- **HomeBase** (`Entity.ts:82-87`): simple interface with `x`, `y`, `radius` (150px). Created at origin. Rendered in `main.ts:562-618` as pulsing cyan rings + hexagon. **Visual only — no HP, no gameplay interaction.**
- **HomeBase is NOT part of the GameEntity union.** It's a standalone object, not in `world.entities`.
- **GameEntity** (`Entity.ts:99`): `Resource | Enemy | Ally | Salvage | Dropoff`
- **EntityType** (`Entity.ts`): `'resource' | 'enemy' | 'ally' | 'salvage' | 'dropoff'`
- **Dropoff zones** already exist: 60px radius, award 50 energy per salvage item deposited. Handled by `TowRopeSystem.checkDropoffs()`.
- **CombatSystem** (`systems/CombatSystem.ts`): enemy AI always chases the **player**. No support for chasing other targets or positions.
- **GameOverScreen** (`ui/GameOverScreen.ts`): shows "SIGNAL LOST", displays score/kills/energy/distance/time, has a clickable restart button.
- **HUD** (`ui/HUD.ts`): health bar, energy, range, threat level, coordinates (top-left), score, kills, time (top-right), FPS (bottom-left).
- **World cleanup** (`World.ts:147-157`): removes entities >2000px from player or marked inactive. Preserves towed salvage.

The run-based flow described below **replaces the current level system** as the primary game mode. Tutorial levels remain accessible from the main menu.

---

## 3. Implementation Phases

Build in this order. **Get Phase 1 playable before starting Phase 2.** Phase 3 is stretch.

### Phase 1 — Core Run Loop

The minimum to have a playable timed run with a wave at the end.

1. Game state machine refactor
2. Run timer
3. Home base HP + deposit mechanism
4. Final wave spawning
5. Results screen + basic persistence

### Phase 2 — Base Building

Defenses and persistent upgrades that make the between-run base meaningful.

6. Turret defense entity
7. Repair station defense entity
8. Simple defense placement
9. Persistent base upgrades + base mode UI

### Phase 3 — Combat Depth (stretch)

Polish mechanics that raise the skill ceiling.

10. Combo system (ability interactions)

---

## 4. Phase 1 — Core Run Loop

### 4.1 Game State Machine Refactor

Replace the current `GameState` type and add new states for the run-based flow.

**New GameState type:**
```
'menu' | 'base_mode' | 'run_active' | 'final_wave' | 'results' | 'game_over' | 'paused'
```

**State transitions:**
```
menu -----------> base_mode        (player clicks "Start Game")
base_mode ------> run_active       (player clicks "Start Run")
run_active -----> final_wave       (timer hits 0:00)
run_active -----> game_over        (player dies during run)
final_wave -----> results          (all wave enemies killed)
final_wave -----> game_over        (player dies OR base HP hits 0)
results --------> base_mode        (player clicks "Continue")
game_over ------> base_mode        (player clicks "Continue" — reduced/no loot)
base_mode ------> menu             (player clicks "Quit")
Any state ------> paused           (Escape)
paused ---------> previous state   (Escape)
```

Remove `'level_complete'` state. The "Full Game" `LevelConfig` is used as the config for all runs (all features enabled, no objectives). Tutorial levels still use the existing `'playing'` → `'level_complete'` flow — keep that path working for tutorials only.

**Integration notes:**
- Modify `GameState` type at `main.ts:35`
- The existing `init()` function sets up the game. Refactor it so `init()` can be called to reset for a new run without recreating the canvas/systems. Extract a `startRun()` function that resets player, world, timer, and entities.
- `update()` currently skips if state is not `'playing'`. Change to skip if state is not `'run_active'` or `'final_wave'`.
- `render()` needs new branches for `'base_mode'` and `'results'`.

### 4.2 Run Timer

A 10-minute countdown displayed on the HUD. When it hits zero, the game transitions to `'final_wave'`.

**Implementation:**
- Add `runTimer: number` to the game state variables in `main.ts` (alongside `gameState`, `player`, etc.). Initialize to `600` (seconds) at the start of each run.
- Decrement by `dt` each frame during `'run_active'` state.
- When `runTimer <= 0`: set `gameState = 'final_wave'` and call `spawnWave()` (see 4.4).
- When `runTimer <= 60`: pulse the timer text red. Scale the text size with a `sin()` oscillation. This is the only urgency cue needed — no audio exists.

**HUD display:**
- Render the timer in `HUD.ts` at top-center, large (20px bold). Format as `MM:SS`.
- Color: white when > 60s, pulsing red when <= 60s.

### 4.3 Home Base HP + Deposit

Extend the existing `HomeBase` to have health and act as a salvage deposit point.

**Extend the HomeBase interface** in `Entity.ts`:
```typescript
interface HomeBase {
  x: number;
  y: number;
  radius: number;       // existing (150px)
  health: number;       // NEW — starting value: 500
  maxHealth: number;    // NEW — starting value: 500
}
```

Update `createHomeBase()` to include `health: 500, maxHealth: 500`.

**Deposit mechanism:**
- The home base acts as a dropoff point. In the main update loop (where `TowRopeSystem.checkDropoffs()` is called, `main.ts:413-420`), add a check: for each towed item, test if it's within `homeBase.radius` of `homeBase.x, homeBase.y`. If so, detach the item and award energy (same 50 per item as existing dropoffs).
- This can be done by adding a method to `TowRopeSystem` like `checkHomeDeposit(homeBase)`, or inline in `main.ts` alongside the existing dropoff check. Keep it simple — reuse the same distance check pattern from `checkDropoffs`.

**Base HP bar:**
- Render a health bar for the base in `HUD.ts`, below the player health bar. Label: `BASE: 350/500`. Same bar style as player HP.
- During `'final_wave'` state, the base HP bar should be prominent (larger, centered, or highlighted).

**Rendering changes:**
- When `health < maxHealth`, tint the base rings from cyan toward red proportional to damage taken.

### 4.4 Final Wave

When the timer expires, enemies spawn and converge on the home base.

**Wave spawning:**
- Create a `spawnWave()` function. Keep it in `main.ts` or create a small `WaveSystem.ts` file — either is fine. Do NOT build a generic configurable wave framework.
- Wave composition: `10 + (runCount * 5)` total enemies, where `runCount` starts at 1 and increments each run.
- Enemy mix: 50% scouts, 30% brutes, 20% ranged (same weights as ambient spawning).
- Spawn location: random positions on a circle 800px from the base center (the base is at origin, so this is 800px from 0,0). Spawn all enemies at once — no staggered batches for v1.
- Scale enemy stats using the existing `scaleEnemy()` function with a difficulty of `1 + runCount * 0.3`.

**Boss:**
- For Phase 1, the boss is a brute with 5x HP and 2x damage. No unique mechanics yet (that's Phase 3). Spawn it alongside the regular wave enemies.
- Mark it with a flag (`isBoss: true` on the Enemy interface) so it can be rendered larger/differently.

**Enemy targeting during wave:**
- During `'final_wave'` state, enemies must path toward the base, not the player.
- Modify `CombatSystem.update()`: accept an optional `targetPos: {x: number, y: number}` parameter. During `'final_wave'`, pass `{x: homeBase.x, y: homeBase.y}`. During `'run_active'`, pass `{x: player.x, y: player.y}` (current behavior).
- Enemies still deal contact damage to the player if they get close.
- **Base damage:** When an enemy is within 30px of the base center, it deals its `contactDamage` per second to `homeBase.health` (same rate as player contact damage). Enemies should still be attackable/killable by the player during this time.

**Wave end conditions:**
- **Win:** all wave enemies are dead → transition to `'results'`
- **Lose (base):** `homeBase.health <= 0` → transition to `'game_over'`
- **Lose (player):** `player.health <= 0` → transition to `'game_over'`

**How to track wave enemies:** Add a `waveEnemy: boolean` flag to the `Enemy` interface (default `false`). Wave-spawned enemies get `waveEnemy: true`. The wave ends when no active enemies have `waveEnemy === true`. Normal world enemies do not count — run `world.cleanup()` when transitioning to `'final_wave'` to remove non-wave entities.

### 4.5 Results Screen + Persistence

After surviving the wave, show a results screen and award persistent currency.

**Results screen:**
- Extend or replace `GameOverScreen`. The simplest approach: create a new `ResultsScreen.ts` in `src/ui/` following the same pattern (dim overlay, stats, clickable button).
- Display:
  - Salvage deposited (count)
  - Enemies killed
  - Base HP remaining (as percentage)
  - **Currency earned** (see formula below)
- Button: "Continue" → transitions to `'base_mode'`

**Currency formula:**
```
currency = (salvageDeposited * 50) + (enemiesKilled * 10) + floor(baseHpPercent * 50)
```

Single currency for everything. Call it "scrap" or just "currency" — no thematic naming needed.

**Persistence:**
- Store in `localStorage` under key `'radar-game-save'`
- Data shape:
```typescript
interface SaveData {
  currency: number;
  runCount: number;
  baseUpgrades: Record<string, number>;  // upgrade ID -> level
}
```
- Load on game start. Save after each run (results screen) and after each upgrade purchase.
- No persistence abstraction. Use `JSON.parse(localStorage.getItem(...))` and `JSON.stringify()` directly.

**Game over (lose) path:**
- Same as results but with reduced rewards: `floor(currency * 0.25)`. Show "RUN FAILED" instead of stats. Same "Continue" button → `'base_mode'`.

---

## 5. Phase 2 — Base Building

### 5.1 Defense Entities

Two defense types for v1. **No walls** — enemy pathfinding redirection is out of scope.

**Turret:**
```typescript
interface Turret {
  x: number;
  y: number;
  health: number;       // 50
  maxHealth: number;     // 50
  range: number;         // 200px
  damage: number;        // 5 per shot
  fireRate: number;      // 1 shot per second
  lastFireTime: number;
  active: boolean;
}
```
- Behavior: find nearest enemy within range, fire a projectile at it. Reuse the existing `Projectile` interface for turret shots (just with different damage/speed values).
- Rendering: small cyan square with a rotating line indicating aim direction.

**Repair Station:**
```typescript
interface RepairStation {
  x: number;
  y: number;
  health: number;       // 30
  maxHealth: number;     // 30
  healRate: number;      // 3 HP/sec to player
  range: number;         // 100px
  active: boolean;
}
```
- Behavior: if player is within range, heal player at `healRate * dt` per frame. Does not heal the base (to keep repair station from being mandatory).
- Rendering: small green cross/plus symbol with a pulsing glow when actively healing.

**Both defense types:**
- Enemies can attack them (same contact damage logic as base). When `health <= 0`, set `active = false`.
- Add `Turret` and `RepairStation` to a new `Defense` union type. Keep them separate from `GameEntity` — store them in their own array (`defenses: Defense[]`) alongside `world.entities`.
- Factory functions: `createTurret(x, y)`, `createRepairStation(x, y)` in `Entity.ts`.

### 5.2 Defense Placement

Keep it dead simple for v1. No grid, no drag-and-drop, no placement mode.

**UX:** During `'run_active'` or `'base_mode'`, when the player is within `homeBase.radius`:
- Press `T` to place a turret at a random valid position within base radius. Costs 100 energy.
- Press `R` to place a repair station at a random valid position within base radius. Costs 75 energy.
- "Valid position" = within `homeBase.radius` of base center, at least 30px from any existing defense.
- Show floating text confirming placement or "Not enough energy" on failure.
- Max 3 defenses total to start (upgradeable via persistent upgrades).

**HUD hint:** When player is within base radius, show a small text: `[T] Turret (100) | [R] Repair (75)` near the bottom of the screen. Hide when outside base radius.

### 5.3 Defense Behavior During Wave

- Turret AI goes in `CombatSystem.update()` or in a small loop in `main.ts` during the `'final_wave'` update. Each frame: find nearest active enemy, if within range and fire cooldown elapsed, create a projectile aimed at that enemy. Projectile speed: 150px/s. Use the existing projectile rendering.
- Repair station healing goes in the same update section: if player within range, `player.heal(healRate * dt)`.
- Enemies prioritize the base but deal contact damage to defenses they pass through (same 30px contact check).

### 5.4 Persistent Base Upgrades

Between runs, the player spends currency on permanent upgrades.

| Upgrade | Max Level | Cost per Level | Effect |
|---------|-----------|---------------|--------|
| Base HP | 5 | 100 + level * 75 | +100 max base HP per level |
| Salvage Capacity | 3 | 150 + level * 100 | +2 max towed items per level (base 8) |
| Starting Energy | 5 | 75 + level * 50 | +25 starting energy per level |
| Defense Slots | 3 | 200 + level * 150 | +1 max defense per level (base 3) |

**Base mode UI:**
- When in `'base_mode'` state, render the base at center (reuse existing base rendering), the player ship at base, and an upgrade panel.
- The upgrade panel can reuse the pattern from `UpgradePanel.ts` — list of upgrades with costs, click to buy.
- Add a prominent "START RUN" button (large, centered below the upgrade panel). Clicking it calls `startRun()` and transitions to `'run_active'`.
- Display current currency prominently at the top.

**Applying persistent upgrades:**
- On `startRun()`, read `baseUpgrades` from `SaveData` and apply:
  - `homeBase.maxHealth = 500 + baseHpLevel * 100`, `homeBase.health = homeBase.maxHealth`
  - `TowRopeSystem.MAX_TOWED = 8 + salvageCapLevel * 2`
  - `player.energy = startingEnergyLevel * 25`
  - `maxDefenses = 3 + defenseSlotsLevel * 1`

---

## 6. Phase 3 — Combat Depth (stretch)

### 6.1 Combo System

Abilities interact when used in sequence.

**Implementation:**
- Add two fields to the player: `lastAbilityUsed: string | null` and `lastAbilityTime: number`.
- When an ability activates, check if `lastAbilityUsed` was set within the last 3 seconds. If it matches a combo pair, apply the bonus. Then update `lastAbilityUsed` and `lastAbilityTime`.
- Do NOT build a generic status effect system, buff tracker, or effect registry. Just hardcode the 3 combo checks.

**Combos:**
| Sequence | Bonus |
|----------|-------|
| Blast → Drone | Drone deals 2x damage for its full duration |
| HoT → Dash | Dash distance increased 50% |
| Dash → Blast | Blast radius increased 50% (200px → 300px) |

- Show floating text "COMBO!" in yellow when a combo triggers.
- That's it. Three `if` statements.

---

## 7. Design Pillars

1. **Flow state above all.** Every mechanic should serve the feeling of total absorption. The ticking clock, the ability rotation, the risk/reward of "one more cache" — always engaged, never waiting.

2. **Decisions, not chores.** Every moment should present a real choice. "Grab one more cache or head home?" is a decision. "Walk through empty space" is a chore. Minimize dead time.

3. **Readable chaos.** The rope physics, the swarm of blips, the expanding ping — it should look chaotic and feel controlled. The player who understands the systems sees order in the noise.

4. **Earned escalation.** Difficulty increases because the player chose to start another run, push further out, or stay out longer. Never punish the player for something outside their control.

---

## 8. Anti-Patterns — Do NOT

- Do NOT build a generic event bus, message system, or pub/sub. The codebase uses direct function calls and return values.
- Do NOT build a generic state machine library. Use simple `if/switch` on the `gameState` string.
- Do NOT build a generic wave spawner with config objects, phases, or scheduling. One function that spawns N enemies.
- Do NOT build abstract base classes or inheritance hierarchies for defense types. Use plain interfaces + factory functions matching the existing entity pattern.
- Do NOT add pathfinding, navmesh, or wall collision redirection. There are no walls.
- Do NOT create a persistence abstraction layer. Use `localStorage` directly with `JSON.parse`/`JSON.stringify`.
- Do NOT split the main game loop across multiple files. Keep update/render orchestration in `main.ts`.
- Do NOT add runtime dependencies.
- Do NOT over-engineer defense placement. No grid system, no drag-and-drop, no rotation. Press a key, defense appears.

---

## 9. Open Questions

- **Defense placement in base mode vs. during run** — can the player place defenses between runs (in base mode) using persistent currency, or only during runs using collected energy? Current design says during runs only. Between-run placement could be a persistent upgrade ("pre-built defenses" that auto-place at run start).
- **World reset between runs** — does the procedural world regenerate each run? It should (prevents memorization), but this means `World` needs a `reset()` method that clears all chunks and entities.
- **Player position during final wave** — does the player get teleported back to base when the wave starts, or do they fight from wherever they are? Teleporting is simpler and guarantees they're in position. Being stranded far away is punishing but creates tension.
