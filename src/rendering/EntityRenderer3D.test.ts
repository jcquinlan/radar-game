import { describe, it, expect, vi } from 'vitest';
import { EntityRenderer3D } from './EntityRenderer3D';
import type { Renderer3D, MeshHandle } from './Renderer3D';
import type { Asteroid, HomeBase, GameEntity } from '../entities/Entity';
import { createAsteroid, createHomeBase } from '../entities/Entity';

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
    deleteMesh: vi.fn(),
  } as unknown as Renderer3D;

  return { renderer, drawMeshTintedCalls };
}

// ─── Test helpers ───────────────────────────────────────────────────────

function makeAsteroid(overrides: Partial<Asteroid> = {}): Asteroid {
  const base = createAsteroid(100, 200, 'medium');
  return { ...base, ...overrides };
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('EntityRenderer3D', () => {
  describe('constructor', () => {
    it('uploads 30 asteroid meshes (10 per size) and 1 home base mesh', () => {
      const { renderer } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      // 10 small + 10 medium + 10 large + 1 home base = 31 uploads
      expect(renderer.uploadMesh).toHaveBeenCalledTimes(31);

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

      // Rotation should increase with time
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
      // Full HP: tintG = 0.3 + 1.0*0.7 = 1.0, tintB = 1.0

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

      // Pulse should vary the scale slightly
      expect(scale0).toBeCloseTo(1.0, 1);
      expect(scalePeak).toBeCloseTo(1.02, 2);

      entityRenderer.dispose();
    });
  });

  describe('dispose', () => {
    it('deletes all uploaded meshes', () => {
      const { renderer } = createMockRenderer();
      const entityRenderer = new EntityRenderer3D(renderer);

      entityRenderer.dispose();

      // 30 asteroid + 1 home base = 31 deletions
      expect(renderer.deleteMesh).toHaveBeenCalledTimes(31);
    });
  });
});
