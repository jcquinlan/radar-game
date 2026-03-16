# Juice and Game Feel

Reference material for the game-design-advisor skill. Covers the game feel framework, juice layering, feedback systems, reward psychology, and difficulty communication.

---

## Game Feel Framework

Game feel is the intersection of three domains (Steve Swink's model):

### 1. Real-Time Response

The **correction cycle** — how fast the player can observe, decide, and act:

```
OBSERVE → DECIDE → ACT → OBSERVE (new state) → ...
```

- The total cycle time must be under **100ms** for the game to feel responsive.
- Input-to-visual-confirmation should be **under 1 frame** (16.67ms at 60 Hz).
- If the player presses a key and nothing visually changes for 2+ frames, the game feels sluggish regardless of actual responsiveness.

**For this game:** The 60 Hz fixed timestep guarantees consistent response time. The risk areas are:
- Abilities that have a visual "wind-up" before the effect — if the wind-up is too long, the ability feels unresponsive
- The ping cooldown creating a rhythm where the player can't see anything between pings — the "blind" period is a deliberate tension mechanic but shouldn't feel like input lag

### 2. Simulated Space

The **physics model** — how movement and objects feel:

**Weight:** Heavy objects accelerate slowly and carry momentum. Light objects are snappy. The player's ship has moderate weight (friction: 2.0, acceleration: speed × friction). This should feel like piloting a vessel, not moving a cursor.

**Inertia tuning principles:**
| Feel | Friction | Acceleration | When to Use |
|------|----------|-------------|-------------|
| Snappy/responsive | 4.0+ | High | Arcade, immediate-response games |
| Balanced | 2.0-3.0 | Medium | Vehicles, spacecraft — the sweet spot for this game |
| Heavy/weighty | 0.5-1.5 | Low | Tanks, cargo ships, dramatic momentum |
| Floaty/drifty | 0.3-0.8 | Very low | Space (no friction), underwater, zero-G |

**Turn inertia** is equally important:
- Too snappy: player can change heading instantly → feels like aiming a laser pointer, no sense of piloting
- Too sluggish: player can't react to threats → frustrating, feels unresponsive
- Current turnFriction (3.0) is in the "balanced" range — the ship turns with intent, not instantly

### 3. Polish & Aesthetics

The **juice layer** — extra details that amplify the feel of the first two domains. See the Juice section below.

---

## Juice: The Compositional Approach

### What Juice Is (and Isn't)

**Juice IS:** Extra sensory feedback that makes an already-functional action feel more satisfying. It's the sizzle on the steak.

**Juice IS NOT:** A substitute for good game design. If the underlying action doesn't feel fun without juice, no amount of screen shake will fix it. Fix the design first, then juice it.

### The Juice Stack

Layer effects from subtle to dramatic. Each layer should work independently — removing any layer should make the game feel "less" but not "broken."

#### Layer 1: Immediate Visual Confirmation (P0)

Every input must produce visible feedback within 1 frame:
- Thrust: engine particle emission starts immediately
- Turn: player triangle rotates immediately
- Ability press: ability icon flashes/highlights immediately
- Upgrade purchase: button flashes, energy counter decreases immediately

This is not optional. Without Layer 1, the game feels like inputs are being ignored.

#### Layer 2: Motion and Animation (P0)

Objects should never appear or disappear — they should animate in and out:
- Entity spawns: fade in from 0% opacity over 0.3s, scale from 50% to 100%
- Entity death: scale up 20%, then dissolve into particles over 0.4s
- Resource collection: scale up 30%, then shrink to 0% and fade over 0.3s
- Floating text: rises 40px over 1.5s, fades from 100% to 0% opacity
- Menu open/close: fade + subtle scale (0.2s ease-out)

#### Layer 3: Color and Brightness Feedback (P1)

Color changes to signal state transitions:
- Damage taken: brief red tint on player / red screen-edge flash
- Health regenerating: subtle green pulse on health bar
- Ability ready: ability icon shifts from grey to full color
- Ability on cooldown: ability icon greyed out with filling indicator
- Low health warning: health bar pulses, screen-edge subtly reddens
- Resource collected: brief gold flash at collection point

#### Layer 4: Particles (P1)

Particle bursts for events:
- Resource collected: 4-6 small particles in resource color, radiate outward, fade over 0.5s
- Enemy killed: 8-12 particles in enemy color, explode outward, fade over 0.6s
- Damage taken: 3-5 red particles from hit direction
- Ability activated: per-ability particle effects (already partially exist)
- Salvage deposited: 6-8 gold particles spiraling into dropoff center
- Upgrade purchased: sparks/confetti particles from upgrade panel

#### Layer 5: Screen Effects (P1)

Camera and screen-wide effects for significant events:
- **Screen shake:** On damage, on blast ability. Proportional to damage amount. Max displacement 4-6px, decay 0.15s.
- **Hitstop:** 2-3 frame pause on killing a brute or landing a big hit. Creates a punctuation mark in the action.
- **Zoom pulse:** Very subtle (2-3%) scale increase on significant events, eases back over 0.3s. Creates a "breath" effect.
- **Chromatic aberration spike:** Already exists for damage. Brief, proportional to damage severity.

#### Layer 6: Persistence and Debris (P2)

Effects that linger after events:
- Dead enemies leave a fading "ghost" blip that dissipates over 2-3 seconds
- Collected resources leave a brief sparkle at their position (0.5s)
- Projectile impacts leave scorch marks that fade over 5s (if visible area)
- Battle areas accumulate visual "noise" that slowly clears — gives a sense of history

#### Layer 7: Anticipation and Follow-Through (P2)

Animations have three phases: anticipation → action → follow-through:
- **Dash ability:** Brief 0.1s "coil" (player triangle compresses slightly) → instant burst → 0.3s "settle" (speed returns to normal with slight overshoot)
- **Blast ability:** 0.05s "charge" (white glow intensifies at center) → ring expands → 0.2s "afterglow" at origin
- **Enemy attack:** 0.3s "telegraph" (enemy flashes or glows before firing) → attack → impact

#### Layer 8: Environmental Reaction (P3)

The world responds to events:
- Nearby ambient particles scatter from explosions
- Radar scanlines briefly distort near damage events
- Tow rope tension visualized (tight = player moving fast, slack = player stopped)
- Ping ring wavers slightly near large energy sources

---

## The Juice Audit

For each player action in the game, audit the feedback chain:

### Audit Template

```
ACTION: [what the player does]

Current feedback:
  Layer 1 (instant visual): [yes/no — what?]
  Layer 2 (animation): [yes/no — what?]
  Layer 3 (color): [yes/no — what?]
  Layer 4 (particles): [yes/no — what?]
  Layer 5 (screen): [yes/no — what?]
  Layer 6 (persistence): [yes/no — what?]
  Layer 7 (anticipation): [yes/no — what?]
  Layer 8 (environmental): [yes/no — what?]

Missing layers: [which layers are absent?]
Recommendation: [what to add, in priority order]
Estimated impact: [how much better will this feel?]
```

### Over-Juicing Warning Signs

- **Visual noise:** So many effects firing that the player can't track gameplay-critical elements
- **Fatigue:** Effects that were exciting the first time become annoying by the hundredth
- **Masking:** Juice effects hiding important information (particle burst obscuring incoming enemy)
- **Inconsistency:** Some actions heavily juiced while similar actions have no feedback
- **Performance:** Too many particles/effects causing frame drops (defeats the purpose entirely)

**The test:** Remove all juice. Is the game still fun to play? If yes, add juice back one layer at a time. If no, the game design needs work, not more juice.

---

## Reward Psychology

### Reward Schedules

| Schedule | Pattern | Engagement Level | Example in This Game |
|----------|---------|-----------------|---------------------|
| **Fixed Ratio** | Reward after N actions | Moderate — predictable but motivating | Upgrade costs (collect X energy → buy upgrade) |
| **Variable Ratio** | Reward after random N actions | Highest — the "slot machine" effect | Random resource values (5-15), enemy spawns, POI types |
| **Fixed Interval** | Reward after set time | Low — players wait, then binge | Beacon energy generation (2/sec while in range) |
| **Variable Interval** | Reward at random times | Moderate — keeps players alert | Random ally encounters, salvage spawns |

**This game's reward mix:**
- Primary loop (collect → upgrade) = Fixed Ratio + Variable Ratio — good mix
- Salvage loop (find → tow → deposit) = Variable Interval (finding) + Fixed Ratio (depositing) — satisfying discovery + reliable payoff
- Exploration = Variable Ratio — "what will the next chunk contain?" drives exploration

### The Reward "Bump"

When the player receives a reward, amplify it with feedback proportional to value:

| Reward Value | Feedback |
|-------------|----------|
| Small (5 energy resource) | Quiet: small float text, subtle collection sound/flash |
| Medium (15 energy resource) | Moderate: larger float text, brief gold flash |
| Large (50 energy salvage deposit) | Strong: large float text, screen-edge gold pulse, particle burst |
| Milestone (first upgrade, clearing a wave) | Maximum: celebratory effect, score animation, brief slow-motion |

### Loss Aversion in Game Design

Players feel losses ~2x more strongly than equivalent gains. Use this:
- Damage numbers should be visually dramatic (red, larger font, screen effects)
- Health loss should feel urgent even at small amounts
- "Near miss" situations (surviving with low HP) should feel thrilling, not frustrating
- Death should feel significant but not punishing — show what was accomplished, not what was lost

---

## Difficulty Communication

### Visual Threat Language

Players should be able to assess danger at a glance:

**Size = threat level:**
- Scout: small blip (low threat, easily outrun)
- Ranged: medium blip (moderate threat, keep distance)
- Brute: large blip (high threat, avoid or prepare)

**Color saturation = immediate danger:**
- Enemy not aggro'd: desaturated red
- Enemy aggro'd and chasing: full red
- Enemy about to attack: bright red flash/pulse

**Motion = urgency:**
- Slow-moving: background threat, deal with later
- Fast-moving toward player: immediate attention required
- Projectile: fastest-moving red element on screen

### Difficulty Ramp Communication

The game's difficulty scales with distance from origin (`1 + log2(1 + dist/1000)`). The player should FEEL this without reading numbers:

**Environmental cues of increasing difficulty:**
1. **Density:** More enemy blips visible on radar at greater distances
2. **Darkness:** Subtly decrease ambient particle brightness or increase vignette intensity further from origin
3. **Tension in HUD:** Threat level indicator becomes more prominent (larger text, brighter color, pulsing) at higher values
4. **Audio cues:** (Future — when audio is added) Background drone pitch rises with threat level
5. **Radar noise:** Subtle static/noise overlay that increases with distance — the radar itself struggles at the frontier

### Telegraphing Attacks

Every enemy attack should be telegraphed before it lands:

| Enemy Type | Telegraph | Duration | Visual |
|-----------|-----------|----------|--------|
| Scout (contact) | Accelerates toward player | 0.5s before contact | Speed trail intensifies, blip pulses |
| Brute (contact) | Brief "wind-up" pause then charge | 0.3s pause + 0.5s charge | Blip grows 20%, then lunges |
| Ranged (projectile) | Stops moving, "aims" at player | 0.4s before firing | Blip flashes, line to player appears briefly |

Telegraphing serves two purposes:
1. **Fairness:** The player can react if they're paying attention
2. **Satisfaction:** Dodging a telegraphed attack feels skillful; dying to an untelegraphed one feels cheap

---

## Pacing and Rhythm

### The Ping as Heartbeat

The ping cooldown (1.5s base) is the game's fundamental rhythm. Everything syncs to it:

- **Information comes in pulses.** The player gets a burst of knowledge, then a period of acting on it.
- **Tension oscillates.** Ping fires = "I can see" = relief. Ping fading = "going blind again" = tension.
- **Actions cluster around pings.** Collecting, damaging, discovering all happen at ping contact — this creates natural moments of high activity separated by planning/movement.

**Design implications:**
- Don't add continuous information streams that bypass the ping rhythm — it would undermine the core tension
- Upgrades that reduce ping cooldown are the most impactful — they literally speed up the game's heartbeat
- Effects that persist between pings (towed salvage visibility, ability effects) are more valuable because they break the information scarcity

### Run Pacing (10-Minute Run)

| Phase | Time | Player State | Design Goal |
|-------|------|-------------|-------------|
| **Opening** | 0:00-2:00 | Exploring safe area, learning this run's layout | Build familiarity, low stress |
| **Expansion** | 2:00-5:00 | Venturing further, encountering threats, collecting | Build power, moderate challenge |
| **Decision Point** | 5:00-6:00 | Timer pressure — keep exploring or head back to base? | Create meaningful tension |
| **Preparation** | 6:00-8:00 | Returning to base, depositing salvage, buying upgrades | Anticipation of final wave |
| **Climax** | 8:00-10:00 | Fortifying, positioning for final wave | Rising tension, strategic decisions |
| **Final Wave** | 10:00+ | Defending base against wave | Peak intensity, payoff for preparation |
| **Resolution** | Wave cleared | Results screen, stats review | Satisfaction, planning next run |

### Micro-Pacing Within Combat

Combat should have rhythmic oscillation between tension and release:

1. **Detection:** Enemy appears on radar edge → anticipation rises
2. **Approach:** Enemy closes distance → tension builds
3. **Engagement:** Combat begins → peak tension, high action
4. **Resolution:** Enemy killed → brief moment of satisfaction
5. **Recovery:** Brief lull → player collects themselves, assesses next threat
6. **Repeat:** Next enemy or group engagement

If combat is constant without lulls, it becomes exhausting. If lulls are too long, the game feels empty. The POI system naturally creates this pacing — enemy camps create engagement clusters separated by exploration.

---

## Playtesting Heuristics

### The "Feel Check" Questions

After implementing any visual or UX change, play the game and ask:

1. **Clarity:** Can I always tell what's happening? Can I always tell what killed me?
2. **Responsiveness:** Does every input feel like it was received instantly?
3. **Satisfaction:** Did [action] feel good? Would I want to do it again?
4. **Readability:** Can I tell friend from foe at a glance? Can I read my health without focusing?
5. **Pacing:** Am I bored? Am I overwhelmed? Or am I in flow?
6. **Consistency:** Did that feel like everything else in the game? Or did it feel out of place?

### The 10-Second Rule

At any 10-second interval during gameplay, the player should be able to answer:
- What am I trying to do right now?
- What's threatening me?
- What are my options?

If ANY of these are unclear, there's a UX problem — either missing information, too much visual noise, or unclear game state communication.
