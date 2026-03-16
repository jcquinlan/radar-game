import { describe, it, expect, beforeEach } from 'vitest';
import { Minimap } from './Minimap';
import { Player } from '../entities/Player';
import { createAlly, createDropoff, createEnemy, createResource, createSalvage, GameEntity } from '../entities/Entity';

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

    it('excludes ally entities', () => {
      const ally = createAlly(100, 200, 'healer');
      const result = minimap.getVisibleEntities([ally]);
      expect(result).toHaveLength(0);
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
        createAlly(200, 200, 'beacon'),
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
        createAlly(200, 200, 'beacon'),
        createEnemy(300, 300, 'brute'),
        createSalvage(400, 400),
      ];
      const result = minimap.getVisibleEntities(entities);
      expect(result).toHaveLength(5);
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

  describe('getEntityColor', () => {
    it('returns gold for dropoff entities', () => {
      const dropoff = createDropoff(0, 0);
      expect(minimap.getEntityColor(dropoff)).toBe('#ffdd00');
    });

    it('returns blue for ally entities', () => {
      const ally = createAlly(0, 0, 'healer');
      expect(minimap.getEntityColor(ally)).toBe('#4488ff');
    });

    it('returns red for enemy entities', () => {
      const enemy = createEnemy(0, 0, 'scout');
      expect(minimap.getEntityColor(enemy)).toBe('#ff4141');
    });

    it('returns green for resource entities', () => {
      const resource = createResource(0, 0);
      expect(minimap.getEntityColor(resource)).toBe('#00ff41');
    });
  });
});
