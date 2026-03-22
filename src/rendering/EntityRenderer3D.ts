/**
 * Entity render manager for 3D mesh rendering of game entities.
 *
 * Pre-generates mesh pools at init time (never in hot path).
 * Each frame, iterates over active entities, culls by distance, and draws with
 * appropriate tint, rotation, and damage flash.
 *
 * Handles: asteroids, home base, player ship, enemies (scout/brute/ranged/boss).
 */

import type { Renderer3D, MeshHandle } from './Renderer3D';
import { parseHexColor } from './Renderer3D';
import type { Asteroid, Enemy, GameEntity, HomeBase, Projectile, Salvage } from '../entities/Entity';
import type { MiningBot } from '../systems/MiningBotSystem';
import { MiningBotState } from '../systems/MiningBotSystem';
import type { CombatBot } from '../systems/CombatBotSystem';
import type { Missile } from '../systems/AbilitySystem';
import { getTheme } from '../themes/theme';
import { mat4 } from './math3d';
import {
  createAsteroidMesh,
  createHomeBaseMesh,
  createPlayerMesh,
  createScoutMesh,
  createBruteMesh,
  createRangedMesh,
  createBossMesh,
  createMiningBotMesh,
  createCombatBotMesh,
  createSalvageMesh,
  createProjectileMesh,
} from './meshes';

// ─── Constants ──────────────────────────────────────────────────────────

/** Number of mesh variants per asteroid size */
const VARIANTS_PER_SIZE = 10;

/** Base rotation speed range (rad/s) */
const ROTATION_SPEED_MIN = 0.2;
const ROTATION_SPEED_RANGE = 0.3;

/** Mining darkening: at full progress, color multiplied by this */
const MINING_DARKEN_FACTOR = 0.5;

/** Player banking: max roll angle in radians (~20 degrees) */
const MAX_BANK_ANGLE = 0.35;

/** Player banking: how much turnVelocity maps to roll (higher = more responsive) */
const BANK_SENSITIVITY = 0.08;

/** Player engine glow: tint boost when thrusting */
const ENGINE_GLOW_BOOST = 0.3;

/** Scout wobble: amplitude in radians */
const SCOUT_WOBBLE_AMP = 0.15;

/** Scout wobble: frequency multiplier */
const SCOUT_WOBBLE_FREQ = 8;

/** Brute rotation: slow constant Y rotation speed (rad/s) */
const BRUTE_ROTATION_SPEED = 0.5;

/** Ranged bobbing: amplitude in world units */
const RANGED_BOB_AMP = 3;

/** Ranged bobbing: frequency multiplier */
const RANGED_BOB_FREQ = 3;

/** Boss pulse: scale amplitude */
const BOSS_PULSE_AMP = 0.08;

/** Boss pulse: frequency multiplier */
const BOSS_PULSE_FREQ = 2;

/** Mining bot orbit rotation speed (rad/s) */
const MINING_BOT_SPIN_SPEED = 3;

/** Combat bot lifetime pulse frequency */
const COMBAT_BOT_PULSE_FREQ = 4;

/** Combat bot lifetime pulse: minimum tint multiplier when near expiry */
const COMBAT_BOT_PULSE_DIM = 0.4;

/** Salvage rotation speed (rad/s) */
const SALVAGE_ROTATION_SPEED = 1.5;

/** Salvage pulse amplitude */
const SALVAGE_PULSE_AMP = 0.15;

/** Salvage pulse frequency */
const SALVAGE_PULSE_FREQ = 3;

/** Enemy projectile scale */
const ENEMY_PROJ_SCALE = 1.0;

/** Combat bot projectile scale (tiny) */
const COMBAT_BOT_PROJ_SCALE = 0.5;

/** Homing missile scale (larger) */
const HOMING_MISSILE_SCALE = 1.5;

// ─── Material properties ──────────────────────────────────────────────────

/** Specular intensity for metallic entities (player, bots) */
const METALLIC_SPECULAR = 0.7;

/** Specular intensity for home base */
const HOME_BASE_SPECULAR = 0.3;

/** Emissive intensity for scout enemies (subtle glow) */
const SCOUT_EMISSIVE = 0.08;

/** Emissive intensity for brute enemies */
const BRUTE_EMISSIVE = 0.12;

/** Emissive intensity for ranged enemies */
const RANGED_EMISSIVE = 0.1;

/** Boss emissive intensity at phase 2 */
const BOSS_PHASE2_EMISSIVE = 0.2;

/** Boss emissive intensity at phase 3 (base, before pulse) */
const BOSS_PHASE3_EMISSIVE = 0.35;

/** Boss emissive pulse amplitude at phase 3 */
const BOSS_PHASE3_PULSE_AMP = 0.15;

/** Boss emissive pulse frequency at phase 3 */
const BOSS_PHASE3_PULSE_FREQ = 4;

/** Salvage emissive glow (subtle amber) */
const SALVAGE_EMISSIVE = 0.1;

/** Projectile emissive intensity (bright, should trigger bloom) */
const PROJECTILE_EMISSIVE = 0.4;

// ─── Pre-allocated color cache for theme colors ──────────────────────────

/** Cached parsed theme colors to avoid per-frame hex parsing.
 *  Updated when theme name changes. */
let cachedThemeName = '';
const cachedColors = {
  asteroid: [0, 0, 0] as [number, number, number],
  enemyScout: [0, 0, 0] as [number, number, number],
  enemyBrute: [0, 0, 0] as [number, number, number],
  enemyRanged: [0, 0, 0] as [number, number, number],
  enemyBoss: [0, 0, 0] as [number, number, number],
  salvage: [0, 0, 0] as [number, number, number],
  miningBot: [0, 0, 0] as [number, number, number],
  combatBot: [0, 0, 0] as [number, number, number],
  botProjectile: [0, 0, 0] as [number, number, number],
  enemy: [0, 0, 0] as [number, number, number],
};

/** Refresh cached parsed colors if the theme has changed. No-alloc when unchanged. */
function refreshThemeColors(): void {
  const theme = getTheme();
  if (theme.name === cachedThemeName) return;
  cachedThemeName = theme.name;
  const e = theme.entities;
  const copy = (dst: [number, number, number], hex: string) => {
    const [r, g, b] = parseHexColor(hex);
    dst[0] = r; dst[1] = g; dst[2] = b;
  };
  copy(cachedColors.asteroid, e.asteroid);
  copy(cachedColors.enemyScout, e.enemyScout);
  copy(cachedColors.enemyBrute, e.enemyBrute);
  copy(cachedColors.enemyRanged, e.enemyRanged);
  copy(cachedColors.enemyBoss, e.enemyBoss);
  copy(cachedColors.salvage, e.salvage);
  copy(cachedColors.miningBot, e.miningBot);
  copy(cachedColors.combatBot, e.combatBot);
  copy(cachedColors.botProjectile, e.botProjectile);
  copy(cachedColors.enemy, e.enemy);
}

// ─── Position hash for deterministic seeding ────────────────────────────

/** Hash a position into a deterministic integer seed */
function positionSeed(x: number, y: number): number {
  return ((x * 73856093) ^ (y * 19349663)) | 0;
}

// ─── EntityRenderer3D class ─────────────────────────────────────────────

export class EntityRenderer3D {
  private renderer: Renderer3D;

  // Asteroid mesh pools: [small][0..9], [medium][0..9], [large][0..9]
  private asteroidHandles: {
    small: MeshHandle[];
    medium: MeshHandle[];
    large: MeshHandle[];
  };

  // Home base mesh
  private homeBaseHandle: MeshHandle;

  // Player mesh
  private playerHandle: MeshHandle;

  // Enemy meshes (one per subtype + boss)
  private scoutHandle: MeshHandle;
  private bruteHandle: MeshHandle;
  private rangedHandle: MeshHandle;
  private bossHandle: MeshHandle;

  // Bot meshes
  private miningBotHandle: MeshHandle;
  private combatBotHandle: MeshHandle;

  // Salvage and projectile meshes
  private salvageHandle: MeshHandle;
  private projectileHandle: MeshHandle;

  constructor(renderer: Renderer3D) {
    this.renderer = renderer;

    // Pre-generate asteroid mesh pool
    this.asteroidHandles = {
      small: [],
      medium: [],
      large: [],
    };

    const sizes = ['small', 'medium', 'large'] as const;
    for (const size of sizes) {
      for (let i = 0; i < VARIANTS_PER_SIZE; i++) {
        const mesh = createAsteroidMesh(size, i * 7919 + 42);
        this.asteroidHandles[size].push(renderer.uploadMesh(mesh));
      }
    }

    // Pre-generate home base mesh
    this.homeBaseHandle = renderer.uploadMesh(createHomeBaseMesh());

    // Pre-generate player mesh
    this.playerHandle = renderer.uploadMesh(createPlayerMesh());

    // Pre-generate enemy meshes
    this.scoutHandle = renderer.uploadMesh(createScoutMesh());
    this.bruteHandle = renderer.uploadMesh(createBruteMesh());
    this.rangedHandle = renderer.uploadMesh(createRangedMesh());
    this.bossHandle = renderer.uploadMesh(createBossMesh());

    // Pre-generate bot meshes
    this.miningBotHandle = renderer.uploadMesh(createMiningBotMesh());
    this.combatBotHandle = renderer.uploadMesh(createCombatBotMesh());

    // Pre-generate salvage and projectile meshes
    this.salvageHandle = renderer.uploadMesh(createSalvageMesh());
    this.projectileHandle = renderer.uploadMesh(createProjectileMesh());
  }

  /**
   * Render all visible asteroids from the entity list.
   * Applies rotation, damage flash, mining darkening, and visibility culling.
   */
  renderAsteroids(
    entities: readonly GameEntity[],
    playerX: number,
    playerY: number,
    viewRadius: number,
    time: number,
  ): void {
    refreshThemeColors();
    const viewRadiusSq = viewRadius * viewRadius;

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (entity.type !== 'asteroid' || !entity.active) continue;

      const asteroid = entity as Asteroid;

      // Visibility culling: squared distance check
      const dx = asteroid.x - playerX;
      const dy = asteroid.y - playerY;
      const distSq = dx * dx + dy * dy;
      if (distSq > viewRadiusSq) continue;

      // Determine mesh variant from position hash
      const seed = positionSeed(asteroid.x, asteroid.y);
      const variantIndex = ((seed & 0x7fffffff) % VARIANTS_PER_SIZE);
      const handle = this.asteroidHandles[asteroid.size][variantIndex];

      // Rotation: Y-axis, speed based on position seed
      const seedFrac = ((seed & 0xffff) / 0xffff); // 0-1
      const rotationSpeed = ROTATION_SPEED_MIN + seedFrac * ROTATION_SPEED_RANGE;
      const rotationY = time * rotationSpeed;

      // Tint: start white (no tint), darken with mining progress
      const miningDarken = 1 - asteroid.miningProgress * MINING_DARKEN_FACTOR;
      const tintR = miningDarken;
      const tintG = miningDarken;
      const tintB = miningDarken;

      // Damage flash: override tint toward white
      const flash = asteroid.damageFlash > 0 ? Math.min(asteroid.damageFlash, 1) : 0;

      // Asteroids are matte: zero specular, no emissive
      this.renderer.drawMeshTinted(
        handle,
        asteroid.x,
        asteroid.y,
        rotationY,
        1, // scale = 1 (mesh already sized per category)
        tintR,
        tintG,
        tintB,
        flash,
        0, // matte - no specular
      );
    }
  }

  /**
   * Render the home base at its world position.
   * Tints red when damaged, with subtle scale pulse.
   */
  renderHomeBase(homeBase: HomeBase, time: number): void {
    const hpRatio = homeBase.maxHealth > 0
      ? homeBase.health / homeBase.maxHealth
      : 1;

    // Interpolate from blue-white (full HP) to red (0 HP)
    const tintR = 1;
    const tintG = 0.3 + hpRatio * 0.7;
    const tintB = 0.3 + hpRatio * 0.7;

    // Subtle scale pulse
    const pulse = 1 + Math.sin(time * 2) * 0.02;

    this.renderer.drawMeshTinted(
      this.homeBaseHandle,
      homeBase.x,
      homeBase.y,
      0, // no rotation
      pulse,
      tintR,
      tintG,
      tintB,
      0, // no flash
      HOME_BASE_SPECULAR,
    );
  }

  /**
   * Render the player ship at the given world position.
   * The ship always points up (camera rotates the world). Banking animation
   * tilts the ship based on turnVelocity. Engine glow tints brighter when thrusting.
   *
   * @param x Player world X
   * @param y Player world Y
   * @param turnVelocity Current turn velocity (rad/s, positive = clockwise)
   * @param thrust Current thrust input (-1 to 1, 0 = no thrust)
   * @param time Game time in seconds
   */
  renderPlayer(
    x: number,
    y: number,
    turnVelocity: number,
    thrust: number,
    time: number,
  ): void {
    // Build model matrix: translate to world position, then bank (roll on Z)
    // The camera already handles world rotation so the ship always faces up (+Z in mesh space)
    let model = mat4.translate(mat4.identity(), x, 0, y);

    // Banking: roll proportional to turnVelocity, clamped
    const bankAngle = Math.max(-MAX_BANK_ANGLE, Math.min(MAX_BANK_ANGLE, -turnVelocity * BANK_SENSITIVITY));
    if (bankAngle !== 0) {
      model = mat4.rotateZ(model, bankAngle);
    }

    // Engine glow: brighten tint when thrusting (thrust > 0 = forward)
    const thrustAmount = Math.max(0, thrust);
    const glow = thrustAmount * ENGINE_GLOW_BOOST;
    const tintR = 1 + glow * 0.3; // slight warm shift when thrusting
    const tintG = 1 + glow;
    const tintB = 1 + glow * 0.8;

    // Engine emissive: subtle glow when thrusting, visible even in shadow
    const emissiveStr = thrustAmount * 0.15;

    this.renderer.drawMeshWithMatrix(
      this.playerHandle,
      model,
      Math.min(tintR, 1.5),
      Math.min(tintG, 1.5),
      Math.min(tintB, 1.5),
      0, // no flash
      METALLIC_SPECULAR,
      emissiveStr * 0.3,  // warm R
      emissiveStr,         // green (engine color)
      emissiveStr * 0.8,   // cyan-ish B
    );
  }

  /**
   * Render all visible enemies from the entity list.
   * Each subtype has a distinct mesh and animation:
   * - Scout: faces movement direction, slight wobble
   * - Brute: faces movement direction, slow constant rotation
   * - Ranged: faces movement direction, gentle bobbing
   * - Boss: large hexagonal prism, pulsing scale, phase-based color shift
   *
   * Ghost blips and labels remain 2D overlays (handled by BlipRenderer).
   */
  renderEnemies(
    entities: readonly GameEntity[],
    playerX: number,
    playerY: number,
    viewRadius: number,
    time: number,
  ): void {
    const viewRadiusSq = viewRadius * viewRadius;

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (entity.type !== 'enemy' || !entity.active || !entity.visible) continue;

      const enemy = entity as Enemy;

      // Visibility culling
      const dx = enemy.x - playerX;
      const dy = enemy.y - playerY;
      const distSq = dx * dx + dy * dy;
      if (distSq > viewRadiusSq) continue;

      // Heading from velocity: atan2(vy, vx) maps to Y-axis rotation in 3D
      // In our 3D space: world X = 3D X, world Y (2D) = 3D Z
      // Mesh faces +Z, so we rotate by -atan2(vx, vy) to point along velocity
      const heading = (enemy.vx !== 0 || enemy.vy !== 0)
        ? -Math.atan2(enemy.vx, enemy.vy)
        : 0;

      if (enemy.isBoss) {
        this.renderBoss(enemy, heading, time);
      } else if (enemy.subtype === 'scout') {
        this.renderScout(enemy, heading, time);
      } else if (enemy.subtype === 'brute') {
        this.renderBrute(enemy, heading, time);
      } else {
        this.renderRanged(enemy, heading, time);
      }
    }
  }

  private renderScout(enemy: Enemy, heading: number, time: number): void {
    refreshThemeColors();
    let model = mat4.translate(mat4.identity(), enemy.x, 0, enemy.y);
    model = mat4.rotateY(model, heading);

    // Slight wobble on Z-axis
    const wobble = Math.sin(time * SCOUT_WOBBLE_FREQ) * SCOUT_WOBBLE_AMP;
    model = mat4.rotateZ(model, wobble);

    const c = cachedColors.enemyScout;
    this.renderer.drawMeshWithMatrix(
      this.scoutHandle, model, 1, 1, 1, 0,
      0, // no specular (organic enemy)
      c[0] * SCOUT_EMISSIVE, c[1] * SCOUT_EMISSIVE, c[2] * SCOUT_EMISSIVE,
    );
  }

  private renderBrute(enemy: Enemy, heading: number, time: number): void {
    refreshThemeColors();
    let model = mat4.translate(mat4.identity(), enemy.x, 0, enemy.y);
    // Face movement direction + slow constant rotation
    model = mat4.rotateY(model, heading + time * BRUTE_ROTATION_SPEED);

    const c = cachedColors.enemyBrute;
    this.renderer.drawMeshWithMatrix(
      this.bruteHandle, model, 1, 1, 1, 0,
      0,
      c[0] * BRUTE_EMISSIVE, c[1] * BRUTE_EMISSIVE, c[2] * BRUTE_EMISSIVE,
    );
  }

  private renderRanged(enemy: Enemy, heading: number, time: number): void {
    refreshThemeColors();
    // Gentle bobbing: translate Y up/down
    const bob = Math.sin(time * RANGED_BOB_FREQ) * RANGED_BOB_AMP;
    let model = mat4.translate(mat4.identity(), enemy.x, bob, enemy.y);
    model = mat4.rotateY(model, heading);

    const c = cachedColors.enemyRanged;
    this.renderer.drawMeshWithMatrix(
      this.rangedHandle, model, 1, 1, 1, 0,
      0,
      c[0] * RANGED_EMISSIVE, c[1] * RANGED_EMISSIVE, c[2] * RANGED_EMISSIVE,
    );
  }

  private renderBoss(enemy: Enemy, heading: number, time: number): void {
    refreshThemeColors();
    // Pulsing scale
    const pulse = 1 + Math.sin(time * BOSS_PULSE_FREQ) * BOSS_PULSE_AMP;
    let model = mat4.translate(mat4.identity(), enemy.x, 0, enemy.y);
    model = mat4.rotateY(model, heading);
    model = mat4.scale(model, pulse, pulse, pulse);

    // Phase-based color shift:
    // Phase 1: white tint (default)
    // Phase 2: orange tint
    // Phase 3: red tint
    let tintR = 1;
    let tintG = 1;
    let tintB = 1;

    // Phase-based emissive glow
    let emR = 0;
    let emG = 0;
    let emB = 0;
    const c = cachedColors.enemyBoss;

    if (enemy.bossPhase >= 3) {
      tintR = 1.3;
      tintG = 0.5;
      tintB = 0.4;
      // Phase 3: red pulsing emissive
      const emPulse = BOSS_PHASE3_EMISSIVE + Math.sin(time * BOSS_PHASE3_PULSE_FREQ) * BOSS_PHASE3_PULSE_AMP;
      emR = c[0] * emPulse;
      emG = c[1] * emPulse * 0.5; // suppress green for redder glow
      emB = c[2] * emPulse * 0.3;
    } else if (enemy.bossPhase >= 2) {
      tintR = 1.2;
      tintG = 0.8;
      tintB = 0.5;
      // Phase 2: steady orange emissive
      emR = c[0] * BOSS_PHASE2_EMISSIVE;
      emG = c[1] * BOSS_PHASE2_EMISSIVE * 0.7;
      emB = c[2] * BOSS_PHASE2_EMISSIVE * 0.3;
    }

    this.renderer.drawMeshWithMatrix(
      this.bossHandle, model, tintR, tintG, tintB, 0,
      0, // no specular (boss is organic/magical)
      emR, emG, emB,
    );
  }

  /**
   * Render all active mining bots as 3D icospheres.
   * Bots in Mining state spin around their orbit angle.
   * Bots in Deploying state face their movement direction.
   */
  renderMiningBots(
    bots: readonly MiningBot[],
    playerX: number,
    playerY: number,
    viewRadius: number,
    time: number,
  ): void {
    const viewRadiusSq = viewRadius * viewRadius;

    for (let i = 0; i < bots.length; i++) {
      const bot = bots[i];
      if (!bot.active) continue;

      // Visibility culling
      const dx = bot.x - playerX;
      const dy = bot.y - playerY;
      if (dx * dx + dy * dy > viewRadiusSq) continue;

      // Rotation: spinning when mining, heading-based when deploying
      const rotY = bot.state === MiningBotState.Mining
        ? time * MINING_BOT_SPIN_SPEED
        : -Math.atan2(bot.vx, bot.vy);

      this.renderer.drawMeshTinted(
        this.miningBotHandle,
        bot.x,
        bot.y,
        rotY,
        1,
        1, 1, 1, // white tint (no tint)
        0, // no flash
        METALLIC_SPECULAR, // metallic bot
      );
    }
  }

  /**
   * Render all active combat bots as 3D chevrons.
   * Facing movement direction. Lifetime-based pulsing: brighter when fresh, dimmer near expiry.
   */
  renderCombatBots(
    bots: readonly CombatBot[],
    playerX: number,
    playerY: number,
    viewRadius: number,
    time: number,
  ): void {
    const viewRadiusSq = viewRadius * viewRadius;

    for (let i = 0; i < bots.length; i++) {
      const bot = bots[i];
      if (!bot.active) continue;

      // Visibility culling
      const dx = bot.x - playerX;
      const dy = bot.y - playerY;
      if (dx * dx + dy * dy > viewRadiusSq) continue;

      // Heading from velocity
      const heading = (bot.vx !== 0 || bot.vy !== 0)
        ? -Math.atan2(bot.vx, bot.vy)
        : 0;

      // Lifetime-based pulse: bots near expiry dim and pulse faster
      const lifetimeRatio = bot.maxLifetime > 0 ? bot.lifetime / bot.maxLifetime : 1;
      const baseBrightness = COMBAT_BOT_PULSE_DIM + (1 - COMBAT_BOT_PULSE_DIM) * lifetimeRatio;
      const pulseSpeed = COMBAT_BOT_PULSE_FREQ * (2 - lifetimeRatio); // faster when dying
      const pulse = baseBrightness + Math.sin(time * pulseSpeed) * 0.1 * (1 - lifetimeRatio);

      const tint = Math.max(COMBAT_BOT_PULSE_DIM, Math.min(1.2, pulse));

      let model = mat4.translate(mat4.identity(), bot.x, 0, bot.y);
      model = mat4.rotateY(model, heading);

      this.renderer.drawMeshWithMatrix(
        this.combatBotHandle,
        model,
        tint, tint, tint,
        0, // no flash
        METALLIC_SPECULAR, // metallic bot
      );
    }
  }

  /**
   * Render all active visible salvage as rotating 3D diamonds.
   * Applies damage flash and gentle pulsing tint.
   */
  renderSalvage(
    entities: readonly GameEntity[],
    playerX: number,
    playerY: number,
    viewRadius: number,
    time: number,
  ): void {
    refreshThemeColors();
    const viewRadiusSq = viewRadius * viewRadius;
    const sc = cachedColors.salvage;

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (entity.type !== 'salvage' || !entity.active || !entity.visible) continue;

      const salvage = entity as Salvage;

      // Visibility culling
      const dx = salvage.x - playerX;
      const dy = salvage.y - playerY;
      if (dx * dx + dy * dy > viewRadiusSq) continue;

      // Rotation: constant Y-axis spin
      const rotY = time * SALVAGE_ROTATION_SPEED;

      // Pulsing scale
      const pulse = 1 + Math.sin(time * SALVAGE_PULSE_FREQ) * SALVAGE_PULSE_AMP;

      // Damage flash
      const flash = salvage.damageFlash > 0 ? Math.min(salvage.damageFlash, 1) : 0;

      this.renderer.drawMeshTinted(
        this.salvageHandle,
        salvage.x,
        salvage.y,
        rotY,
        pulse,
        1, 1, 1, // white tint (mesh has amber color baked in)
        flash,
        0, // no specular
        sc[0] * SALVAGE_EMISSIVE, sc[1] * SALVAGE_EMISSIVE, sc[2] * SALVAGE_EMISSIVE,
      );
    }
  }

  /**
   * Render all active projectiles as small 3D elongated shapes.
   * Enemy projectiles, combat bot projectiles (from CombatSystem), and homing missiles
   * all use the same mesh at different scales and tint colors.
   */
  renderProjectiles(
    enemyProjectiles: readonly Projectile[],
    combatBotProjectiles: readonly Projectile[],
    homingMissiles: readonly Missile[],
    playerX: number,
    playerY: number,
    viewRadius: number,
    _time: number,
  ): void {
    const viewRadiusSq = viewRadius * viewRadius;
    const pe = PROJECTILE_EMISSIVE;

    // Enemy projectiles — red tint, normal scale, red emissive
    for (let i = 0; i < enemyProjectiles.length; i++) {
      const p = enemyProjectiles[i];
      if (!p.active) continue;

      const dx = p.x - playerX;
      const dy = p.y - playerY;
      if (dx * dx + dy * dy > viewRadiusSq) continue;

      const heading = -Math.atan2(p.vx, p.vy);
      let model = mat4.translate(mat4.identity(), p.x, 0, p.y);
      model = mat4.rotateY(model, heading);
      model = mat4.scale(model, ENEMY_PROJ_SCALE, ENEMY_PROJ_SCALE, ENEMY_PROJ_SCALE);

      this.renderer.drawMeshWithMatrix(
        this.projectileHandle,
        model,
        1.2, 0.4, 0.3, // red tint
        0,
        0, // no specular
        pe, pe * 0.3, pe * 0.2, // red emissive for bloom
      );
    }

    // Combat bot projectiles — blue tint, tiny scale, blue emissive
    for (let i = 0; i < combatBotProjectiles.length; i++) {
      const p = combatBotProjectiles[i];
      if (!p.active) continue;

      const dx = p.x - playerX;
      const dy = p.y - playerY;
      if (dx * dx + dy * dy > viewRadiusSq) continue;

      const heading = -Math.atan2(p.vx, p.vy);
      let model = mat4.translate(mat4.identity(), p.x, 0, p.y);
      model = mat4.rotateY(model, heading);
      model = mat4.scale(model, COMBAT_BOT_PROJ_SCALE, COMBAT_BOT_PROJ_SCALE, COMBAT_BOT_PROJ_SCALE);

      this.renderer.drawMeshWithMatrix(
        this.projectileHandle,
        model,
        0.4, 0.6, 1.2, // blue tint
        0,
        0,
        pe * 0.2, pe * 0.4, pe, // blue emissive for bloom
      );
    }

    // Homing missiles — orange tint, larger scale, orange emissive
    for (let i = 0; i < homingMissiles.length; i++) {
      const m = homingMissiles[i];
      if (!m.active) continue;

      const dx = m.x - playerX;
      const dy = m.y - playerY;
      if (dx * dx + dy * dy > viewRadiusSq) continue;

      const heading = -Math.atan2(m.vx, m.vy);
      let model = mat4.translate(mat4.identity(), m.x, 0, m.y);
      model = mat4.rotateY(model, heading);
      model = mat4.scale(model, HOMING_MISSILE_SCALE, HOMING_MISSILE_SCALE, HOMING_MISSILE_SCALE);

      this.renderer.drawMeshWithMatrix(
        this.projectileHandle,
        model,
        1.3, 0.7, 0.2, // orange tint
        0,
        0,
        pe, pe * 0.5, pe * 0.1, // orange emissive for bloom
      );
    }
  }

  /** Clean up all GPU resources */
  dispose(): void {
    const sizes = ['small', 'medium', 'large'] as const;
    for (const size of sizes) {
      for (const handle of this.asteroidHandles[size]) {
        this.renderer.deleteMesh(handle);
      }
    }
    this.renderer.deleteMesh(this.homeBaseHandle);
    this.renderer.deleteMesh(this.playerHandle);
    this.renderer.deleteMesh(this.scoutHandle);
    this.renderer.deleteMesh(this.bruteHandle);
    this.renderer.deleteMesh(this.rangedHandle);
    this.renderer.deleteMesh(this.bossHandle);
    this.renderer.deleteMesh(this.miningBotHandle);
    this.renderer.deleteMesh(this.combatBotHandle);
    this.renderer.deleteMesh(this.salvageHandle);
    this.renderer.deleteMesh(this.projectileHandle);
  }
}
