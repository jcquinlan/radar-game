# Visual Design Guide for Code-Driven Indie Games

Reference material for the game-design-advisor skill. This document covers color theory, visual hierarchy, palette construction, and procedural aesthetics — all framed for programmers building games without image assets.

---

## Color Theory Essentials

### The HSV Mental Model

Think of color in HSV (Hue, Saturation, Value) rather than RGB:
- **Hue** = what color (0-360 degrees on the color wheel)
- **Saturation** = how vivid (0% = grey, 100% = pure color)
- **Value** = how bright (0% = black, 100% = full brightness)

This model maps directly to game design decisions:
- **Hue** differentiates entity types (enemies = red hue, resources = green hue, salvage = gold hue)
- **Saturation** differentiates importance (interactive elements = high saturation, ambient = low saturation)
- **Value** differentiates layers (foreground = high value, background = low value)

### Color Relationships

| Relationship | Definition | Game Use |
|-------------|-----------|----------|
| **Complementary** | Opposite on color wheel (e.g., green ↔ red) | Enemy vs. player — maximum contrast for threat identification |
| **Analogous** | Adjacent on color wheel (e.g., green, teal, cyan) | Ally subtypes — related but distinguishable |
| **Triadic** | Three equidistant hues (e.g., red, green, blue) | Balanced palette for three distinct entity categories |
| **Monochromatic** | One hue, varied saturation/value | Radar elements — unified look with depth |

### Color and Emotion

| Color | Association | Game Application |
|-------|-----------|-----------------|
| **Green (phosphor)** | Technology, safety, radar, night vision | Primary radar color — feels technical and military |
| **Red** | Danger, damage, urgency, heat | Enemies, damage indicators, low health warnings |
| **Amber/Gold** | Value, warmth, reward, treasure | Salvage, energy, score, achievements |
| **Cyan/Blue** | Calm, healing, protection, cold | Allies, shields, healing effects |
| **White** | Impact, explosion, revelation | Blast effects, ping flash, critical hits |
| **Dark grey/black** | Void, unknown, space, absence | Background, unexplored area, empty space |

### Palette Construction Method

1. **Start with the mood.** This is a radar game — the mood is tense, isolated, tactical. The dominant hue is green (phosphor), the void is near-black.

2. **Assign semantic roles before choosing colors:**
   - Primary (radar infrastructure, player)
   - Danger (enemies, damage, warnings)
   - Value (resources, salvage, energy)
   - Safety (allies, heals, shields)
   - Neutral (UI chrome, backgrounds, inactive elements)

3. **Choose hues for each role** using color relationships:
   - Primary: Green (120° hue)
   - Danger: Red (0°) — complementary to green = maximum threat contrast
   - Value: Gold (45°) — warm, distinct from both green and red
   - Safety: Cyan-blue (200°) — cool, calming, distinct from danger red
   - Neutral: Desaturated green or grey — same hue family as primary but muted

4. **Create value steps** for each hue (minimum 3):
   - Dark (background, inactive): 15-25% value
   - Mid (standard state): 50-70% value
   - Bright (active, highlighted): 85-100% value

5. **Test with a colorblind simulator.** Ensure every pair of semantically different colors is also distinguishable by shape, size, or brightness alone.

### Palette Sizing Rules

- **Total unique colors:** 12-20 maximum across the entire game
- **On screen at once:** Rarely more than 6-8 distinct colors
- **Per entity type:** 1 base color + 1 highlight/accent maximum
- **UI text:** 3 levels (bright = primary, medium = secondary, dim = tertiary)

---

## Visual Hierarchy

### The Three-Tier System

Every visual element in the game belongs to exactly one tier:

**Tier 1 — Gameplay-Critical (the player MUST see this)**
- Player position and heading
- Enemy positions and types
- Player health (current state, not just number)
- Immediate threats (incoming projectiles, nearby enemies)
- Active ability effects

Visual treatment: Highest contrast, largest size, unique shapes, may use glow/pulse. Never obscured by Tier 2/3.

**Tier 2 — Important Information (the player SHOULD see this)**
- Resources and their positions
- Allies and their types
- Energy count and score
- Ability cooldown states
- Salvage and dropoff positions
- Tow rope connections

Visual treatment: Medium contrast, standard size, consistent but quieter colors. Visible but doesn't compete with Tier 1.

**Tier 3 — Ambient & Decorative (atmosphere and polish)**
- Ambient particles
- Scanlines and CRT texture
- Motion trails
- Radar rings and crosshair
- Bloom glow
- Background grid or coordinate markers

Visual treatment: Low contrast, low opacity, may be partially transparent. Creates atmosphere but never distracts from Tier 1/2.

### Hierarchy Enforcement Rules

1. **Brightness rule:** Tier 1 elements are always the brightest things on screen. If a Tier 3 element (like bloom) makes a Tier 1 element harder to see, the bloom is too strong.

2. **Size rule:** At any given moment, the player's eye should be drawn to the largest high-contrast element — which should be a Tier 1 element.

3. **Motion rule:** Moving elements attract attention. Tier 1 elements should have the most noticeable motion. Ambient particles should move slowly and subtly.

4. **Opacity rule:** Tier 3 elements should rarely exceed 30% opacity. Tier 2 elements should rarely exceed 80% opacity. Tier 1 elements should always be at or near 100% opacity.

5. **Glow/shadow rule:** Only Tier 1 elements get `shadowBlur`. This is both a visual hierarchy rule and a performance rule (shadowBlur is expensive).

---

## Procedural Aesthetics for Programmers

### The "Seven Techniques" Toolkit

These are the primary tools available for creating visual richness without art assets:

#### 1. Geometric Shape Language

Define a consistent shape vocabulary:
- **Circles** = detection, range, radar, areas of effect
- **Triangles** = direction, player, movement, projectiles
- **Diamonds** = value, salvage, special items
- **Squares/rectangles** = structures, bases, zones, UI elements
- **Lines/curves** = connections, ropes, trails, paths

Every entity type should have a unique shape. Color reinforces the distinction; shape is the primary identifier (critical for colorblind accessibility).

#### 2. Glow and Bloom

Glow (via `shadowBlur` or WebGL bloom) adds "energy" to flat shapes:
- Reserve glow for interactive or important elements
- Glow intensity can encode state (pulsing glow = active, steady glow = passive, no glow = inactive)
- Performance budget: 2-3 glowing elements per frame maximum with Canvas 2D shadowBlur. WebGL bloom is free (applies to everything that's bright enough).

#### 3. Particles

Particles add life and feedback without art:
- **Ambient particles:** Slow-moving dots that create a sense of space and depth. Low opacity, small size.
- **Feedback particles:** Burst on events (collection, damage, death). Short-lived, fast-moving, match the event's color.
- **Trail particles:** Follow moving entities, creating motion streaks. Convey speed and direction.

Particle rules:
- Pre-allocate a fixed pool (never allocate in the hot loop)
- Each particle type needs: position, velocity, lifetime, color, size, opacity
- Fade opacity linearly over lifetime
- Reduce size over lifetime for "dissipation" feel

#### 4. Post-Processing (Shaders)

The game already has bloom and damage distortion. Additional shader effects that can enhance the radar aesthetic:
- **Scanlines:** Horizontal lines that simulate CRT display
- **Vignette:** Darkened edges focus attention on the center (already partially implemented)
- **Chromatic aberration:** Color fringing at edges — use sparingly, tied to damage or distortion events
- **Phosphor persistence:** Bright elements leave brief afterimages, simulating CRT phosphor decay
- **Color grading:** Shift the entire image toward a color temperature (cool = isolated, warm = safe zone near base)

#### 5. Animation and Easing

Static shapes feel dead. Subtle animation makes them alive:
- **Pulse:** Sine wave on size or opacity (period 1-3 seconds, amplitude 10-20%)
- **Breathe:** Very slow pulse on ambient elements (period 4-6 seconds)
- **Flash:** Single bright frame followed by fast fade (0.1-0.2 seconds)
- **Ease-out:** Most game animations should ease-out (fast start, slow finish) — feels responsive
- **Overshoot + settle:** For impactful events — scale to 120%, then ease back to 100%

Common easing functions:
| Easing | Formula | Use |
|--------|---------|-----|
| Linear | `t` | Constant motion (scrolling, steady movement) |
| Ease-out | `1 - (1-t)^2` | Responsive feedback (UI transitions, damage flash fade) |
| Ease-in-out | `t < 0.5 ? 2t^2 : 1 - (-2t+2)^2/2` | Smooth transitions (menu transitions) |
| Bounce | `abs(sin(t * π * bounces)) * (1-t)` | Playful feedback (score popup) |
| Overshoot | `1 + 2.7 * (t-1)^3 + 1.7 * (t-1)^2` | Impactful events (scale pulse on hit) |

#### 6. Dynamic Lighting (via Opacity/Value)

Without true lighting, simulate depth and focus through value:
- Elements closer to the "camera" (higher importance) are brighter
- Elements further from the radar's center can be dimmer
- The ping itself acts as a "light source" — entities flash brighter when the ping contacts them
- Areas outside the ping radius are darker (already implemented as vignette)

#### 7. Procedural Patterns and Textures

Code-generated visual complexity:
- **Dithering:** Random dot patterns that break up flat areas
- **Noise:** Perlin/simplex noise for organic-looking variation
- **Grid patterns:** Regular geometric patterns for technical/military feel
- **Radial patterns:** Concentric rings, compass roses, bearing markers

---

## The Programmer's Visual Design Checklist

Use this checklist when evaluating any visual change:

### Palette
- [ ] Total unique colors in the game ≤ 20
- [ ] Every color has a defined semantic role
- [ ] No two semantically different elements share the same color
- [ ] Accent color (most saturated) is reserved for the single most important interactive element
- [ ] Tested with protanopia, deuteranopia, tritanopia simulators

### Hierarchy
- [ ] Every element assigned to Tier 1, 2, or 3
- [ ] Tier 1 elements are always the brightest and most prominent
- [ ] Tier 3 elements never compete with Tier 1 for attention
- [ ] No more than 3-4 Tier 1 elements visible simultaneously

### Consistency
- [ ] Same shape always means the same thing
- [ ] Same color always means the same thing
- [ ] Animation timing is consistent for similar events (all "collected" events use the same animation)
- [ ] UI elements use a consistent spacing grid

### Readability
- [ ] All text meets 4.5:1 contrast ratio
- [ ] Entity blips are distinguishable at their smallest rendered size
- [ ] Overlapping elements don't create unreadable blobs
- [ ] The player can identify entity type within 0.5 seconds of appearing on radar

### Performance
- [ ] No shadowBlur in tight loops (or ≤ 3 per frame)
- [ ] No object allocation in render functions
- [ ] Particles use a pre-allocated pool
- [ ] Off-screen entities are not drawn

---

## CRT / Radar Console Aesthetic Guide

Since this game's visual identity is rooted in the radar/CRT console aesthetic, here are specific guidelines:

### Phosphor Green Palette
The classic radar green is not one color — it's a family:
- **Dark phosphor:** `#0D2B0D` — background glow, lingering afterimage
- **Mid phosphor:** `#1B5E1B` — inactive elements, grid lines
- **Standard phosphor:** `#00FF41` — primary radar elements, active text
- **Bright phosphor:** `#7FFF7F` — highlighted elements, ping flash
- **White-hot:** `#CCFFCC` — peak brightness moments, impact flashes

### CRT Texture Elements
- **Scanlines:** 1px horizontal lines every 2-3px, 5-10% opacity. Subtle enough to not interfere with readability.
- **Phosphor dot mask:** Optional sub-pixel pattern at very low opacity. Adds CRT texture without reducing clarity.
- **Screen curvature:** Slight barrel distortion at edges. Already available via DamageDistortion shader — could be enabled at low intensity as a constant effect.
- **Flicker:** Very occasional (every 10-30 seconds) subtle brightness fluctuation of the entire screen. Adds life without being distracting.

### Information Display Conventions
On a real radar console, information is displayed in specific ways:
- **Coordinates** use angular brackets: `<1234, -5678>`
- **Ranges** use bearing notation: `RNG: 450`
- **Status** uses abbreviations: `HP`, `NRG`, `THR`, `SPD`
- **Labels** are all-caps, monospaced, technical
- **Dividers** use horizontal rules or box-drawing characters
- **Readouts** right-align numbers for easy scanning
