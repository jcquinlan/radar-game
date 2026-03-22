/**
 * Entity render manager for 3D mesh rendering of asteroids and home base.
 *
 * Pre-generates a pool of asteroid mesh variants at init time (never in hot path).
 * Each frame, iterates over active entities, culls by distance, and draws with
 * appropriate tint, rotation, and damage flash.
 */

import type { Renderer3D, MeshHandle } from './Renderer3D';
import type { Asteroid, GameEntity, HomeBase } from '../entities/Entity';
import { createAsteroidMesh, createHomeBaseMesh } from './meshes';

// ─── Constants ──────────────────────────────────────────────────────────

/** Number of mesh variants per asteroid size */
const VARIANTS_PER_SIZE = 10;

/** Base rotation speed range (rad/s) */
const ROTATION_SPEED_MIN = 0.2;
const ROTATION_SPEED_RANGE = 0.3;

/** Mining darkening: at full progress, color multiplied by this */
const MINING_DARKEN_FACTOR = 0.5;

/** Damage flash decay speed is handled by the game — we just read the value */

// ─── Position hash for deterministic seeding ────────────────────────────

/** Hash a position into a deterministic integer seed */
function positionSeed(x: number, y: number): number {
  // Large primes for spatial hashing, bitwise-or to integer
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
    const homeBaseMesh = createHomeBaseMesh();
    this.homeBaseHandle = renderer.uploadMesh(homeBaseMesh);
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
      let tintR = miningDarken;
      let tintG = miningDarken;
      let tintB = miningDarken;

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
    // At full HP: tint = [1, 1, 1] (no tint). At 0 HP: tint = [1, 0.3, 0.3]
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

  /** Clean up all GPU resources */
  dispose(): void {
    const sizes = ['small', 'medium', 'large'] as const;
    for (const size of sizes) {
      for (const handle of this.asteroidHandles[size]) {
        this.renderer.deleteMesh(handle);
      }
    }
    this.renderer.deleteMesh(this.homeBaseHandle);
  }
}
