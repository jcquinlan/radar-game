# Radar Game — Full Design Audit

**Date:** 2026-03-16
**Themes inspected:** Classic, Ocean, Ember
**Files read:** 19 source files across rendering, UI, entities, systems, and themes

---

## 1. COLOR INVENTORY

The game uses a well-structured theme system with 3 palettes. Colors are centralized in `src/themes/themes.ts` and accessed via `getTheme()`. This is solid architecture.

| Color Token | Classic | Ocean | Ember | Semantic Role |
|---|---|---|---|---|
| `radar.primary` | `#00ff41` | `#00d4ff` | `#ff6622` | Primary identity color |
| `entities.enemy` | `#ff4141` | `#ff5566` | `#ff2244` | Threat / danger |
| `entities.resource` | `#00ff41` | `#00d4ff` | `#ff6622` | Same as radar primary — collectible |
| `entities.ally` | `#4488ff` | `#44ff88` | `#ffaa22` | Friendly |
| `entities.salvage` | `#ffaa00` | `#ffcc33` | `#cc88ff` | High-value pickup |
| `entities.dropoff` | `#ffdd00` | `#ffee55` | `#ffdd66` | Deposit zone |

### Hardcoded colors NOT in theme system

These colors are hardcoded outside the theme system and break consistency when switching themes:

- Home base rendering: `rgba(100, 220, 255, ...)` — cyan, hardcoded in `main.ts`
- Turret projectiles: `#00ddff` — hardcoded in `main.ts`
- Orbit bot: `#00ffff` — hardcoded in `main.ts`
- Orbit bot projectiles: `#00ffff` — hardcoded in `main.ts`
- Defense hint text: `rgba(170, 220, 170, 0.85)` — hardcoded in `HUD.ts`
- Start run button: `#00ff41` — hardcoded in `main.ts`
- HP bar text: `#ffffff` — hardcoded in `HUD.ts`
- Run timer: `#ffffff`, `rgba(255, 60, 60, ...)`, `rgba(255, 200, 60, ...)` — hardcoded in `HUD.ts`
- Minimap home base: `#64dcff`, `rgba(100, 220, 255, ...)` — hardcoded in `Minimap.ts`
- Repair station cross: green — hardcoded in `main.ts`

---

## 2. VISUAL HIERARCHY ASSESSMENT

### Tier 1 — Gameplay-Critical

| Element | Current State | Assessment |
|---|---|---|
| **Player position** | Green triangle at screen center, shadowBlur 6 | Good. Always centered, always visible. The heading indicator is clear. |
| **Enemy positions** | Red circles, size varies by subtype (3-7px), pulse animation | Good. Enemies are visually distinct from resources. Ghost blips (dashed ring + "?") for last-known positions are excellent design. |
| **Health bar** | Top-left, 200x16px, green fill, white text overlay | Adequate but could be better. White text on green bar has variable contrast. No color change as health drops — player must read numbers or estimate fill level. |
| **Damage feedback** | Screen shake + red vignette + damage distortion shader | Strong. Multi-layered feedback is excellent. Vignette uses radial gradient with theme-aware colors. |
| **Ping circle** | Expanding green ring with trailing echo, shadowBlur 20 | Very good. The "heartbeat" of the game is visually prominent. The secondary trailing ring adds depth. |

### Tier 2 — Important Info

| Element | Current State | Assessment |
|---|---|---|
| **Energy counter** | Text only, "Energy: 42", top-left below health bar | Weak. Just a number — hard to read at a glance during action. No visual emphasis when gaining/losing energy. |
| **Score** | Top-right, 16px text with shadowBlur 5 | Fine. Score is secondary info and appropriately styled. |
| **Abilities** | Bottom-center, 64px boxes, cooldown fill animation, charge dots | Good. Large keybind labels, color-coded borders, fill-from-bottom cooldown is intuitive. |
| **Upgrades** | Right-side panel, toggle with E key | Adequate. Panel appearance is functional but visually plain — no visual hierarchy between affordable and unaffordable upgrades beyond color. |
| **Tow rope / salvage** | Amber bezier curves, diamond blips, shadowBlur 4-8 | Good. Visually distinct from other elements. Damage flash (white overlay) provides clear feedback when salvage is hit. |
| **Dropoff zones** | Pulsing gold rings, center diamond | Good. Visually distinct, pulsing draws attention. |
| **Run timer** | Top-center, 20px bold, white normally, pulsing red under 20s | Good. Pulsing red in final seconds is effective urgency communication. |
| **Minimap** | Bottom-left, 160px collapsed, expandable | Good feature. Collapsed is unobtrusive, expanded provides strategic overview. |

### Tier 3 — Ambient/Decorative

| Element | Current State | Assessment |
|---|---|---|
| **Ambient particles** | Two layers (deep: large/faint, foreground: small/brighter), parallax | Good. Subtle, adds depth without distraction. Deep layer at 0.8-2% alpha is appropriately faint. |
| **Motion trails** | Velocity-based streaks, max 12 points, fading alpha | Good. Provides speed feedback without clutter. Only appears on fast-moving entities. |
| **Scanlines** | Horizontal lines every 3px, theme-aware color | Good. Adds CRT-monitor flavor. Appropriately subtle. |
| **Bloom shader** | Threshold 0.3, intensity 0.3, 13-tap star blur | Good defaults. Adds glow to bright elements without washing out the image. |
| **Death particles** | Pool-based, 0.4-0.65s lifetime, speed 100-250 | Functional. Provides satisfying enemy death feedback. |
| **Sweep flash effects** | Expanding circles on ping contact, 0.3s duration, shadowBlur 20 | Good. Brief and informative — marks where ping interacted with entities. |

---

## 3. PROBLEMS FOUND

### P0 — Blocks Playability

**None found.** The game is playable in its current state. All critical information is visible.

### P1 — Significant Improvement

#### P1-1: Health bar doesn't communicate urgency

**File:** `src/ui/HUD.ts`
**Problem:** The health bar fill color stays the same (`theme.ui.textPrimary` = green) regardless of health level. Player must mentally calculate their health percentage from the bar length or read the small white text. At low health, nothing screams "you're about to die" — the bar just gets shorter.

**Recommendation:**
- Interpolate bar fill color from green → yellow → red as health drops (thresholds: >60% green, 30-60% yellow, <30% red)
- At <25% health, add a slow pulse to the bar (scale the bar fill alpha between 0.7-1.0 at ~2Hz)
- At <15% health, add a subtle red border pulse around the entire HUD area
- The base HP bar already does color interpolation (lines 65-68) — use the same technique for the player HP bar

#### P1-2: Energy has no visual weight

**File:** `src/ui/HUD.ts`
**Problem:** Energy is the game's primary currency (used for upgrades, score component) but it's displayed as plain text. There's no visual indication of whether you're energy-rich or energy-poor, no celebration when you gain energy, no anxiety when you spend it.

**Recommendation:**
- Add a small energy bar below the text (similar width to health bar, amber/gold fill using `theme.entities.salvage`)
- The bar should show energy relative to the cheapest available upgrade cost (e.g., if cheapest upgrade is 50E and you have 45E, bar is 90% full)
- When energy is gained, briefly flash the text gold with a scale pulse (+10% for 0.15s)
- When energy is spent, briefly flash red

#### P1-3: Hardcoded colors break theme consistency

**Files:** `src/main.ts`, `src/ui/HUD.ts`, `src/ui/Minimap.ts`
**Problem:** ~12 color values are hardcoded outside the theme system. When switching to Ocean or Ember theme, home base, turrets, orbit bots, and several HUD elements stay in Classic-theme colors (cyan, green). This breaks visual coherence.

**Recommendation:**
Add to each theme definition:
- `entities.homeBase`: color for home base rendering
- `entities.turret`: color for turret body and projectiles
- `entities.repairStation`: color for repair station
- `entities.orbitBot`: color for orbit bot body and projectiles
- `ui.buttonFill`: color for interactive buttons (Start Run, etc.)
- `ui.timerNormal`, `ui.timerWarning`, `ui.timerCritical`: run timer colors
- Then replace all hardcoded values in `main.ts`, `HUD.ts`, and `Minimap.ts`

#### P1-4: No onboarding — new players are dropped into an empty void

**Files:** `src/main.ts`, `src/ui/HelpScreen.ts`
**Problem:** The help screen exists but must be explicitly opened. First-time players see a dark screen, a health bar, and nothing else until the first ping fires. There are no contextual hints for salvage pickup, dropoff deposit, ability usage, or the upgrade panel. The game's unique controls (tank-style steering) are not taught.

**Recommendation:**
- On first launch (check `localStorage` flag), show a brief 3-line overlay: "WASD to move. Ping reveals the world. Collect energy. Survive."
- Add contextual one-time hints:
  - First time near salvage: "Fly close to attach salvage"
  - First time towing near dropoff: "Enter the gold zone to deposit"
  - First time at 20+ energy: "Press [E] to open upgrades"
  - First time ability comes off cooldown: "Press [1-4] to use abilities"
- Hints should appear as floating text at bottom-center, 2s duration, fade out
- Track shown hints in `localStorage` — each hint shows once ever

### P2 — Nice Polish

#### P2-1: Resource blips look identical to radar primary

**File:** `src/themes/themes.ts`, `src/radar/BlipRenderer.ts`
**Problem:** In the Classic theme, resources are `#00ff41` — the exact same color as the radar rings, ping, and player indicator. Resources visually blend into the radar infrastructure. The player must rely on position context (not on the radar ring = must be an entity) rather than color to identify resources.

**Recommendation:**
- Shift resource color to be distinct from radar primary. Options:
  - **Classic:** Change resource to `#44ffaa` (mint green — still green family, clearly different from `#00ff41`)
  - **Ocean:** Change resource to `#44eeff` (lighter cyan — distinct from `#00d4ff`)
  - **Ember:** Keep as-is (resource already matches primary, but ember's orange is warm enough that entities pop against the dark background)
- Alternatively, give resources a distinct shape: small diamond instead of circle (currently all non-salvage entities are circles)

#### P2-2: Ally subtypes are hard to distinguish at a glance

**File:** `src/radar/BlipRenderer.ts`
**Problem:** All allies are 4px circles with different colors. Healer (blue), Shield (cyan), and Beacon (yellow-green) rely entirely on color differentiation. At speed, with bloom effects, these can blur together — especially healer vs. shield in Classic theme (`#4488ff` vs `#00ffff`).

**Recommendation:**
- Give each ally subtype a secondary visual cue beyond color:
  - **Healer:** Cross/plus shape (render as two overlapping small rects, 2px wide) — universal healthcare symbol
  - **Shield:** Hexagon outline (6-sided, suggests protective barrier)
  - **Beacon:** Pulsing concentric rings (already has range indicator, make it slightly more visible — bump opacity from 0.06 to 0.10)
- These shapes also solve colorblind accessibility (see Accessibility section)

#### P2-3: Upgrade panel is functionally plain

**File:** `src/ui/UpgradePanel.ts`
**Problem:** The upgrade panel works but doesn't feel like part of a radar console. It's a flat list with minimal visual interest. No visual indication of *what* each upgrade does — just text names and costs.

**Recommendation:**
- Add a small icon/glyph for each upgrade (rendered procedurally):
  - sweep_speed: small clock/arc shape
  - sweep_range: expanding circle
  - radar_resolution: small crosshair
  - hull_armor: shield hexagon
  - engine_speed: arrow/chevron
  - energy_magnet: small dot with pull lines
- These can be simple 12x12px shapes drawn with Canvas 2D — no sprites needed
- Add a subtle "can afford" glow: when an upgrade is purchasable, give its row a faint border pulse (already has `highlightSubtle` background, add a 0.5Hz alpha oscillation to the border)

#### P2-4: Game over screen is static and anticlimactic

**File:** `src/ui/GameOverScreen.ts`
**Problem:** "SIGNAL LOST" appears instantly with no animation. Stats appear all at once. The restart button has no hover state. The screen feels like a debug readout rather than a dramatic moment.

**Recommendation:**
- Animate "SIGNAL LOST" appearance: fade in over 0.5s, with a brief screen-wide static/noise effect (reuse damage distortion at 0.3 intensity for 0.3s)
- Stagger stat lines: each stat appears 0.2s after the previous, fading in
- Highlight the player's best stat (highest relative to historical average — would need localStorage tracking) in gold
- Restart button: on hover (mouse within bounds), brighten border to full radar primary color and add faint glow

#### P2-5: No visual feedback when buying upgrades

**Files:** `src/systems/UpgradeSystem.ts`, `src/ui/UpgradePanel.ts`
**Problem:** Clicking an upgrade deducts energy and applies the effect, but there's no visual confirmation. No flash, no particle, no sound. The player must check the level bar to confirm the purchase went through.

**Recommendation:**
- On purchase: brief white flash on the upgrade row (0.15s)
- Floating text "+1" in radar primary color, rising from the upgrade row
- Brief screen-wide pulse (very subtle — 0.05 alpha flash of radar primary for 0.1s)
- If purchase fails (insufficient energy): brief red flash on the cost text

### P3 — Aspirational

#### P3-1: Dynamic radar ring response

**Problem:** The radar rings are static. They don't respond to anything happening in the game — they're just backdrop.

**Recommendation:**
- When the ping fires, very briefly (0.05s) brighten the radar rings to full opacity, then fade back. This makes the rings feel connected to the ping system.
- When damage is taken, briefly distort the rings (tiny random offset, 0.1s). The radar is "shaking" from the impact.
- When entering a high-threat zone, subtly shift ring opacity or add a faint red tint to the outermost ring.

---

## 4. UX REVIEW

### Information Clarity

| Question | Assessment |
|---|---|
| Can the player always see health? | Yes — top-left, always visible. But needs urgency communication (see P1-1). |
| Can the player see energy? | Yes, but it's visually weak (see P1-2). |
| Can the player see threats? | Yes — enemy blips are red, threat level text in corner. Ghost markers for out-of-sight enemies are excellent. |
| Is anything hidden that shouldn't be? | The minimap is available but not obvious to discover. Upgrade descriptions are tiny (10px) and easy to miss. |
| Is anything visible that should be hidden? | FPS counter (bottom-left) is appropriately subtle. Coordinates are niche info — could be gated behind radar_resolution upgrade level 3. |

### Control Feedback

| Input | Feedback | Gap |
|---|---|---|
| Thrust (W/S) | Ship moves, motion trail appears at speed | No immediate visual feedback at low speed — could add subtle engine particle behind player |
| Turn (A/D) | Ship rotates, world rotates | Good — rotation is immediately visible |
| Ability (1-4) | Blast ring / regen glow / drone spawn flash / dash velocity | Good — each ability has distinct visual feedback |
| Upgrade purchase | Energy number decreases, level bar increases | Missing immediate confirmation (see P2-5) |
| Salvage pickup | No dedicated feedback | Missing. When salvage attaches, there should be a brief flash or "ATTACHED" floating text |
| Salvage deposit | Floating "+50" text | Adequate but could be more celebratory (see Juice Pass) |

### Cognitive Load

- **Moment-to-moment:** Low-medium. Player watches radar, manages heading, and reacts to enemies. This is well-tuned.
- **Decision-making:** The upgrade panel presents 6 choices at once. This is manageable. Cost-to-benefit is clear from descriptions.
- **Ability management:** 4 abilities with cooldowns. The ability bar does a good job showing availability. Charge indicators (dots) for multi-charge abilities are clean.
- **New player burden:** High. No onboarding, tank controls are unusual, multiple systems (ping, salvage, upgrades, abilities, home base) are all present from the start. See P1-4.

### Navigation

| Path | Method | Clear? |
|---|---|---|
| Pause | Escape key | Yes — standard |
| Upgrade panel | E key (remappable) | Not discoverable without help screen |
| Keybinds | K key | Not discoverable |
| Help | H key | Not discoverable |
| Minimap expand | M key | Not discoverable |
| Restart | Pause menu or game over | Yes |
| Theme switch | Pause menu | Yes |
| Shader toggle | Pause menu | Yes |

**Key finding:** 4 out of 6 navigation paths require knowing a specific key that is never shown on screen during gameplay. The defense hint (`[T] Turret | [R] Repair`) is a good model — similar contextual hints should appear for other actions.

---

## 5. JUICE PASS

### Current Feedback Inventory

| Player Action | Visual Feedback | Audio | Rating |
|---|---|---|---|
| Thrust | Motion trail at high speed | None | Weak at low speed |
| Turn | World rotates | None | Adequate |
| Ping fires | Expanding green ring + trailing echo | None | Strong |
| Collect resource | Sweep flash + floating "+N" text | None | Adequate |
| Take damage | Screen shake + red vignette + damage distortion shader + floating damage number | None | Strong |
| Kill enemy | Death particles + floating "+50" text | None | Good |
| Use Blast | Red expanding ring + screen shake | None | Good |
| Use Heal | Green pulsing ring around player | None | Adequate |
| Use Dash | Instant velocity burst | None | Weak — no visual burst |
| Use Missile | Spawn flash at launch point | None | Adequate |
| Pick up salvage | Nothing specific | None | Missing |
| Deposit salvage | Floating "+50" text per item | None | Weak |
| Buy upgrade | Level bar increases | None | Missing |
| Die | Game over screen appears | None | Weak — needs drama |

### Recommended Juice Additions (Priority Order)

#### J1: Dash Visual Burst (P1)

**Trigger:** Dash ability activated
**File:** `src/main.ts`, `src/radar/AbilityEffects.ts`
**Effect:**
- Spawn 6-8 particles behind the player in a cone opposite to heading direction
- Particles: speed 150-250px/s, lifetime 0.3s, size 3-5px, color `theme.abilities.dash`
- Brief white flash (1 frame) on the player heading indicator
- Existing screen shake at intensity 3, duration 0.08s (short, sharp)

#### J2: Salvage Pickup Flash (P1)

**Trigger:** Salvage item enters pickup range (25px) and attaches
**Files:** `src/systems/TowRopeSystem.ts`, `src/main.ts`
**Effect:**
- Brief expand-and-fade circle at salvage position: start radius 5px, expand to 20px over 0.2s, alpha 0.8 to 0
- Color: `theme.entities.salvage`
- Floating text "ATTACHED" in salvage color, 0.8s duration
- Subtle screen shake: intensity 2, duration 0.08s

#### J3: Salvage Deposit Celebration (P2)

**Trigger:** Salvage deposited at dropoff zone
**Files:** `src/systems/TowRopeSystem.ts`, `src/main.ts`
**Effect:**
- 12-16 particles burst outward from deposit point (reuse DeathParticles system)
- Particles: gold color (`theme.entities.salvage`), speed 80-180px/s, lifetime 0.5s
- Floating text "+50E" in gold, slightly larger than normal (16px instead of 14px)
- Dropoff zone briefly brightens: pulse alpha to 0.3 for 0.2s, then fade back to 0.04
- Screen shake: intensity 3, duration 0.1s

#### J4: Upgrade Purchase Flash (P2)

**Trigger:** Successful upgrade purchase
**Files:** `src/ui/UpgradePanel.ts`
**Effect:**
- White flash overlay on the purchased row (alpha 0.3 to 0 over 0.2s)
- Level bar fill segment that just appeared briefly glows brighter (alpha pulse 1.0 to 0.7 over 0.3s)
- Energy counter text briefly flashes red (0.1s) to acknowledge the spend

#### J5: Low-Speed Thrust Particles (P3)

**Trigger:** Player thrust input active (W key held)
**Files:** `src/main.ts`
**Effect:**
- 1-2 tiny particles emitted behind player (opposite heading) per frame when thrusting
- Size 1-2px, speed 20-40px/s, lifetime 0.3s, color `theme.radar.primary` at alpha 0.3
- Stops immediately when thrust released
- Very subtle — more "the engine is on" than "dramatic exhaust"

---

## 6. ACCESSIBILITY AUDIT

### Color Vision (P0)

| Check | Pass? | Notes |
|---|---|---|
| No info by color alone | **FAIL** | Enemies vs. resources rely primarily on red vs. green — the most common colorblind confusion (protanopia/deuteranopia). Enemies are circles, resources are circles. Size difference (3-7px vs 3px) helps but is subtle. |
| Red/green not sole friend/foe differentiator | **FAIL** | In Classic theme, enemies are `#ff4141` and resources are `#00ff41` — pure red vs. pure green. With protanopia, both appear as similar olive/brown tones. |
| Colorblind alternatives documented | **FAIL** | No colorblind mode exists. |

**Recommendation (P1):**
- Give enemies a distinct **shape**: triangle (pointing toward player) instead of circle. This instantly differentiates friend from foe regardless of color vision.
- Give resources a distinct shape: small square or plus sign instead of circle.
- Consider adding a colorblind palette option to the theme system (high-contrast blue/orange palette that avoids red/green entirely).

### Contrast & Readability (P0)

| Check | Pass? | Notes |
|---|---|---|
| Critical text 4.5:1 contrast | **PASS** | Green text on near-black background exceeds 4.5:1 in all themes. |
| Health bar readable at a glance | **PARTIAL** | Bar fill is visible but white text on green bar drops below 3:1 when bar is full. Add a dark text shadow or dark bar behind the text. |
| Entity blips distinguishable at min size | **PARTIAL** | 3px circles (resources, scouts) are very small. On high-DPI displays they're fine, but on standard displays they can be hard to spot. |
| Floating text readable | **PASS** | Uses shadowBlur which provides consistent contrast against any background. |

### Controls (P1)

| Check | Pass? | Notes |
|---|---|---|
| All controls remappable | **PARTIAL** | Ability keys and upgrade key are remappable. Movement keys (WASD/arrows) are NOT remappable. This blocks players who need alternative layouts (ESDF, one-handed, etc.). |
| Controls documented on screen | **FAIL** | Help screen exists but must be discovered (H key). No on-screen indicator. |
| No simultaneous key presses required | **PASS** | All actions are single-key. Thrust + turn simultaneously is natural on WASD. |

### Motion Sensitivity (P1)

| Check | Pass? | Notes |
|---|---|---|
| Screen shake disableable | **FAIL** | No setting to reduce/disable screen shake. |
| Post-processing disableable | **PASS** | Toggle in pause menu. |
| Flash frequency capped | **PARTIAL** | Damage flash triggers per-hit with no frequency cap. Rapid-fire ranged enemies could cause multiple flashes per second. |
| Particle reduction option | **FAIL** | No setting to reduce ambient particles. |

**Recommendation:**
- Add "Screen Shake: ON/OFF" toggle to pause menu
- Add "Reduced Motion: ON/OFF" toggle that disables: screen shake, ambient particles, motion trails, and reduces damage flash duration by 50%
- Cap damage flash to max 3 per second (skip flash if previous flash was <0.33s ago)

---

## 7. GAME FEEL ASSESSMENT

### Movement

**Current feel:** Weighty, inertial, submarine-like. Turn inertia (`turnFriction: 3.0`) makes steering feel deliberate. Movement friction (2.0) gives a satisfying coast.
**Target feel:** This is well-tuned for the radar-submarine fantasy. Don't change it.
**Gap:** None significant. The base speed (80) feels appropriate for the world scale.
**Priority:** No changes needed.

### Combat — Blast Ability

**Current feel:** Satisfying. Red expanding ring + screen shake + enemies taking damage is a clear, powerful moment.
**Target feel:** Already close to target.
**Gap:** Minor — no hitstop. A 2-frame pause (0.033s) on blast impact would add significant "oomph."
**Priority:** P3

### Combat — Dash Ability

**Current feel:** Functional but flat. The player gets a velocity burst, but visually it's just "suddenly faster." No sense of power, no buildup/release.
**Target feel:** Sharp, instant, forceful — like the player's ship just kicked into overdrive for a split second.
**Gap:** Missing visual burst (see J1 in Juice Pass). Missing camera lead (camera should briefly offset in the dash direction by ~10px, then ease back over 0.3s).
**Priority:** P1

### Collection — Resources

**Current feel:** Adequate. Ping sweep → flash → floating text → energy number increases. The chain is complete.
**Target feel:** Slightly more satisfying. Resources are the game's bread and butter — collecting them should feel like picking up coins in a Mario game.
**Gap:** Missing scale pulse on the blip at moment of collection. Missing a brief "attract" animation (blip slides toward player over 0.1s before disappearing, rather than vanishing instantly).
**Priority:** P2

### Collection — Salvage Deposit

**Current feel:** Anticlimactic. Depositing salvage — the game's highest-value action (+50E per item) — has the same visual weight as collecting a 10E resource. Just floating text.
**Target feel:** This should be the most satisfying moment in the game. Dragging salvage through danger back to a dropoff is the core risk/reward loop. The payoff should feel earned.
**Gap:** Missing particle burst, missing deposit animation, missing sound (N/A), missing camera response. See J3 in Juice Pass.
**Priority:** P1

---

## 8. PRIORITIZED ACTION PLAN

### Phase 1 — High Impact, Low Effort (do first)
1. **P1-1:** Health bar color interpolation (green → yellow → red)
2. **P1-3:** Move hardcoded colors into theme system (prevents theme-switching bugs)
3. **J1:** Dash visual burst (particles + flash)
4. **J2:** Salvage pickup flash (attached notification)

### Phase 2 — Important Polish
5. **P1-2:** Energy visual weight (bar + flash on gain/spend)
6. **P2-2:** Ally subtype shapes (cross, hexagon, rings)
7. **J3:** Salvage deposit celebration (particles + zone pulse)
8. **Accessibility:** Enemy shape differentiation (triangles for enemies)

### Phase 3 — Nice-to-Have
9. **P1-4:** Contextual onboarding hints
10. **P2-4:** Game over screen animation
11. **P2-5:** Upgrade purchase feedback
12. **Motion sensitivity:** Screen shake toggle, reduced motion mode

### Phase 4 — Aspirational
13. **P3-1:** Dynamic radar ring response
14. **J5:** Thrust particles

---

## 9. GAME DIRECTION PROPOSALS

Three complete proposals for where this game goes next. Each one covers both **art direction** (the visual identity question) and **gameplay loop structure** (the "what am I actually doing for 10 minutes and why does every mechanic earn its place" question).

The current state: the foundation is strong. Tank controls feel good. Ping-as-perception is a great core conceit. Salvage towing has satisfying physics. The base → run → wave → results loop exists. But right now the 60-second run is mostly unstructured — you fly around, grab stuff, the timer expires, you fight a wave. The mechanics exist side-by-side rather than interlocking. These proposals aim to make every system *need* the others.

---

### Proposal A: "The Salvage Run" — Lean Into What Works

**Art Direction: Refined Radar Console**

Don't reinvent the visual identity — just commit to it harder. The neon-on-black radar aesthetic is well-trodden but *this game has a reason to use it*: the radar isn't decoration, it's the game mechanic. The visual direction should feel less "Geometry Wars neon party" and more "the last working console on a derelict station."

Key shifts:
- **Desaturate the palette 20-30%.** Current colors are screaming-bright. Pull them down so that *only* gameplay-critical elements (enemies, your own ping) are at full saturation. Ambient elements, UI chrome, and decorative effects should feel dim and tired — a console that's been running too long.
- **Introduce noise/grain to the background.** Not a shader — just a subtle per-frame random variation (±2%) in the background fill color. Makes the void feel like a CRT that's slightly unstable, not a clean digital display.
- **Warm the greens toward amber.** Instead of pure phosphor green (#00ff41), shift to a warmer green-gold (#44cc44 or even #66aa33). This reads as "old CRT phosphor" rather than "Matrix screensaver." The Ocean and Ember themes already show this can work with different hues.
- **Typography as world-building.** The monospace text is correct but generic. Lean into the console aesthetic: angular brackets around labels (`[HP] 85/100`), dot-leader padding between label and value (`RANGE....1250m`), abbreviated military-style labels (`TGT: 3 HOSTILE`, `SALVAGE: 2 TOW`).

Why this and not something new: The radar conceit is the game's best idea. The art direction should *serve* it, not compete with it. Making it look more authentic is more impactful than making it look different.

**Gameplay Loop: Salvage as the Spine**

The core insight: **salvage should be the verb that connects every other system.** Right now salvage is one of several things you can do during a run. It should be *the* thing. Everything else exists to support or complicate it.

**The run, redesigned:**

The 60-second timer stays (or stretches to 90-120s after tuning). But now there's a clear objective structure within the run, not just "do stuff until the timer expires."

**Pre-run (base mode):**
- You see the home base, your defenses, your currency.
- You see a **salvage manifest**: "This run: 5 salvage targets." These are pre-placed in the world at the start of the run — they don't spawn randomly per-chunk. The player sees approximate directions on the minimap (N, NE, SE, etc.) but not exact positions. This gives the run *direction* — you're not just wandering.
- Start the run.

**During the run — the tension triangle:**

Every second of the run, the player is navigating a three-way tension:

1. **Salvage retrieval** — find salvage, fly to it, attach it, haul it back. This is the primary objective. Salvage is the only way to earn meaningful currency. Resources (energy blips) are pocket change by comparison.

2. **Preparation spending** — energy collected from resources and enemy kills buys in-run upgrades and defenses. But every second spent farming energy or placing turrets is a second *not* spent retrieving salvage. The player must decide: "Do I grab one more salvage from the far side of the map, or do I head home early and spend my remaining time fortifying?"

3. **Clock pressure** — the timer is always ticking. The further out you go for salvage, the more time you spend traveling, and the less time you have to prepare defenses. Distance = risk.

**Why every mechanic earns its place:**

| Mechanic | Role in the Loop | What Happens If You Remove It |
|---|---|---|
| **Ping/radar** | Your only way to *find* salvage and enemies. Upgrading ping range/speed directly determines how efficiently you can locate targets. | You can't find anything. Game doesn't work. |
| **Tank controls + inertia** | Makes navigation a *skill*. Tight corridors between enemy camps require real piloting. Towing salvage while maneuvering around threats is the game's core challenge. | Movement becomes trivial, salvage towing loses tension. |
| **Salvage towing** | The primary objective. Salvage drags behind you, slows you down, attracts enemies (see below). Depositing it at base is the main score/currency source. | No objective. Just killing enemies until timer runs out. |
| **Enemy subtypes (scout/brute/ranged)** | Each threatens salvage runs differently. Scouts chase you down — dangerous when towing because you're slower. Brutes block paths — you must go around or blast through. Ranged enemies shoot your salvage from a distance, forcing you to either kill them or shield the cargo. | Combat becomes uniform. No reason to approach different encounters differently. |
| **Energy + upgrades** | The decision currency. Energy comes from resources and kills. You spend it on in-run upgrades (ping range to find more salvage, engine speed to haul faster, armor to survive the trip). Every energy point spent on upgrades is a point *not* spent on defenses. | No progression within a run. First minute feels the same as last minute. |
| **Abilities (blast/heal/dash/missile)** | Tactical tools for salvage protection. Blast clears a path. Heal sustains you through damage while towing. Dash covers ground fast (but hard to control with salvage trailing). Missile picks off ranged enemies threatening your cargo from afar. | Combat is passive (just fly into enemies). No skill expression. |
| **Defenses (turret/repair)** | Investment in the final wave. Turrets placed during the run persist into the wave. More turrets = easier wave. But turrets cost energy you could spend on upgrades. Repair stations keep you alive during defense. | Final wave is pure ability-spam. No strategic layer to base defense. |
| **Final wave** | The payoff. Everything you did during the run — salvage deposited, defenses placed, upgrades purchased — determines whether you survive. The wave tests your preparation. | No climax. The run just... ends. |
| **Home base HP** | Stakes. If the base dies, you lose most of your currency. This makes defense placement meaningful — it's not just about the player surviving, it's about protecting the reward. | No consequence for ignoring defenses. Just kite enemies forever. |
| **Allies (healer/shield/beacon)** | Safety nets in the field. Healer patches you up between salvage runs. Shield gives you damage reduction for a risky grab. Beacon provides passive energy while you're nearby — a rest stop. | Field exploration is pure attrition. No recovery options outside abilities. |
| **Difficulty scaling (distance)** | Salvage further from base is worth more (currently flat 50E — this would need to change). Far salvage is harder to retrieve because enemies are tougher, the trip is longer, and you're further from your defenses if things go wrong. | No reason to explore further. Grab the closest salvage and camp. |

**What changes from current implementation:**
- Salvage spawns pre-determined per run (5-8 targets), shown on minimap as approximate directions
- Salvage value scales with distance from base (50E at close range, up to 150E at far range)
- Enemies are mildly attracted to towed salvage (aggro range +50% when player is towing) — this makes hauling feel dangerous
- Remove dropoff zones entirely — home base is the only deposit point. This simplifies the map and makes "getting back" always the objective.
- Remove beacons (ally subtype). The passive energy mechanic doesn't serve the loop — it encourages camping, not moving. Healers and shields stay because they serve the "patch up and head back out" rhythm.

**What to cut entirely:**
- Beacon allies (encourages static play)
- Dropoff zones (redundant with home base deposit)
- Score display (replace with "Salvage: 2/5 deposited" — a clear objective counter)
- Coordinates display (thematic but adds no gameplay value — minimap does this better)

---

### Proposal B: "Deep Signal" — Something Stranger

**Art Direction: Sonar/Hydrophone — Pressure and Depth**

Drop the CRT/military radar metaphor entirely. Instead: **you are a deep-sea probe descending into an ocean trench.** The visual language shifts from "radar screen in a dark room" to "bioluminescent shapes in crushing blackness."

Key shifts:
- **No grid lines or rings.** The radar display chrome disappears. Instead, the ping is a sonar pulse — same expanding circle mechanic, but it renders as a pressure wave: a subtle ripple distortion that reveals entities as they're washed over. Entities don't appear as blips on a screen — they *glow into existence* as the sonar touches them and then *fade back into darkness* over 2-3 seconds.
- **Color palette: bioluminescent.** Deep blue-black background (#040812). Entities glow in organic colors: resources are soft blue-white (like plankton), enemies are deep red-orange (like anglerfish lures), allies are gentle green (like phosphorescent algae), salvage is bright amber-gold (like volcanic thermal vents). No neon. Everything emits its own light rather than being illuminated by a radar sweep.
- **Parallax becomes depth.** The two ambient particle layers are no longer "foreground/background" — they're "shallow/deep." Deep particles are large, slow, faint (like distant whale shapes). Foreground particles are tiny, fast, bright (like disturbed plankton).
- **Pressure vignette replaces radar vignette.** Instead of darkness outside the ping range, the edges of the screen have a subtle blue-shift and barrel distortion — like looking through a diving helmet. The deeper (further from base) you go, the more pronounced this effect becomes.
- **Sound design language (even without audio).** Floating text for damage should feel different: instead of sharp red numbers, show pressure cracks — brief white fracture lines radiating from the impact point. Healing shows gentle bubble particles rising.

Why this might work: It's genuinely different from every other neon-radar-game on itch.io. The deep-sea pressure metaphor gives the distance-scaling mechanic a *physical* justification — you're descending deeper, where the creatures are more dangerous. And it opens visual territory that's underexplored in code-art games.

Why it might not: It's a much bigger visual overhaul. The current radar-ring rendering, scanlines, and CRT aesthetic would all need reworking. And "deep sea" is harder to render procedurally than "radar screen" — organic bioluminescence is harder to fake with geometric shapes than phosphor dots.

**Gameplay Loop: Depth as Progression**

Same structural bones as Proposal A (salvage is the verb, timer creates pressure, wave is the climax), but the metaphor of *depth* replaces *distance* and adds a vertical dimension to decision-making.

**The depth mechanic:**

The world isn't just a flat plane — it has conceptual "depth layers" that increase with distance from base. These aren't literal 3D — they're zones rendered with increasing visual intensity (darker background, more particles, more distortion).

- **Shallows (0-500px from base):** Safe. Low-value salvage (30E). Weak enemies. Bright, clear visibility.
- **Midwater (500-1500px):** Moderate. Standard salvage (50-80E). Mixed enemy types. Slight blue-shift vignette.
- **Deep zone (1500-3000px):** Dangerous. High-value salvage (100-150E). Strong enemies, more of them. Heavy vignette, reduced effective visibility (entities fade faster after ping).
- **Abyss (3000px+):** Extreme. Rare ultra-salvage (200E+). Elite enemies. Visibility severely limited — entities only stay visible for 1 second after ping instead of the normal duration. The screen edges pulse with pressure warnings.

This makes the exploration/risk tradeoff *visible*. The player can *see* they're going deeper. The screen itself tells them they're in danger.

**Changes from current implementation:**
- Same salvage-as-spine design as Proposal A
- Add depth-zone rendering (4 zones, visual intensity scales with distance)
- Entity visibility duration decreases with depth (currently entities stay visible until next ping — in deep zones, they'd fade after 1-2 seconds)
- Ping range decreases in deep zones (pressure interference) — upgradeable to counteract
- Replace corridors (8 cardinal axes) with "thermal vents" — specific deep-zone paths that have higher salvage density but also higher enemy density
- Remove turrets/repair stations (don't fit the probe metaphor). Replace with consumable items: **sonar buoys** (placed in the world, provide persistent visibility in a radius — like a turret but for information instead of damage) and **repair drones** (follow you for 30 seconds, auto-heal)

**What to cut:**
- Radar rings, scanlines, center crosshair (replace with sonar pulse aesthetic)
- Turrets and repair stations (replaced by buoys and drones)
- Beacon allies (same reasoning as Proposal A)
- Corridors (replaced by thermal vents)
- Home arrow indicator (replaced by a "depth gauge" on the HUD showing distance from base as a vertical bar)

---

### Proposal C: "Tighten the Screws" — Same Vision, Stripped Down

**Art Direction: Neon Radar, Done Right**

Keep the current visual identity but subtract rather than add. The problem with the current look isn't that it's neon-on-black — it's that it's *too much* neon-on-black. Everything glows. Everything pulses. When everything is bright, nothing is bright.

Key shifts:
- **Strict brightness budget.** Only 3 things on screen should be at full brightness at any given time: the player, the nearest threat, and whatever objective element matters right now (salvage you're towing, dropoff you're approaching, base you're defending). Everything else drops to 60% brightness or lower. This creates a natural focus hierarchy without changing any colors.
- **Kill the glow creep.** Currently: ping has shadowBlur 20, sweep effects have shadowBlur 20, ability effects have shadowBlur 12-15, missiles have shadowBlur 10, orbit bots have shadowBlur 10, dropoff zones have shadowBlur 8. That's 6+ glow sources competing for attention. Rule: **maximum 2 active shadowBlur elements at any time.** Ping glow is always one of them (it's the heartbeat). The second slot goes to whatever just happened (damage, ability, collection). Everything else uses the faked-glow technique (larger low-alpha circle behind the blip) which already exists in BlipRenderer.
- **Reduce motion trails to player-only.** Currently every fast entity leaves trails. This is visual noise. Only the player's trail matters — it communicates your speed and heading to you. Enemy trails just clutter the radar.
- **Scanlines: every 4px instead of 3px, opacity down 30%.** They should be barely perceptible — felt, not seen.

Why this works: You already have a good-looking game. The art direction doesn't need reinvention — it needs *editing*. The current version is a first draft where every visual idea that worked in isolation got included. The second draft is about removing things until only the essential visual language remains.

**Gameplay Loop: The Taut Run**

Same core structure (base → run → wave), but aggressively trimmed to eliminate dead time, redundant mechanics, and anything that doesn't create a *decision*.

**The problem with the current loop:** During a run, you can do too many things that don't interact. You can: explore, collect resources, fight enemies, find allies, pick up salvage, deposit salvage at dropoff zones, deposit at home base, place defenses, buy upgrades, use abilities. That's 10+ activities, and for most of the run, several of them don't matter. Resource collection is mindless (ping and fly through). Ally interaction is passive (just fly near them). Dropoff zones are disconnected from the base defense goal.

**Principle: every second of the run should present a choice between two things you want to do.**

**Stripped-down mechanic list (what stays):**

| Mechanic | Why It Stays |
|---|---|
| Ping/radar | Core perception mechanic. The game. |
| Tank controls + towing physics | Core navigation challenge. |
| Salvage (pre-placed, 5-6 per run) | Primary objective. |
| Home base (only deposit point) | Creates the "outbound/return" rhythm. |
| Energy + 4 upgrades (cut from 6) | In-run progression. See below. |
| 3 abilities (cut from 4) | Combat tools. See below. |
| 2 enemy types (cut from 3) | Enough variety without diluting. See below. |
| Defenses (turrets only) | Wave preparation. |
| Final wave | Climax. |

**What gets cut and why:**

| Cut | Reason |
|---|---|
| **Dropoff zones** | Redundant with home base deposit. Having two deposit mechanisms splits the player's attention without adding a real choice. One deposit point = one clear "home" direction. |
| **Beacon allies** | Passive energy gain rewards standing still. Antithetical to the time-pressure design. |
| **Ranged enemies** | Three enemy subtypes is one too many for 10 minutes of gameplay. Scouts (fast, fragile, chase you) and brutes (slow, tanky, block paths) create enough tactical variety. Ranged enemies add complexity without adding a meaningfully different *player decision*. Cut them, and the projectile rendering/collision code simplifies significantly. |
| **Homing missile ability** | Four abilities is one too many to keep track of in a panic. Three is the sweet spot (one offensive, one defensive, one mobility). Blast, Heal, and Dash stay. Missile is the most complex ability with the least intuitive behavior (launch spread? turn rate? distance-scaled tracking?). |
| **Radar resolution upgrade** | Shows entity labels. This is quality-of-life, not a meaningful power increase. The player learns to read the radar by playing — they don't need text labels. |
| **Energy magnet upgrade** | Auto-collection removes the decision of "do I detour for that resource cluster?" If energy is scarce enough to matter, the player should have to *choose* to collect it. |
| **Repair stations** | With only turrets as defenses, the defense placement decision is simpler: "where do I put my guns?" Repair stations add a second dimension (healing) that isn't necessary for the wave to feel strategic. The heal ability already covers personal sustain. |

**Remaining 4 upgrades:**

| Upgrade | What It Does | Why It's a Decision |
|---|---|---|
| Ping Frequency | Faster pings = find salvage faster, see enemies sooner | Competes with other upgrades for limited energy |
| Ping Range | Wider detection = safer navigation, find salvage from further | Range vs. frequency is a real choice (wide/slow vs. narrow/fast) |
| Hull Armor | Take less damage = survive longer trips into danger | Defensive investment vs. offensive/utility |
| Engine Speed | Move faster = more efficient runs, but harder to control when towing | Speed vs. control tradeoff is felt immediately |

**Remaining 3 abilities:**

| Ability | Role | Why It's a Decision |
|---|---|---|
| Blast | AOE clear — kills scouts, damages brutes | Offensive. "Do I blast now or save it for a bigger cluster?" |
| Heal (HoT) | Sustain — keeps you alive during risky salvage grabs | Defensive. "Do I heal now or save it for the trip home?" |
| Dash | Mobility — covers ground fast, rams through enemies | Utility. "Do I dash to save time, or save charges for the wave?" |

**The run, second-by-second:**

0:00 — Run starts. 5 salvage targets shown as direction indicators on minimap. Timer: 90 seconds.

0:00-0:20 — **Scouting phase.** Player pings outward, identifies nearest salvage and enemy positions. Decision: "Which salvage do I go for first? The close easy one, or the far valuable one?"

0:20-0:50 — **First retrieval.** Player navigates to salvage, picks it up, hauls it back. Encounters 2-3 enemies on the route. Decision: "Fight through or go around? Use blast now or save it?" Deposits salvage at base. Gets energy from the deposit + any resource clusters collected along the way.

0:50-0:55 — **At base, brief.** Decision: "Spend energy on an upgrade (ping range to find the next target faster?) or a turret (better wave defense?) or just go?" Every second here is a second not salvaging.

0:55-1:20 — **Second retrieval.** Harder — further out, tougher enemies. Player now has an upgrade or two. The trip tests whether they invested well. Decision: "I can see a third salvage nearby but I'm at 40% HP. Head home or push for one more?"

1:20-1:30 — **Final prep.** Timer warning. Player deposits remaining salvage. Places any turrets they can afford. Positions near base.

1:30 — **Wave.** Everything the player did is tested. Number of turrets placed, upgrades purchased, HP remaining. The wave is 12-20 enemies (scouts + brutes + one boss brute) converging on the base.

Win → Currency → Next run (harder wave, same loop).

**The key difference from current:** nothing in this loop exists "just because." There are no mechanics the player can ignore. You *will* ping, *will* tow salvage, *will* fight enemies, *will* upgrade, *will* defend. And at every moment, you're choosing between two things you genuinely want to do.

---

### Comparing the Three

| Dimension | A: Salvage Run | B: Deep Signal | C: Tighten the Screws |
|---|---|---|---|
| **Art risk** | Low. Refine what exists. | High. Major visual overhaul. | Low. Edit what exists. |
| **Code risk** | Medium. Pre-placed salvage, aggro changes, remove dropoffs. | High. New rendering for depth zones, entity fading, sonar aesthetic. | Low. Mostly removals and rebalancing. |
| **Gameplay novelty** | Medium. Same actions, better structured. | High. Depth layers add a new dimension. | Low. Fewer actions, tighter structure. |
| **"Fun in 30 seconds" factor** | High. First salvage grab feels purposeful. | Medium. Need to experience depth zones to feel the difference. | High. Every second has a decision. |
| **Scope to ship** | 2-3 weeks | 5-6 weeks | 1-2 weeks |
| **Biggest risk** | Salvage manifest might feel prescribed, not exploratory. | Visual overhaul might not land. Organic bioluminescence is hard to do procedurally. | Cutting too much might make the game feel thin. 2 enemy types and 3 abilities might not sustain interest past run 5. |

**My recommendation:** Start with **C** (tighten). It ships fastest and its cuts are reversible — you can always add ranged enemies, missiles, and repair stations back if the stripped-down version feels too spare. Then layer on **A**'s salvage manifest system (pre-placed salvage with distance-based value) once the core loop feels airtight. **B** is a great idea for a sequel or major update but is too much visual risk for where the project is right now.
