import { describe, it, expect, beforeEach } from 'vitest';
import { Minimap } from './Minimap';
import { Player } from '../entities/Player';
import { createAsteroid, createDropoff, createEnemy, createResource, createSalvage, GameEntity } from '../entities/Entity';

describe('Minimap', () => {
  let minimap: Minimap;

  beforeEach(() => {
    minimap = new Minimap();
  });

  describe('getVisibleEntities (collapsed)', () => {
    it('includes dropoff entities', () => {
      const dropoff = createDropoff(100, 200);
      const result = minimap.getVisibleEntities([dropoff]);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('dropoff');
    });

    it('excludes enemy entities', () => {
      const enemy = createEnemy(100, 200, 'scout');
      enemy.visible = true;
      const result = minimap.getVisibleEntities([enemy]);
      expect(result).toHaveLength(0);
    });

    it('excludes resource entities', () => {
      const resource = createResource(100, 200);
      const result = minimap.getVisibleEntities([resource]);
      expect(result).toHaveLength(0);
    });

    it('excludes inactive entities', () => {
      const dropoff = createDropoff(100, 200);
      dropoff.active = false;
      const result = minimap.getVisibleEntities([dropoff]);
      expect(result).toHaveLength(0);
    });

    it('filters mixed entity arrays correctly', () => {
      const entities: GameEntity[] = [
        createResource(0, 0),
        createDropoff(100, 100),
        createEnemy(300, 300, 'brute'),
      ];
      const result = minimap.getVisibleEntities(entities);
      expect(result).toHaveLength(1); // dropoff only
    });
  });

  describe('getVisibleEntities (expanded)', () => {
    beforeEach(() => {
      // Force expanded state
      minimap.expand();
      // Advance animation past 0.5 threshold
      minimap.update(0.2);
    });

    it('includes all active entity types when expanded', () => {
      const entities: GameEntity[] = [
        createResource(0, 0),
        createDropoff(100, 100),
        createEnemy(300, 300, 'brute'),
        createSalvage(400, 400),
      ];
      const result = minimap.getVisibleEntities(entities);
      expect(result).toHaveLength(4);
    });

    it('still excludes inactive entities when expanded', () => {
      const enemy = createEnemy(0, 0, 'scout');
      enemy.active = false;
      const result = minimap.getVisibleEntities([enemy]);
      expect(result).toHaveLength(0);
    });
  });

  describe('update and animation', () => {
    it('starts fully collapsed', () => {
      expect(minimap.animProgress).toBe(0);
      expect(minimap.isExpanded()).toBe(false);
    });

    it('advances animProgress toward 1 when expanded', () => {
      minimap.expand();
      minimap.update(0.1); // 5 * 0.1 = 0.5
      expect(minimap.animProgress).toBeCloseTo(0.5);
    });

    it('reaches fully expanded after 0.2s', () => {
      minimap.expand();
      minimap.update(0.2); // 5 * 0.2 = 1.0
      expect(minimap.animProgress).toBe(1);
      expect(minimap.isExpanded()).toBe(true);
    });

    it('collapses back after toggle', () => {
      minimap.expand();
      minimap.update(0.2); // fully expanded
      minimap.collapse();
      minimap.update(0.2); // fully collapsed
      expect(minimap.animProgress).toBe(0);
      expect(minimap.isExpanded()).toBe(false);
    });

    it('toggle flips the target', () => {
      minimap.toggle();
      minimap.update(0.2);
      expect(minimap.isExpanded()).toBe(true);

      minimap.toggle();
      minimap.update(0.2);
      expect(minimap.isExpanded()).toBe(false);
    });

    it('does not overshoot 1 or undershoot 0', () => {
      minimap.expand();
      minimap.update(10); // way more than needed
      expect(minimap.animProgress).toBe(1);

      minimap.collapse();
      minimap.update(10);
      expect(minimap.animProgress).toBe(0);
    });
  });

  describe('hitTest', () => {
    it('returns true for point inside collapsed minimap', () => {
      minimap.initBounds(800, 600);

      // Collapsed minimap: x=20, y=600-20-160=420, size=160
      expect(minimap.hitTest(100, 500)).toBe(true);
    });

    it('returns false for point outside collapsed minimap', () => {
      minimap.initBounds(800, 600);

      expect(minimap.hitTest(400, 300)).toBe(false);
    });
  });

  describe('worldToMinimap', () => {
    it('maps player position to minimap center', () => {
      const player = new Player(500, 500);
      minimap.initBounds(800, 600);

      const pos = minimap.worldToMinimap(500, 500, player, 800, 600);
      expect(pos.x).toBeCloseTo(pos.centerX);
      expect(pos.y).toBeCloseTo(pos.centerY);
    });

    it('maps offset entities to offset positions on minimap', () => {
      const player = new Player(500, 500);
      minimap.initBounds(800, 600);

      const pos = minimap.worldToMinimap(1500, 500, player, 800, 600);
      expect(pos.x).toBeGreaterThan(pos.centerX);
      expect(pos.y).toBeCloseTo(pos.centerY);
    });

    it('clamps entities beyond world radius to minimap bounds', () => {
      const player = new Player(0, 0);
      minimap.initBounds(800, 600);

      const pos = minimap.worldToMinimap(5000, 0, player, 800, 600);
      const maxOffset = minimap.getCurrentSize() / 2;
      expect(pos.x - pos.centerX).toBeLessThanOrEqual(maxOffset);
    });
  });

  describe('zoom integration', () => {
    // We test the zoom's effect on worldToMinimap indirectly:
    // when expanded with zoom < 1, worldRadius increases, so distant entities
    // appear closer to center (smaller offset) than without zoom.

    function expandMinimap(m: Minimap): void {
      m.expand();
      for (let i = 0; i < 60; i++) m.update(1 / 60);
    }

    it('expanded minimap with no zoom uses default world radius', () => {
      const m = new Minimap();
      m.initBounds(800, 600);
      expandMinimap(m);

      const player = new Player(0, 0);
      // Render with no zoom to set internal state
      const ctx = { save: () => {}, restore: () => {}, fillStyle: '', fillRect: () => {}, strokeStyle: '', strokeRect: () => {}, lineWidth: 0, globalAlpha: 1, beginPath: () => {}, rect: () => {}, clip: () => {}, arc: () => {}, stroke: () => {}, fill: () => {}, moveTo: () => {}, lineTo: () => {}, font: '', textAlign: '', fillText: () => {} } as unknown as CanvasRenderingContext2D;
      m.render(ctx, player, [], 800, 600, undefined, undefined);

      const posDefault = m.worldToMinimap(1000, 0, player, 800, 600);
      const offsetDefault = posDefault.x - posDefault.centerX;

      // Render with zoom = 0.5 (zoomed out — should show wider area)
      m.render(ctx, player, [], 800, 600, undefined, 0.5);
      const posZoomed = m.worldToMinimap(1000, 0, player, 800, 600);
      const offsetZoomed = posZoomed.x - posZoomed.centerX;

      // Zoomed out means larger world radius, so same world distance maps to smaller screen offset
      expect(Math.abs(offsetZoomed)).toBeLessThan(Math.abs(offsetDefault));
    });

    it('collapsed minimap is unaffected by zoom level', () => {
      const m = new Minimap();
      m.initBounds(800, 600);
      const player = new Player(0, 0);

      const ctx = { save: () => {}, restore: () => {}, fillStyle: '', fillRect: () => {}, strokeStyle: '', strokeRect: () => {}, lineWidth: 0, globalAlpha: 1, beginPath: () => {}, rect: () => {}, clip: () => {}, arc: () => {}, stroke: () => {}, fill: () => {}, moveTo: () => {}, lineTo: () => {}, font: '', textAlign: '', fillText: () => {} } as unknown as CanvasRenderingContext2D;

      // Render collapsed with zoom = 1
      m.render(ctx, player, [], 800, 600, undefined, 1.0);
      const posNoZoom = m.worldToMinimap(500, 0, player, 800, 600);

      // Render collapsed with zoom = 0.5
      m.render(ctx, player, [], 800, 600, undefined, 0.5);
      const posZoomed = m.worldToMinimap(500, 0, player, 800, 600);

      // In collapsed state (animProgress = 0), lerp is entirely COLLAPSED_WORLD_RADIUS,
      // so zoom has no effect
      expect(posNoZoom.x).toBeCloseTo(posZoomed.x, 1);
    });

    it('expanded minimap with zoom > 1 shows tighter area', () => {
      const m = new Minimap();
      m.initBounds(800, 600);
      expandMinimap(m);

      const player = new Player(0, 0);
      const ctx = { save: () => {}, restore: () => {}, fillStyle: '', fillRect: () => {}, strokeStyle: '', strokeRect: () => {}, lineWidth: 0, globalAlpha: 1, beginPath: () => {}, rect: () => {}, clip: () => {}, arc: () => {}, stroke: () => {}, fill: () => {}, moveTo: () => {}, lineTo: () => {}, font: '', textAlign: '', fillText: () => {} } as unknown as CanvasRenderingContext2D;

      // Render with zoom = 1 (default)
      m.render(ctx, player, [], 800, 600, undefined, 1.0);
      const posDefault = m.worldToMinimap(1000, 0, player, 800, 600);
      const offsetDefault = posDefault.x - posDefault.centerX;

      // Render with zoom = 2.0 (zoomed in — should show tighter area)
      m.render(ctx, player, [], 800, 600, undefined, 2.0);
      const posZoomed = m.worldToMinimap(1000, 0, player, 800, 600);
      const offsetZoomed = posZoomed.x - posZoomed.centerX;

      // Zoomed in means smaller world radius, so same world distance maps to larger screen offset
      expect(Math.abs(offsetZoomed)).toBeGreaterThan(Math.abs(offsetDefault));
    });
  });

  describe('getEntityColor', () => {
    it('returns gold for dropoff entities', () => {
      const dropoff = createDropoff(0, 0);
      expect(minimap.getEntityColor(dropoff)).toBe('#ffdd00');
    });

    it('returns red for enemy entities', () => {
      const enemy = createEnemy(0, 0, 'scout');
      expect(minimap.getEntityColor(enemy)).toBe('#ff4141');
    });

    it('returns green for resource entities', () => {
      const resource = createResource(0, 0);
      expect(minimap.getEntityColor(resource)).toBe('#00ff41');
    });

    it('returns amber for asteroid entities', () => {
      const asteroid = createAsteroid(0, 0, 'medium');
      expect(minimap.getEntityColor(asteroid)).toBe('#cc8844');
    });
  });
});
