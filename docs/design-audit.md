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

#### P3-1: CRT shader for deeper radar-console immersion

**Problem:** The game has scanlines (Canvas 2D) and bloom (WebGL), but no CRT curvature, vignetting, or phosphor dot simulation. These would push the "radar console" aesthetic further.

**Recommendation:**
- Add an optional CRT shader effect to the pipeline:
  - Subtle barrel distortion (reuse the math from DamageDistortionEffect, but permanent at low curvature ~0.01)
  - Corner vignetting (darken edges by ~15%)
  - Phosphor dot pattern (RGB subpixel simulation at low opacity)
- This is **purely cosmetic** and should be toggleable independently from other shaders
- Low priority — the game looks good without it

#### P3-2: Dynamic radar ring response

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
13. **P3-1:** CRT shader effect
14. **P3-2:** Dynamic radar ring response
15. **J5:** Thrust particles
