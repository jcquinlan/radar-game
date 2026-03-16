# Game UX Patterns

Reference material for the game-design-advisor skill. Covers HUD design, menu patterns, onboarding, accessibility, input feedback, and information architecture for games.

---

## HUD Design

### Four Types of Game UI

Understanding these categories helps make intentional choices about how information is presented:

| Type | Definition | Example | Best For |
|------|-----------|---------|----------|
| **Diegetic** | Part of the game world, visible to characters | Dead Space's health spine, car dashboard in racing games | Immersion, when the game's fiction supports it |
| **Non-diegetic** | Traditional overlay only the player sees | Health bar in corner, minimap, score counter | Clarity, when information must always be available |
| **Spatial** | Exists in game world but not perceived by characters | Enemy health bar floating above their head, waypoint markers | Contextual info tied to specific entities |
| **Meta** | Represents game state through world effects | Blood splatter on screen = low health, screen desaturation = near death | Emotional impact, peripheral awareness |

**For this radar game:** The radar itself is **diegetic** — it's a real radar screen the player is looking at. HUD elements should lean diegetic (instrument readouts on the console) or meta (screen effects for damage/healing). Avoid non-diegetic elements that break the console metaphor unless absolutely necessary for clarity.

### HUD Information Priority

| Priority | Information | Display Method | When Visible |
|----------|-----------|---------------|-------------|
| **Always visible** | Health, energy, current heading | Bars + numbers, fixed position | Always during gameplay |
| **Contextual** | Threat level, distance from origin | Text readout, changes on movement | Always, but visually quiet when stable |
| **On demand** | Upgrade costs, ability details | Panel toggle (E key) | Only when panel is open |
| **Momentary** | Damage numbers, collection amounts | Floating text, auto-fades | 1-2 seconds after event |
| **Transitional** | Score, kills, time, distance | Results screen | End of run |

### HUD Layout Principles

**Corners are prime real estate.** Eyes naturally scan to corners. Reserve them for the most important persistent information:
- **Top-left:** Player status (health, energy) — the most-checked info
- **Top-right:** Score, time, secondary stats — important but not moment-to-moment
- **Bottom-left:** Contextual info (coordinates, FPS, threat) — reference data
- **Bottom-center:** Ability bar — needs quick peripheral glance during combat
- **Right edge:** Upgrade panel (when open) — intentional interaction, not passive reading

**The center is sacred.** The center of the screen is where gameplay happens. Never put persistent HUD elements there. Floating text and momentary effects can pass through but must fade quickly.

**Symmetry = calm, asymmetry = tension.** A symmetrically-laid HUD feels stable. Deliberately asymmetric elements (angled text, off-center indicators) feel more tense and military.

### Health Bar Design Patterns

| Pattern | Pros | Cons | Best For |
|---------|------|------|----------|
| **Horizontal bar** | Universally understood, easy to read peripherally | Takes horizontal space | Primary health display |
| **Segmented bar** | Shows discrete damage, satisfying to "fill" | Harder to read exact % | Games with discrete HP values |
| **Circular/radial** | Compact, fits radar aesthetic | Less intuitive than horizontal | Secondary display or HUD-minimal design |
| **Numeric only** | Smallest footprint | Requires direct attention to read | Supplement to bar, not replacement |
| **Color-shifting** | Readable peripherally (green→yellow→red) | Colorblind-unfriendly alone | Combine with bar for best effect |
| **Screen-edge glow** | Zero HUD footprint, peripheral | Imprecise, can't show exact value | Meta UI supplement to bar |

**Recommendation for this game:** Horizontal bar with color shift (green→amber→red) + numeric readout. The color shift is readable in peripheral vision; the number is there for players who want precision. Both use the radar console aesthetic (monospaced font, technical style).

---

## Menu Design

### Menu Types and Patterns

**Main Menu:**
- Keep options minimal: Start Game, Continue (if save exists), Settings, Quit
- The background should show the game world (or a stylized version) — not a static image
- For a radar game: show the radar display with simulated entity blips moving around, no player input

**Pause Menu:**
- Must be instantly accessible (Escape key, universally expected)
- Must clearly signal "game is paused" — dim the game view, overlay the menu
- Options: Resume, Settings, Restart, Quit to Menu
- Never auto-resume on Escape — require explicit "Resume" action OR a second Escape press (be consistent)
- Current game state (health, energy, time remaining) should be visible through the overlay

**Settings Menu:**
- Group by category: Controls, Audio (when applicable), Visual, Accessibility
- Every setting should have a clear label and current value
- Sliders for continuous values, toggles for binary, dropdowns for multi-option
- Show a preview/immediate effect when possible (e.g., changing bloom intensity should be visible behind the menu)

**Game Over Screen:**
- Show what happened (final stats: score, time, kills, distance, energy collected)
- Show what was achieved (best stats highlighted, progress toward unlocks)
- Clear call-to-action: "Try Again" prominently, "Quit to Menu" secondary
- Don't make the player feel punished — frame death as data ("here's what you learned this run")

**Upgrade Panel:**
- Show current level, cost to upgrade, and effect of next level
- Greyed out / dimmed when unaffordable
- Visual feedback on purchase: flash, scale pulse, particle burst
- Consider showing a comparison: "Current: +30 speed → Next: +45 speed"

### Menu Transitions

Menus should never "pop" — they should animate in and out:
- **Fade in:** 0.15-0.25s, ease-out opacity
- **Slide in:** 0.2-0.3s, ease-out from edge
- **Scale in:** 0.15s, ease-out from 95% to 100% scale (subtle)
- **Game dim:** 0.2s to darken the game view behind a menu

The game world should still be visible (dimmed) behind all menus except the main menu. This maintains spatial awareness and makes the pause feel temporary.

---

## Onboarding

### The Four Onboarding Strategies

**1. Environmental Teaching (Strongest)**
The level design naturally teaches mechanics. No text needed.
- *Example:* First area has only resources. Player learns "ping reveals things, things give me energy."
- *Example:* First enemy appears after player has moved away from origin. Player learns "danger increases with distance."

**2. Contextual Hints (Moderate)**
Brief text that appears at the exact moment the player needs it.
- Trigger-based: "Fly close to salvage to attach" appears when player is within 100px of their first salvage.
- One-shot: Each hint appears once, ever. Store shown hints in localStorage.
- Duration: 3-4 seconds, then fade out.
- Style: Diegetic — formatted like a radar console message. "SALVAGE DETECTED — PROXIMITY REQUIRED" feels better than "Move close to pick up salvage."

**3. Discoverable Complexity (Ongoing)**
Systems reveal themselves as the player engages:
- Upgrades panel hint appears after collecting 20+ energy ("UPGRADES AVAILABLE — PRESS [E]")
- Ability hints appear when unlocked
- Advanced mechanics (tow rope physics, inter-item repulsion) are never explained — players discover through feel

**4. Safe Failure (Passive)**
The early game allows mistakes without severe consequences:
- Inner safe zone has no enemies
- First enemies are scouts (low damage, easy to outrun)
- First death should happen far enough into the run that the player has learned the basics

### Onboarding Anti-Patterns

- **Wall of text before gameplay.** Never. Let the player play within 5 seconds of pressing "Start."
- **Pausing gameplay to explain.** Breaks immersion and momentum. Use overlays that don't freeze the game.
- **Explaining things the player hasn't encountered.** Don't explain salvage mechanics before the player has seen salvage.
- **Forced tutorials.** Let the player skip or ignore all guidance. Skilled players will be annoyed by mandatory tutorials.
- **Explaining "how" without "why."** "Press W to move" is useless. The radar showing something interesting ahead is motivation to move.

### First-Time Player Experience Timeline

| Time | What Happens | What Player Learns |
|------|-------------|-------------------|
| 0:00 | Game starts, first ping fires | "I can see things when the ping goes out" |
| 0:05 | Resources appear on radar | "Those green things are collectible" |
| 0:10 | Player moves, new area reveals | "The world is bigger than my radar" |
| 0:30 | First resource collected via ping | "Resources give me energy" |
| 1:00 | First enemy appears (scout) | "Red things are dangerous — they chase me" |
| 1:30 | First damage taken | "I can be hurt. Health matters." |
| 2:00 | Hint: upgrades available | "I can spend energy to get stronger" |
| 3:00 | First salvage sighting | "That amber thing is different. Let me investigate." |
| 3:30 | Salvage pickup | "Getting close attaches it. It follows me." |
| 4:00 | Dropoff zone discovered | "Gold zone + towed salvage = big energy payout" |
| 5:00+ | Abilities, complex enemies, distant exploration | Player is self-directed from here |

---

## Accessibility

### Color Vision Deficiency (CVD) Guidelines

**The fundamental rule:** Never use color as the ONLY way to convey information. Every color distinction must also be a shape, size, pattern, or label distinction.

**Entity differentiation strategy:**

| Entity | Color | Shape | Size | Label (at upgrade) |
|--------|-------|-------|------|-------------------|
| Player | Green | Triangle (pointing heading) | Medium | — |
| Scout enemy | Red | Small circle | Small | SCT |
| Brute enemy | Red | Large circle | Large | BRT |
| Ranged enemy | Orange-red | Circle with dot | Medium | RNG |
| Resource | Green (lighter) | Small diamond | Small | — |
| Healer ally | Blue | Circle with cross | Medium | HLR |
| Shield ally | Blue-purple | Circle with ring | Medium | SHD |
| Beacon ally | Amber | Circle with rays | Medium | BCN |
| Salvage | Gold | Diamond | Medium | SAL |
| Dropoff | Gold | Ring (outline only) | Large | DRP |
| Projectile | Red | Tiny circle | Tiny | — |

**Shape is the primary differentiator. Color is the secondary differentiator.** This means a colorblind player can still distinguish all entities by shape alone.

**Colorblind palette alternatives:**

| Normal | Protanopia-safe | Deuteranopia-safe | Tritanopia-safe |
|--------|----------------|-------------------|-----------------|
| Green (#00FF41) | Cyan (#00FFFF) | Cyan (#00FFFF) | Green (#00FF41) |
| Red (#FF4444) | Yellow (#FFFF00) | Yellow (#FFFF00) | Red (#FF4444) |
| Gold (#FFD700) | White (#FFFFFF) | White (#FFFFFF) | Cyan (#00FFFF) |
| Blue (#44AAFF) | Blue (#4444FF) | Blue (#4444FF) | Magenta (#FF44FF) |

### Contrast Requirements

| Element | Minimum Ratio | Standard |
|---------|--------------|----------|
| Gameplay-critical text (health number, timer) | 7:1 (AAA) | Against darkest likely background |
| Important text (score, energy) | 4.5:1 (AA) | Against typical background |
| Decorative text (coordinates, FPS) | 3:1 | Against typical background |
| Entity blips vs background | 4.5:1 | Blip color vs. radar background |
| UI controls (buttons, sliders) | 3:1 | Border/text vs. background |

### Motion Sensitivity

- Screen shake: Provide intensity slider (0% to 100%, default 100%)
- Post-processing effects: Toggle on/off (already exists)
- Ambient particles: Provide density slider (0% to 100%)
- Damage flash: Cap at 3 flashes per second maximum (prevent seizure risk)
- Bloom: Intensity slider

### Motor Accessibility

- All controls remappable (partially implemented)
- No actions require simultaneous key presses
- Pause available at any time
- Game speed adjustment (stretch goal — useful for players who need more reaction time)
- Auto-aim assist option (stretch goal for ability targeting)

---

## Input Feedback Patterns

### The Feedback Chain

Every player action follows this chain. If any link is missing, the action feels broken:

```
INPUT → ACKNOWLEDGMENT → ACTION → OUTCOME → RESULT DISPLAY
  ↓         ↓              ↓         ↓            ↓
 Key     Visual flash    Entity    Enemy dies   "+50" float
pressed   or sound      moves/    or resource     text
          (< 1 frame)   fires     collected
```

### Feedback Intensity Scale

Match feedback intensity to action significance:

| Significance | Examples | Feedback Level |
|-------------|---------|---------------|
| **Routine** | Moving, turning, collecting small resource | Subtle: slight visual change, no screen effect |
| **Moderate** | Taking damage, using ability, killing scout | Medium: flash, particle burst, floating number |
| **Significant** | Killing brute, depositing salvage, buying upgrade | Strong: screen shake, large particles, color flash, scale pulse |
| **Critical** | Near-death, game over, completing wave | Maximum: sustained effects, screen-wide changes, dramatic pause |

### Specific Feedback Recommendations

**Movement (thrust):**
- Engine exhaust particles behind player (opposite to heading direction)
- Particles scale with thrust input (full thrust = more/bigger particles)
- Motion trail intensifies with speed

**Collecting resource:**
- Resource blip scales up 30% then quickly fades out (0.3s)
- Small particle burst in resource color
- "+N" floating text in gold
- Brief screen-edge glow in resource color (barely perceptible)

**Taking damage:**
- Red damage flash (already exists)
- Screen shake (already exists)
- Chromatic aberration spike (already exists via DamageDistortion)
- "-N" floating text in red near player
- Health bar flashes white briefly

**Killing enemy:**
- Enemy blip expands then dissolves into particles (0.4s)
- Particles match enemy color, radiate outward
- "+50" floating text in gold
- Brief hitstop (2-3 frames where all motion pauses) — only for significant kills

**Using ability:**
- Immediate visual confirmation of activation (0.05s)
- Ability icon in bar pulses/flashes
- Per-ability effects already exist (blast ring, heal glow, drone flash, dash trail)
- Cooldown bar begins filling — visually distinct from "ready" state

**Depositing salvage:**
- Each item deposited gets its own "+50" floating text (staggered if multiple)
- Dropoff zone pulses brightly on deposit
- Gold particle burst from deposit point
- Tow rope disconnection animation (rope fades rather than disappearing instantly)

---

## Information Architecture

### What Players Need vs. What They Want vs. What They Can Find

| Need (show always) | Want (show on demand) | Can Find (bury in menus) |
|--------------------|-----------------------|--------------------------|
| Current health | Score breakdown | Control bindings |
| Current energy | Upgrade details | Settings |
| Immediate threats | Ability descriptions | Statistics/records |
| Run timer | Coordinates/distance | Accessibility options |
| Ability cooldowns | FPS counter | |

### Information Density Rules

1. **The 3-second rule:** A new player should understand the HUD's critical elements within 3 seconds of looking at it. If they can't, there's too much on screen.

2. **The squint test:** If you squint at the screen, you should still be able to tell: Am I healthy? Am I in danger? Where should I go? If squinting makes any of these ambiguous, the visual hierarchy needs work.

3. **The screenshot test:** Take a screenshot at any random moment during gameplay. Can someone who's never played the game identify: the player, the enemies, the resources, the health state? If not, the visual language needs clarification.

### Number Formatting

- Health: Integer, no decimals (`47 / 100`)
- Energy: Integer, no decimals (`238`)
- Damage/heal numbers: Integer, preceded by `-` or `+` (`-12`, `+8`)
- Distance: Integer, no units (`DIST: 1247`)
- Time: `M:SS` format (`7:23`)
- Cooldowns: Filled arc or bar, no numbers (the visual is faster to parse than "2.3s")
- Upgrade costs: Integer with energy icon or label (`COST: 85 NRG`)
