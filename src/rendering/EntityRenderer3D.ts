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
import type { Asteroid, Enemy, GameEntity, HomeBase } from '../entities/Entity';
import { mat4 } from './math3d';
import {
  createAsteroidMesh,
  createHomeBaseMesh,
  createPlayerMesh,
  createScoutMesh,
  createBruteMesh,
  createRangedMesh,
  createBossMesh,
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

    this.renderer.drawMeshWithMatrix(
      this.playerHandle,
      model,
      Math.min(tintR, 1.5),
      Math.min(tintG, 1.5),
      Math.min(tintB, 1.5),
      0, // no flash
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
    let model = mat4.translate(mat4.identity(), enemy.x, 0, enemy.y);
    model = mat4.rotateY(model, heading);

    // Slight wobble on Z-axis
    const wobble = Math.sin(time * SCOUT_WOBBLE_FREQ) * SCOUT_WOBBLE_AMP;
    model = mat4.rotateZ(model, wobble);

    this.renderer.drawMeshWithMatrix(this.scoutHandle, model, 1, 1, 1, 0);
  }

  private renderBrute(enemy: Enemy, heading: number, time: number): void {
    let model = mat4.translate(mat4.identity(), enemy.x, 0, enemy.y);
    // Face movement direction + slow constant rotation
    model = mat4.rotateY(model, heading + time * BRUTE_ROTATION_SPEED);

    this.renderer.drawMeshWithMatrix(this.bruteHandle, model, 1, 1, 1, 0);
  }

  private renderRanged(enemy: Enemy, heading: number, time: number): void {
    // Gentle bobbing: translate Y up/down
    const bob = Math.sin(time * RANGED_BOB_FREQ) * RANGED_BOB_AMP;
    let model = mat4.translate(mat4.identity(), enemy.x, bob, enemy.y);
    model = mat4.rotateY(model, heading);

    this.renderer.drawMeshWithMatrix(this.rangedHandle, model, 1, 1, 1, 0);
  }

  private renderBoss(enemy: Enemy, heading: number, time: number): void {
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
    if (enemy.bossPhase >= 3) {
      tintR = 1.3;
      tintG = 0.5;
      tintB = 0.4;
    } else if (enemy.bossPhase >= 2) {
      tintR = 1.2;
      tintG = 0.8;
      tintB = 0.5;
    }

    this.renderer.drawMeshWithMatrix(this.bossHandle, model, tintR, tintG, tintB, 0);
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
  }
}
