import { describe, it, expect, vi } from 'vitest';
import { EntityRenderer3D } from './EntityRenderer3D';
import type { Renderer3D, MeshHandle } from './Renderer3D';
import type { Asteroid, Enemy, HomeBase, GameEntity } from '../entities/Entity';
import { createAsteroid, createEnemy, createHomeBase, createBossEnemy } from '../entities/Entity';

// ─── Mock Renderer ──────────────────────────────────────────────────────

function createMockRenderer() {
  let handleId = 0;
  const drawMeshTintedCalls: {
    handle: MeshHandle;
    worldX: number;
    worldY: number;
    rotationY: number;
    scale: number;
    tintR: number;
    tintG: number;
    tintB: number;
    flash: number;
  }[] = [];

  const drawMeshWithMatrixCalls: {
    handle: MeshHandle;
    modelMatrix: Float32Array;
    tintR: number;
    tintG: number;
    tintB: number;
    flash: number;
  }[] = [];

  const renderer = {
    uploadMesh: vi.fn(() => {
      handleId++;
      return {
        vao: { __vao: handleId },
        indexCount: 60,
        positionBuffer: { __buf: 'pos' + handleId },
        normalBuffer: { __buf: 'norm' + handleId },
        colorBuffer: { __buf: 'col' + handleId },
        indexBuffer: { __buf: 'idx' + handleId },
      } as unknown as MeshHandle;
    }),
    drawMeshTinted: vi.fn(
      (handle: MeshHandle, worldX: number, worldY: number, rotationY: number, scale: number, tintR: number, tintG: number, tintB: number, flash: number) => {
        drawMeshTintedCalls.push({ handle, worldX, worldY, rotationY, scale, tintR, tintG, tintB, flash });
      },
    ),
    drawMeshWithMatrix: vi.fn(
      (handle: MeshHandle, modelMatrix: Float32Array, tintR: number, tintG: number, tintB: number, flash: number) => {
        drawMeshWithMatrixCalls.push({ handle, modelMatrix, tintR, tintG, tintB, flash });
      },
    ),
    deleteMesh: vi.fn(),
  } as unknown as Renderer3D;

  return { renderer, drawMeshTintedCalls, drawMeshWithMatrixCalls };
}

// ─── Test helpers ───────────────────────────────────────────────────────

function makeAsteroid(overrides: Partial<Asteroid> = {}): Asteroid {
  const base = createAsteroid(100, 200, 'medium');
  return { ...base, ...overrides };
}

function makeEnemy(overrides: Partial<Enemy> = {}): Enemy {
  const base = createEnemy(50, 60, 'scout');
  return { ...base, visible: true, ...overrides };
}

function makeBoss(overrides: Partial<Enemy> = {}): Enemy {
  const base = createBossEnemy(100, 100);
  return { ...base, visible: true, ...overrides };
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('EntityRenderer3D', () => {
  describe('constructor', () => {
    it('uploads 30 asteroid meshes + 1 home base + 1 player + 4 enemy meshes = 36 uploads', () => {
      const { renderer } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      // 10 small + 10 medium + 10 large + 1 home base + 1 player + 4 enemies = 36
      expect(renderer.uploadMesh).toHaveBeenCalledTimes(36);

      entityRenderer.dispose();
    });
  });

  describe('renderAsteroids', () => {
    it('renders active asteroids within view radius', () => {
      const { renderer, drawMeshTintedCalls } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      const entities: GameEntity[] = [
        makeAsteroid({ x: 10, y: 20, active: true }),
      ];

      entityRenderer.renderAsteroids(entities, 0, 0, 500, 1.0);

      expect(drawMeshTintedCalls.length).toBe(1);
      expect(drawMeshTintedCalls[0].worldX).toBe(10);
      expect(drawMeshTintedCalls[0].worldY).toBe(20);

      entityRenderer.dispose();
    });

    it('culls asteroids outside view radius', () => {
      const { renderer, drawMeshTintedCalls } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      const entities: GameEntity[] = [
        makeAsteroid({ x: 1000, y: 1000, active: true }),
      ];

      entityRenderer.renderAsteroids(entities, 0, 0, 100, 1.0);

      expect(drawMeshTintedCalls.length).toBe(0);

      entityRenderer.dispose();
    });

    it('skips inactive asteroids', () => {
      const { renderer, drawMeshTintedCalls } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      const entities: GameEntity[] = [
        makeAsteroid({ x: 10, y: 20, active: false }),
      ];

      entityRenderer.renderAsteroids(entities, 0, 0, 500, 1.0);

      expect(drawMeshTintedCalls.length).toBe(0);

      entityRenderer.dispose();
    });

    it('applies damage flash when damageFlash > 0', () => {
      const { renderer, drawMeshTintedCalls } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      const entities: GameEntity[] = [
        makeAsteroid({ x: 10, y: 20, damageFlash: 0.7 }),
      ];

      entityRenderer.renderAsteroids(entities, 0, 0, 500, 1.0);

      expect(drawMeshTintedCalls[0].flash).toBeCloseTo(0.7, 1);

      entityRenderer.dispose();
    });

    it('darkens tint as mining progress increases', () => {
      const { renderer, drawMeshTintedCalls } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      const entities: GameEntity[] = [
        makeAsteroid({ x: 10, y: 20, miningProgress: 0.8 }),
      ];

      entityRenderer.renderAsteroids(entities, 0, 0, 500, 1.0);

      // miningDarken = 1 - 0.8 * 0.5 = 0.6
      expect(drawMeshTintedCalls[0].tintR).toBeCloseTo(0.6, 2);
      expect(drawMeshTintedCalls[0].tintG).toBeCloseTo(0.6, 2);
      expect(drawMeshTintedCalls[0].tintB).toBeCloseTo(0.6, 2);

      entityRenderer.dispose();
    });

    it('renders three different size categories', () => {
      const { renderer, drawMeshTintedCalls } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      const entities: GameEntity[] = [
        makeAsteroid({ x: 10, y: 10, size: 'small' }),
        makeAsteroid({ x: 20, y: 20, size: 'medium' }),
        makeAsteroid({ x: 30, y: 30, size: 'large' }),
      ];

      entityRenderer.renderAsteroids(entities, 0, 0, 500, 1.0);

      expect(drawMeshTintedCalls.length).toBe(3);

      entityRenderer.dispose();
    });

    it('applies rotation based on time', () => {
      const { renderer, drawMeshTintedCalls } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      const entities: GameEntity[] = [
        makeAsteroid({ x: 10, y: 20 }),
      ];

      entityRenderer.renderAsteroids(entities, 0, 0, 500, 0);
      const rotation0 = drawMeshTintedCalls[0].rotationY;

      drawMeshTintedCalls.length = 0;
      entityRenderer.renderAsteroids(entities, 0, 0, 500, 5);
      const rotation5 = drawMeshTintedCalls[0].rotationY;

      expect(rotation5).toBeGreaterThan(rotation0);

      entityRenderer.dispose();
    });
  });

  describe('renderHomeBase', () => {
    it('renders home base at its position', () => {
      const { renderer, drawMeshTintedCalls } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      const homeBase = createHomeBase(0, 0);
      entityRenderer.renderHomeBase(homeBase, 0);

      expect(drawMeshTintedCalls.length).toBe(1);
      expect(drawMeshTintedCalls[0].worldX).toBe(0);
      expect(drawMeshTintedCalls[0].worldY).toBe(0);

      entityRenderer.dispose();
    });

    it('tints red when home base is damaged', () => {
      const { renderer, drawMeshTintedCalls } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      const homeBase = createHomeBase(0, 0);
      homeBase.health = 200; // 50% HP

      entityRenderer.renderHomeBase(homeBase, 0);

      // At 50% HP: tintG = 0.3 + 0.5*0.7 = 0.65, tintB = 0.65
      expect(drawMeshTintedCalls[0].tintR).toBe(1);
      expect(drawMeshTintedCalls[0].tintG).toBeCloseTo(0.65, 2);
      expect(drawMeshTintedCalls[0].tintB).toBeCloseTo(0.65, 2);

      entityRenderer.dispose();
    });

    it('has no red tint at full HP', () => {
      const { renderer, drawMeshTintedCalls } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      const homeBase = createHomeBase(0, 0);

      entityRenderer.renderHomeBase(homeBase, 0);

      expect(drawMeshTintedCalls[0].tintR).toBe(1);
      expect(drawMeshTintedCalls[0].tintG).toBeCloseTo(1.0, 2);
      expect(drawMeshTintedCalls[0].tintB).toBeCloseTo(1.0, 2);

      entityRenderer.dispose();
    });

    it('applies subtle scale pulse based on time', () => {
      const { renderer, drawMeshTintedCalls } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      const homeBase = createHomeBase(0, 0);

      entityRenderer.renderHomeBase(homeBase, 0);
      const scale0 = drawMeshTintedCalls[0].scale;

      drawMeshTintedCalls.length = 0;
      entityRenderer.renderHomeBase(homeBase, Math.PI / 4); // sin(PI/2) = 1
      const scalePeak = drawMeshTintedCalls[0].scale;

      expect(scale0).toBeCloseTo(1.0, 1);
      expect(scalePeak).toBeCloseTo(1.02, 2);

      entityRenderer.dispose();
    });
  });

  describe('renderPlayer', () => {
    it('renders the player at the given world position', () => {
      const { renderer, drawMeshWithMatrixCalls } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      entityRenderer.renderPlayer(100, 200, 0, 0, 0);

      expect(drawMeshWithMatrixCalls.length).toBe(1);
      // Model matrix encodes translation: x=100, z=200 (world Y maps to 3D Z)
      const m = drawMeshWithMatrixCalls[0].modelMatrix;
      expect(m[12]).toBeCloseTo(100, 1); // tx
      expect(m[14]).toBeCloseTo(200, 1); // tz (world Y)

      entityRenderer.dispose();
    });

    it('applies no flash by default', () => {
      const { renderer, drawMeshWithMatrixCalls } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      entityRenderer.renderPlayer(0, 0, 0, 0, 0);

      expect(drawMeshWithMatrixCalls[0].flash).toBe(0);

      entityRenderer.dispose();
    });

    it('increases tint brightness when thrusting forward', () => {
      const { renderer, drawMeshWithMatrixCalls } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      // No thrust
      entityRenderer.renderPlayer(0, 0, 0, 0, 0);
      const noThrustG = drawMeshWithMatrixCalls[0].tintG;

      drawMeshWithMatrixCalls.length = 0;

      // Full thrust
      entityRenderer.renderPlayer(0, 0, 0, 1, 0);
      const fullThrustG = drawMeshWithMatrixCalls[0].tintG;

      expect(fullThrustG).toBeGreaterThan(noThrustG);

      entityRenderer.dispose();
    });

    it('does not boost tint when thrusting backward', () => {
      const { renderer, drawMeshWithMatrixCalls } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      // Backward thrust (negative)
      entityRenderer.renderPlayer(0, 0, 0, -1, 0);

      // Should be same as no thrust (glow = max(0, thrust) * boost)
      expect(drawMeshWithMatrixCalls[0].tintG).toBeCloseTo(1, 2);

      entityRenderer.dispose();
    });

    it('applies banking from turn velocity', () => {
      const { renderer, drawMeshWithMatrixCalls } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      // No turn
      entityRenderer.renderPlayer(0, 0, 0, 0, 0);
      const noTurnMatrix = new Float32Array(drawMeshWithMatrixCalls[0].modelMatrix);

      drawMeshWithMatrixCalls.length = 0;

      // Turning right (positive turnVelocity)
      entityRenderer.renderPlayer(0, 0, 3, 0, 0);
      const turningMatrix = drawMeshWithMatrixCalls[0].modelMatrix;

      // Matrices should differ (banking applied)
      let different = false;
      for (let j = 0; j < 16; j++) {
        if (Math.abs(noTurnMatrix[j] - turningMatrix[j]) > 0.001) {
          different = true;
          break;
        }
      }
      expect(different).toBe(true);

      entityRenderer.dispose();
    });
  });

  describe('renderEnemies', () => {
    it('renders a scout enemy within view radius', () => {
      const { renderer, drawMeshWithMatrixCalls } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      const entities: GameEntity[] = [
        makeEnemy({ x: 30, y: 40, subtype: 'scout', vx: 1, vy: 0 }),
      ];

      entityRenderer.renderEnemies(entities, 0, 0, 500, 0);

      expect(drawMeshWithMatrixCalls.length).toBe(1);

      entityRenderer.dispose();
    });

    it('renders different mesh handles for different subtypes', () => {
      const { renderer, drawMeshWithMatrixCalls } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      const entities: GameEntity[] = [
        makeEnemy({ x: 10, y: 10, subtype: 'scout' }),
        makeEnemy({ x: 20, y: 20, subtype: 'brute' }),
        makeEnemy({ x: 30, y: 30, subtype: 'ranged' }),
      ];

      entityRenderer.renderEnemies(entities, 0, 0, 500, 0);

      expect(drawMeshWithMatrixCalls.length).toBe(3);
      // Each should use a different mesh handle
      const handles = drawMeshWithMatrixCalls.map(c => c.handle);
      expect(handles[0]).not.toBe(handles[1]);
      expect(handles[1]).not.toBe(handles[2]);

      entityRenderer.dispose();
    });

    it('culls enemies outside view radius', () => {
      const { renderer, drawMeshWithMatrixCalls } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      const entities: GameEntity[] = [
        makeEnemy({ x: 2000, y: 2000, subtype: 'scout' }),
      ];

      entityRenderer.renderEnemies(entities, 0, 0, 100, 0);

      expect(drawMeshWithMatrixCalls.length).toBe(0);

      entityRenderer.dispose();
    });

    it('skips inactive enemies', () => {
      const { renderer, drawMeshWithMatrixCalls } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      const entities: GameEntity[] = [
        makeEnemy({ x: 10, y: 10, active: false }),
      ];

      entityRenderer.renderEnemies(entities, 0, 0, 500, 0);

      expect(drawMeshWithMatrixCalls.length).toBe(0);

      entityRenderer.dispose();
    });

    it('skips invisible enemies (ghost blips are 2D)', () => {
      const { renderer, drawMeshWithMatrixCalls } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      const entities: GameEntity[] = [
        makeEnemy({ x: 10, y: 10, visible: false, ghostX: 10, ghostY: 10 }),
      ];

      entityRenderer.renderEnemies(entities, 0, 0, 500, 0);

      expect(drawMeshWithMatrixCalls.length).toBe(0);

      entityRenderer.dispose();
    });

    it('renders enemies with no flash (Enemy type has no damageFlash)', () => {
      const { renderer, drawMeshWithMatrixCalls } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      const entities: GameEntity[] = [
        makeEnemy({ x: 10, y: 10 }),
      ];

      entityRenderer.renderEnemies(entities, 0, 0, 500, 0);

      expect(drawMeshWithMatrixCalls[0].flash).toBe(0);

      entityRenderer.dispose();
    });

    it('renders boss with phase-based color shift at phase 2', () => {
      const { renderer, drawMeshWithMatrixCalls } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      const entities: GameEntity[] = [
        makeBoss({ x: 10, y: 10, bossPhase: 2 }),
      ];

      entityRenderer.renderEnemies(entities, 0, 0, 500, 0);

      // Phase 2: orange tint (tintR > 1, tintG < 1)
      expect(drawMeshWithMatrixCalls[0].tintR).toBeGreaterThan(1);
      expect(drawMeshWithMatrixCalls[0].tintG).toBeLessThan(1);

      entityRenderer.dispose();
    });

    it('renders boss with phase-based color shift at phase 3', () => {
      const { renderer, drawMeshWithMatrixCalls } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      const entities: GameEntity[] = [
        makeBoss({ x: 10, y: 10, bossPhase: 3 }),
      ];

      entityRenderer.renderEnemies(entities, 0, 0, 500, 0);

      // Phase 3: red tint (tintR high, tintB low)
      expect(drawMeshWithMatrixCalls[0].tintR).toBeGreaterThan(1);
      expect(drawMeshWithMatrixCalls[0].tintB).toBeLessThan(0.5);

      entityRenderer.dispose();
    });

    it('boss has default white tint at phase 1', () => {
      const { renderer, drawMeshWithMatrixCalls } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      const entities: GameEntity[] = [
        makeBoss({ x: 10, y: 10, bossPhase: 1 }),
      ];

      entityRenderer.renderEnemies(entities, 0, 0, 500, 0);

      expect(drawMeshWithMatrixCalls[0].tintR).toBe(1);
      expect(drawMeshWithMatrixCalls[0].tintG).toBe(1);
      expect(drawMeshWithMatrixCalls[0].tintB).toBe(1);

      entityRenderer.dispose();
    });
  });

  describe('dispose', () => {
    it('deletes all uploaded meshes including player and enemy handles', () => {
      const { renderer } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      entityRenderer.dispose();

      // 30 asteroid + 1 home base + 1 player + 4 enemies = 36 deletions
      expect(renderer.deleteMesh).toHaveBeenCalledTimes(36);
    });
  });
});
