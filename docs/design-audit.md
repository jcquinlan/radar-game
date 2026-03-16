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

**Design threads running through all three proposals:**

The foundation is strong. Tank controls feel good. Ping-as-perception is a great core conceit. Salvage towing has satisfying physics. The base → run → wave → results loop exists. But right now the 60-second run is mostly unstructured — you fly around, grab stuff, the timer expires, you fight a wave. The mechanics exist side-by-side rather than interlocking.

Two ideas cut across all three proposals and should be treated as first-class design elements:

1. **Light automation.** The player should be able to deploy things into the world that *work on their behalf* — but imperfectly, temporarily, and with tradeoffs. A mining bot that extracts resources but attracts enemies. A scout drone that reveals the map but is fragile and needs protection. Automation creates the juggling — you set something in motion, then have to manage the consequences while pursuing your main objective.

2. **Light unit management.** Spawning and directing bots is a core verb, not a side mechanic. Bots are how you extend your reach across the map. You can't be everywhere at once, but your bots can be *somewhere* at once. The tension between "what I'm doing personally" and "what my bots are doing elsewhere" is the game's decision engine. This isn't an RTS — you have 2-4 bots max, each doing one simple thing, and the skill is in choosing *which* simple things and *when*.

These proposals aim to make every system *need* the others, with bots as the connective tissue that turns a solo survival game into a game about managing a small, fragile operation under pressure.

---

### Proposal A: "The Salvage Operation" — Bots as Your Crew

**Art Direction: Refined Radar Console**

Don't reinvent the visual identity — just commit to it harder. The neon-on-black radar aesthetic is well-trodden but *this game has a reason to use it*: the radar isn't decoration, it's the game mechanic. The visual direction should feel less "Geometry Wars neon party" and more "the last working console on a derelict station, running a skeleton crew of automated drones."

Key shifts:
- **Desaturate the palette 20-30%.** Current colors are screaming-bright. Pull them down so that *only* gameplay-critical elements (enemies, your own ping, your active bots) are at full saturation. Ambient elements, UI chrome, and decorative effects should feel dim and tired — a console that's been running too long.
- **Introduce noise/grain to the background.** Not a shader — just a subtle per-frame random variation (±2%) in the background fill color. Makes the void feel like a CRT that's slightly unstable, not a clean digital display.
- **Warm the greens toward amber.** Instead of pure phosphor green (#00ff41), shift to a warmer green-gold (#44cc44 or even #66aa33). This reads as "old CRT phosphor" rather than "Matrix screensaver." The Ocean and Ember themes already show this can work with different hues.
- **Typography as world-building.** The monospace text is correct but generic. Lean into the console aesthetic: angular brackets around labels (`[HP] 85/100`), dot-leader padding between label and value (`RANGE....1250m`), abbreviated military-style labels (`TGT: 3 HOSTILE`, `BOT-1: MINING`, `BOT-2: ESCORT`).
- **Bot visual language.** Bots render as small cyan/amber shapes with a subtle tether line back to the player (or to their assigned task). Active bots pulse gently. Idle bots dim. Damaged bots flicker. The player should be able to glance at the radar and instantly know: "two bots deployed, one is mining, one is fighting."

Why this and not something new: The radar conceit is the game's best idea. The art direction should *serve* it, not compete with it. And a radar console managing a fleet of drones is more visually interesting than a radar console showing a lone ship.

**Gameplay Loop: Salvage + Crew Management**

The core insight: **you are a salvage operator running a tiny crew of expendable drones.** You can't do everything yourself. Your bots extend your capabilities but create new problems — they attract enemies, they break down, they need protection. The run is a constant juggle between personal action and bot management.

**Bot types (3 total, unified spawning mechanic):**

All bots are spawned the same way: press a key, spend energy, a bot deploys at your current position. Each bot has HP, a lifespan (15-30 seconds), and a single behavior. Max 3 bots active at once.

| Bot | Cost | Lifespan | Behavior | Tradeoff |
|---|---|---|---|---|
| **Miner** | 25E | 20s | Flies to nearest resource cluster, extracts energy over time (3E/sec). Emits a signal that attracts enemies within 200px — they path toward the miner, not you. | Free energy, but you're creating a fight somewhere on the map. Ignore the miner and it dies to enemies (you lose the bot). Defend it and you get 60E but spent time and HP doing so. |
| **Scout** | 15E | 25s | Flies outward in the direction you're facing when you deploy it. Continuously pings a small area (100px radius), revealing enemies and salvage along its path. Dies in one hit. | Cheap scouting. Reveals the map in a direction you haven't explored. But if an enemy spots it, it's dead instantly — and now you know there are enemies that way. The scout dying *is* information. |
| **Hauler** | 40E | 30s | Flies to the nearest untowed salvage within 300px, attaches to it, and slowly drags it back toward your home base at 40% of player speed. Cannot fight. Takes 50% more damage from enemies. | The expensive play. A hauler retrieving a far-out salvage piece while you personally grab a closer one effectively doubles your retrieval rate. But haulers are fragile, slow, and enemies *will* intercept them. You might need to escort, which costs the time you were trying to save. |

**Why bots transform the loop:**

Without bots, the run is: fly out, grab salvage, fly back. Repeat. It's a single-threaded operation.

With bots, the run becomes: deploy a scout ahead, fly out, drop a miner on the resource cluster you pass (now enemies are converging on it — deal with that or leave it), spot salvage, pick it up, deploy a hauler on the second salvage piece you can see, start heading back, check minimap — your hauler is being chased by a brute, detour to intercept, blast the brute, the hauler resumes, you deposit your salvage, the hauler arrives 10 seconds later with the second piece.

That's a multi-threaded operation. The player is managing 2-3 things happening simultaneously, making snap decisions about what to personally handle vs. what to let the bots attempt. This is the "juggling pseudo-automation with non-trivial combat" tension.

**The run, redesigned:**

Timer: 90-120 seconds. Pre-placed salvage manifest (5-6 targets).

**Pre-run (base mode):**
- You see the home base, your defenses, your currency.
- You see a **salvage manifest**: "This run: 5 salvage targets." Pre-placed in the world at run start. Approximate directions shown on minimap.
- Start the run.

**During the run — the four-way tension:**

1. **Personal retrieval** — fly out, grab salvage, fight through enemies, haul it back yourself. Reliable but slow.
2. **Bot deployment** — spend energy to extend your reach. Miners generate income. Scouts reveal the map. Haulers retrieve salvage autonomously. Each one creates a situation you may need to manage.
3. **Bot defense** — your bots attract enemies and can't defend themselves. Ignore a miner being attacked? It dies and you wasted 25E. Escort the hauler? That costs you time you could spend grabbing a third salvage yourself.
4. **Clock pressure** — all of this is happening under a timer. Bot lifespans are shorter than the run, so you're making deployment decisions 2-3 times.

**Why every mechanic earns its place:**

| Mechanic | Role in the Loop | What Happens If You Remove It |
|---|---|---|
| **Ping/radar** | Your only way to find salvage and enemies. Also shows bot positions and status at a glance — the radar becomes a management interface. | You can't find anything. Can't monitor bots. Game doesn't work. |
| **Tank controls + inertia** | Makes personal navigation a skill. Towing + maneuvering around threats is the core moment-to-moment challenge. | Movement becomes trivial, no skill gap between player and bot navigation. |
| **Salvage towing** | Primary objective. You tow personally for reliable retrieval. Hauler bots tow autonomously for efficiency at the cost of fragility. | No objective. No reason for hauler bots to exist. |
| **Enemy subtypes (scout/brute/ranged)** | Each threatens bots differently. Scouts chase down haulers. Brutes tank through miner defenses. Ranged enemies snipe scouts. Player must choose which threats to personally handle. | No reason to prioritize which bot to defend. All threats feel the same. |
| **Energy economy** | Everything costs energy. Bots cost energy. Upgrades cost energy. Defenses cost energy. Miners *generate* energy but cost time and attention. The economy forces choices. | No tradeoffs. Spam bots freely. |
| **Miner bots** | Create energy + create fights. The miner is a deliberate bet: "I think I can handle the enemies this attracts, and the energy will let me buy a hauler or an upgrade." | Energy comes only from passively collecting blips. No proactive income generation. No bot-created combat scenarios. |
| **Scout bots** | Map revelation on a budget. Scouts are cheap, disposable information. Their death tells you something. | Must personally explore every direction. Slows the early run dramatically. |
| **Hauler bots** | Force multiplication. A hauler on a far salvage piece while you grab a near one is the optimal play — but it's risky, expensive, and requires protection. | Can only retrieve one salvage at a time. Runs become purely sequential. |
| **Abilities (blast/heal/dash)** | Combat tools for both personal fighting and bot defense. Blast clears enemies around a miner. Dash lets you reach a threatened hauler in time. Heal sustains you through the chaos of managing multiple bots. | Can't respond to bot emergencies. No skill expression in bot defense. |
| **Defenses (turrets)** | Wave preparation, but also mid-run infrastructure. A turret placed near a miner keeps it alive longer. A turret on the hauler's return path clears the way. | No way to protect bots without being physically present. Limits the multi-threading. |
| **Final wave** | Tests everything: turrets placed, upgrades bought, HP remaining. Bots are expired by wave time — this is purely player + static defenses vs. the swarm. | No climax. |
| **Difficulty scaling (distance)** | Far salvage is worth more but harder for haulers to survive the trip. Creates the "do I haul this myself or risk a bot" decision. | No reason to deploy haulers. Just grab the close stuff. |

**What changes from current implementation:**
- Bot spawning system: 3 bot types sharing a unified spawn/manage interface (replaces the current orbit bot)
- Miners: new entity type — flies to resources, extracts over time, broadcasts aggro signal
- Scouts: stripped-down version of current orbit bot — no combat, just moves and pings
- Haulers: uses existing TowRopeSystem mechanics but applied to a bot entity instead of the player
- Bot status on HUD: small indicators showing bot type, HP, and task state
- Bot status on minimap: bot positions shown with distinct glyph
- Miner aggro signal: enemies within 200px of an active miner path toward it instead of wandering
- Remove allies entirely (healers, shields, beacons) — bots replace the "help in the field" role
- Remove dropoff zones — home base is the only deposit point
- Remove homing missile ability — replaced by bot deploy as the 4th action
- Salvage spawns pre-determined per run, value scales with distance

**What to cut:**
- All ally types (replaced by bot functionality)
- Dropoff zones (home base only)
- Homing missile ability (bot deploy replaces it)
- Energy magnet upgrade (miners replace passive collection)
- Orbit bot system (replaced by the 3 bot types)
- Score display (replaced by "Salvage: 2/5" objective counter)

---

### Proposal B: "Deep Signal" — Bots as Expendable Probes

**Art Direction: Sonar/Hydrophone — Pressure and Depth**

Drop the CRT/military radar metaphor entirely. Instead: **you are a deep-sea mothership deploying expendable probes into an ocean trench.** The visual language shifts from "radar screen in a dark room" to "bioluminescent shapes in crushing blackness, with your little probes flickering through the dark."

Key shifts:
- **No grid lines or rings.** The radar display chrome disappears. Instead, the ping is a sonar pulse — same expanding circle mechanic, but it renders as a pressure wave: a subtle ripple distortion that reveals entities as they're washed over. Entities *glow into existence* as the sonar touches them and then *fade back into darkness* over 2-3 seconds.
- **Color palette: bioluminescent.** Deep blue-black background (#040812). Entities glow in organic colors: resources are soft blue-white (like plankton), enemies are deep red-orange (like anglerfish lures), salvage is bright amber-gold (like volcanic thermal vents). No neon. Everything emits its own light rather than being illuminated by a radar sweep.
- **Bots as deep-sea probes.** Small blue-white dots trailing faint particle wakes. When a probe dies to pressure or enemies, it implodes — a brief inward-collapsing particle burst (the visual inverse of the death particle explosion). Probes in deep zones flicker with static, visually communicating their fragility.
- **Parallax becomes depth.** The two ambient particle layers become "shallow/deep." Deep particles are large, slow, faint (distant whale shapes). Foreground particles are tiny, fast, bright (disturbed plankton).
- **Pressure vignette replaces radar vignette.** Instead of darkness outside the ping range, the edges of the screen have a subtle blue-shift and barrel distortion — like looking through a diving helmet. The deeper (further from base) you go, the more pronounced this effect becomes.

Why this might work: It's genuinely different from every other neon-radar-game on itch.io. The deep-sea mothership deploying probes gives the automation mechanic a *physical* justification — you can't go everywhere in this hostile environment, so you send probes. And their fragility in deep zones creates natural drama.

Why it might not: It's a much bigger visual overhaul. And "deep sea" is harder to render procedurally than "radar screen" — organic bioluminescence is harder to fake with geometric shapes than phosphor dots.

**Gameplay Loop: Depth + Probe Management**

Same structural bones as Proposal A (salvage is the verb, bots extend your reach, timer creates pressure), but the metaphor of *depth* replaces *distance* and the environment itself threatens your bots.

**The depth mechanic:**

The world has conceptual "depth layers" that increase with distance from base. These aren't literal 3D — they're zones rendered with increasing visual intensity.

- **Shallows (0-500px):** Safe. Low-value salvage (30E). Weak enemies. Probes operate normally.
- **Midwater (500-1500px):** Standard salvage (50-80E). Mixed enemies. Probes take 1 HP/sec ambient pressure damage — they'll die in 15-20 seconds without returning.
- **Deep zone (1500-3000px):** High-value salvage (100-150E). Strong enemies. Probes take 3 HP/sec — they have maybe 7 seconds before implosion. Only the player can safely operate here (player is shielded).
- **Abyss (3000px+):** Ultra-salvage (200E+). Elite enemies. Even the player takes slow ambient pressure damage (1 HP/sec). Probes die in 3-4 seconds. This zone is for personal heroics only.

**Probe types (3, adapted for depth):**

| Probe | Cost | Base Lifespan | Behavior | Depth Interaction |
|---|---|---|---|---|
| **Harvester** | 25E | 20s | Flies to nearest resource cluster, extracts energy (3E/sec). Emits sonar pings that attract creatures. | In midwater, the harvester is on a death clock — you get maybe 10 seconds of extraction before pressure kills it. Deploy it, let it harvest, it dies. Efficient but wasteful. |
| **Sonar Buoy** | 15E | 30s | Stationary. Continuously reveals a 150px radius around its position. Doesn't move, doesn't fight. | In shallows, a buoy lasts the full 30 seconds — great for securing a safe corridor. In midwater, it lasts ~12 seconds. In deep zones, it's barely worth deploying. This naturally limits how much of the deep you can scout without going yourself. |
| **Salvage Tug** | 40E | 30s | Flies to nearest untowed salvage, drags it toward base at 30% player speed. Fragile. | In shallows, a tug can comfortably retrieve salvage. In midwater, it's a race — will the tug survive the trip back? In deep zones, the tug will die before reaching the salvage. Deep salvage *must* be personally retrieved. |

**The depth-probe tension:** Probes are most useful where they're least durable. Shallow probes are safe but the rewards are small. Deep probes would be incredibly valuable but they die too fast. This naturally creates a gradient: automate the easy stuff, personally handle the hard stuff. The player is always asking: "Is this worth going myself, or can I send a probe?"

**Changes from current implementation:**
- Probe spawning system (3 types, replacing orbit bot + turrets + repair stations)
- Depth-zone rendering (4 zones, visual intensity scales with distance)
- Ambient pressure damage to probes (and player in abyss)
- Entity visibility duration decreases with depth
- Sonar buoys as stationary probe type (reveals area, replaces turrets as the "place a thing" mechanic)
- Harvester aggro signal (same as Proposal A's miner)
- Salvage tug using existing tow physics (TowRopeSystem) applied to a bot
- Replace corridors with "thermal vents" — deep-zone paths with high salvage density
- Remove allies, turrets, repair stations (all replaced by probes)

**What to cut:**
- Radar rings, scanlines, center crosshair (replace with sonar pulse aesthetic)
- All ally types (replaced by probes)
- Turrets and repair stations (replaced by probes)
- Homing missile (replaced by probe deploy)
- Corridors (replaced by thermal vents)
- Home arrow indicator (replaced by depth gauge)

---

### Proposal C: "Tighten the Screws" — Bots as the Missing Verb

**Art Direction: Neon Radar, Done Right**

Keep the current visual identity but subtract rather than add. The problem with the current look isn't that it's neon-on-black — it's that it's *too much* neon-on-black. Everything glows. Everything pulses. When everything is bright, nothing is bright.

Key shifts:
- **Strict brightness budget.** Only 3 things on screen should be at full brightness at any given time: the player, the nearest threat, and whatever you're actively managing (a bot you're defending, salvage you're towing, base you're protecting). Everything else drops to 60% brightness or lower.
- **Kill the glow creep.** Currently: ping has shadowBlur 20, sweep effects have shadowBlur 20, ability effects have shadowBlur 12-15, missiles have shadowBlur 10, orbit bots have shadowBlur 10, dropoff zones have shadowBlur 8. That's 6+ glow sources competing for attention. Rule: **maximum 2 active shadowBlur elements at any time.** Ping glow is always one. The second slot goes to whatever just happened (damage, ability, collection). Everything else uses faked-glow (larger low-alpha circle behind the blip).
- **Bots are visually distinct from everything else.** Small cyan diamonds (not circles — circles are enemies/resources). A thin dotted line connects each bot to the player (like a command tether). This line is the fastest way to scan the radar and count "how many bots do I have active."
- **Reduce motion trails to player + bots only.** Enemy trails are visual noise. Bot trails help you track where they went.
- **Scanlines: every 4px instead of 3px, opacity down 30%.** Barely perceptible — felt, not seen.

Why this works: The current version is a first draft where every visual idea that worked in isolation got included. The second draft is about removing things until only the essential visual language remains. Bots are the one *addition* this version makes — because they solve the gameplay problem of the run feeling single-threaded.

**Gameplay Loop: The Taut Run, Now With Delegation**

Same core structure (base → run → wave), aggressively trimmed, with bots as the one new mechanic that turns the single-player run into a management puzzle.

**The problem the previous "Tighten" proposal had:** Cutting too much made the game feel thin — 2 enemy types and 3 abilities might not sustain interest past run 5. Bots solve this. They add decision complexity without adding mechanical complexity. The player isn't learning new controls or new enemy patterns — they're deploying simple tools into the existing systems and dealing with the emergent consequences.

**The bot design (simplified for this proposal):**

Only 2 bot types. Not 3. Two is easier to learn, faster to implement, and creates enough combinatorial decisions when combined with the rest of the game's mechanics.

| Bot | Cost | Lifespan | Behavior | Why It Exists |
|---|---|---|---|---|
| **Miner** | 20E | 15s | Drops at player position. Broadcasts a signal that collects all resources within 80px over its lifetime, storing them. When it expires or is destroyed, it drops the collected energy as a single pickup at its position. Attracts enemies within 150px. | Creates a fight-for-profit scenario. You're choosing: "I'll drop a miner here, which means enemies will converge in 5 seconds. I'll fight them off, then collect the payout." Or: "I'll drop a miner and leave — I'll lose the bot, but the enemies will chase it instead of me while I grab that salvage." The miner is both a resource tool and a tactical decoy. |
| **Guard** | 30E | 20s | Orbits a point — either the player or the last place you were standing when you deployed it. Shoots nearby enemies (same as current orbit bot). Low damage (2/sec contact), but enough to kill scouts and harass brutes. | Protects things. Deploy it at your position to guard a miner. Deploy it while towing salvage to ward off scouts. Deploy it at the base before the wave to add one more gun. The guard is a flexible defensive tool that works differently depending on *where* you deploy it. |

**Max 2 bots active at once.** This is critical. Two bots means exactly one decision: which two? A miner + guard (protected income)? Two guards (one for you, one for base)? Two miners (risky double-income play)? The combinatorics are small enough to grasp instantly but rich enough to sustain interest.

**How bots interact with the existing mechanics:**

| Existing Mechanic | Bot Interaction |
|---|---|
| **Ping/radar** | Bots are visible on radar with distinct shapes. Their status (mining, fighting, expired) should be readable at a glance. The radar becomes your management screen. |
| **Enemies (scouts + brutes)** | Scouts chase miners aggressively — they're fast enough to reach a miner before the player can deploy a guard. This punishes careless miner placement. Brutes ignore miners (too slow to care about a signal) but can body-block guards. |
| **Salvage towing** | Towing is when you're most vulnerable. Deploying a guard while towing gives you an escort. Deploying a miner as a distraction pulls enemies away from your tow route. Both are valid plays. |
| **Turrets (base defense)** | Turrets are permanent, bots are temporary. Different time horizons: turrets for the wave, bots for right now. A guard deployed at base fades after 20 seconds — it's a band-aid, not a strategy. Turrets are the strategy. |
| **Upgrades** | Add one new upgrade: **Bot Duration** (+5s lifespan per level, max 3 levels). This competes with ping/armor/speed for limited energy. |
| **Abilities** | Blast clears enemies off a miner. Dash lets you reach a bot that's under attack. Heal sustains you through the chaos of managing two bots and your own fights simultaneously. |

**Stripped-down mechanic list (what stays):**

| Mechanic | Why It Stays |
|---|---|
| Ping/radar | Core perception. Now also your bot management interface. |
| Tank controls + towing | Core navigation challenge. |
| Salvage (pre-placed, 5-6 per run) | Primary objective. |
| Home base (only deposit point) | Creates outbound/return rhythm. |
| Energy + 5 upgrades | In-run progression. (4 original + bot duration) |
| 3 abilities (blast/heal/dash) | Combat + bot defense tools. |
| 2 enemy types (scout/brute) | Each interacts differently with bots. |
| 2 bot types (miner/guard) | Automation + delegation. The new verb. |
| Turrets | Wave preparation. Permanent vs. bots' temporary. |
| Final wave | Climax. |

**What gets cut and why:**

| Cut | Reason |
|---|---|
| **All allies (healer/shield/beacon)** | Bots replace the "help in the field" role entirely. Miners replace beacon's income. Guards replace shield's protection. Heal ability replaces healer. |
| **Dropoff zones** | Home base only. One destination, simpler decisions. |
| **Ranged enemies** | Two enemy types is enough when bots create emergent complexity. Scouts vs. brutes already interact with bots differently (scouts rush miners, brutes ignore them). Ranged enemies would add projectile-vs-bot collision code for marginal gameplay benefit. |
| **Homing missile** | Bot deployment is the 4th keybind. Missile was always the weakest ability design (complex, unintuitive). |
| **Energy magnet** | Miners are the active version of this. You choose to collect, not auto-collect. |
| **Radar resolution** | QoL, not a decision. Cut. |
| **Repair stations** | Guards are the mobile version. Turrets are the permanent version. Repair stations are a third option nobody needs. |
| **Orbit bot (current)** | Replaced by the guard bot with a clearer purpose. |

**Remaining upgrades:**

| Upgrade | What It Does | Why It's a Decision |
|---|---|---|
| Ping Frequency | Faster pings = find salvage faster, see enemies sooner, monitor bots more often | Competes for limited energy |
| Ping Range | Wider detection = safer navigation, spot threats to bots earlier | Range vs. frequency is a real choice |
| Hull Armor | Take less damage = survive longer trips, more tolerance for fighting near miners | Defensive investment vs. utility |
| Engine Speed | Move faster = more efficient runs, faster response to bot emergencies | Speed vs. other investments |
| Bot Duration | +5s per level to all bots | Directly competes with personal upgrades — "do I make myself stronger or make my bots last longer?" |

**The run, second-by-second:**

0:00 — Run starts. 5 salvage targets on minimap. Timer: 90 seconds.

0:00-0:15 — **Opening.** Player pings outward, spots nearest salvage and a resource cluster. Decision: "Drop a miner on that cluster or save energy for a hauler upgrade?" Deploys miner. Enemies start converging on the miner's position.

0:15-0:35 — **First retrieval + miner defense.** Player heads toward closest salvage. Glances at minimap — 2 scouts heading for the miner. Decision: "Detour to defend the miner (it's got 30E stored) or grab the salvage and let it die?" Drops a guard near the miner on the way past. Guard engages scouts. Player reaches salvage, attaches it, starts heading back.

0:35-0:50 — **Towing home.** Player towing salvage back to base. Miner expires naturally, drops 45E of collected resources. Player detours to grab the energy pile. A brute is blocking the path home. Decision: "Blast it (6s cooldown), dash through it (risk to salvage), or go around?" Blasts it. Deposits salvage. Now has ~80E.

0:50-1:00 — **At base, spending.** Decision: "Upgrade (bot duration? engine speed?), place a turret (40E), or deploy and go?" Buys engine speed, deploys a miner near base (safe income while away), heads out for salvage #2.

1:00-1:20 — **Second retrieval.** Faster now with engine upgrade. Passes through a cluster of 3 enemies. Drops a guard to distract them, grabs salvage, dashes past. Guard dies but bought 10 seconds. Deposits salvage #2.

1:20-1:30 — **Final prep.** Timer warning. Miner at base expired, player collects the energy pile. Places a turret. Has time for one more decision: drop a guard at base as an early wave buffer, or save energy?

1:30 — **Wave.** 15 enemies converging. Player has: 1 turret, 0-1 guard bots (if freshly deployed), 3 abilities, whatever HP and upgrades they managed. The wave tests every decision made during the run.

**Why this works where "pure cuts" didn't:** The stripped-down version from the previous draft risked feeling thin. Bots add a second axis of complexity (personal action vs. delegated action) without adding mechanical clutter. The player learns two things: miners make money but attract trouble, guards protect stuff. Everything else emerges from combining those two simple tools with the existing mechanics.

---

### Comparing the Three

| Dimension | A: Salvage Operation | B: Deep Signal | C: Tighten the Screws |
|---|---|---|---|
| **Art risk** | Low. Refine what exists. | High. Major visual overhaul. | Low. Edit what exists. |
| **Code risk** | Medium. 3 bot types, pre-placed salvage, aggro rework. | High. 3 probe types + depth zones + pressure damage + new rendering. | Low-Medium. 2 bot types (simplified from current orbit bot), mostly removals. |
| **Bot complexity** | 3 types (miner/scout/hauler). Hauler uses tow physics — most complex but highest payoff. | 3 types (harvester/buoy/tug). Depth pressure adds an environmental constraint layer. | 2 types (miner/guard). Simplest. Fastest to implement. Enough depth from interaction with existing systems. |
| **Gameplay novelty** | High. Bots transform the run into crew management. | Very high. Depth + probes is a genuinely new structure. | Medium. Same map, same enemies, but bots change how you engage with all of it. |
| **"Fun in 30 seconds" factor** | High. First miner deployment + enemy response = immediate drama. | Medium. Need to experience depth zones to feel the difference. | High. Drop miner → enemies converge → fight or flee → instant tension. |
| **Scope to ship** | 3-4 weeks | 6-8 weeks | 2-3 weeks |
| **Biggest risk** | 3 bot types + 3 abilities + 2 enemy types = lots of interactions to balance. Hauler tow physics on a bot could be fiddly. | Visual overhaul might not land. Depth pressure on probes needs careful tuning to not feel punishing. | 2 bot types might not be enough variety. The "miner creates a fight" pattern could get repetitive. |
| **Expandability** | Can add bot types later (hauler is an obvious Phase 2 if starting with miner + guard). | Depth zones provide a natural expansion axis — add new zone types, new depth-exclusive content. | Can upgrade from 2 to 3 bot types later. Scout is the obvious third addition. |

**My recommendation:** Start with **C** (tighten + 2 bots). It ships fastest, its cuts are reversible, and miner + guard are enough to validate whether the automation-juggling-combat feel is fun. The guard bot is a direct evolution of the existing orbit bot code — less new than it looks. If it plays well, add the scout bot (cheap, fragile, information-gathering) as the first expansion, then evaluate whether A's hauler bot (autonomous salvage retrieval) is worth the tow-physics complexity. **B** remains an ambitious re-skin that could happen later if the core loop proves out.
