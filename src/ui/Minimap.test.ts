import { describe, it, expect, beforeEach } from 'vitest';
import { Minimap } from './Minimap';
import { Player } from '../entities/Player';
import { createAlly, createDropoff, createEnemy, createResource, GameEntity } from '../entities/Entity';

describe('Minimap', () => {
  let minimap: Minimap;

  beforeEach(() => {
    minimap = new Minimap();
  });

  describe('getVisibleEntities', () => {
    it('includes dropoff entities', () => {
      const dropoff = createDropoff(100, 200);
      const result = minimap.getVisibleEntities([dropoff]);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('dropoff');
    });

    it('includes ally entities', () => {
      const ally = createAlly(100, 200, 'healer');
      const result = minimap.getVisibleEntities([ally]);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('ally');
    });

    it('includes visible enemy entities', () => {
      const enemy = createEnemy(100, 200, 'scout');
      enemy.visible = true;
      const result = minimap.getVisibleEntities([enemy]);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('enemy');
    });

    it('excludes invisible enemy entities', () => {
      const enemy = createEnemy(100, 200, 'scout');
      enemy.visible = false;
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
        createEnemy(300, 300, 'brute'),  // invisible by default
      ];
      const result = minimap.getVisibleEntities(entities);
      expect(result).toHaveLength(2); // dropoff + ally
    });
  });

  describe('worldToMinimap', () => {
    it('maps player position to minimap center', () => {
      const player = new Player(500, 500);
      const pos = minimap.worldToMinimap(500, 500, player, 800, 600);
      // Should be at the center of the minimap area
      expect(pos.x).toBeCloseTo(pos.centerX);
      expect(pos.y).toBeCloseTo(pos.centerY);
    });

    it('maps offset entities to offset positions on minimap', () => {
      const player = new Player(500, 500);
      // Entity 1000px to the right of player
      const pos = minimap.worldToMinimap(1500, 500, player, 800, 600);
      // Should be to the right of center
      expect(pos.x).toBeGreaterThan(pos.centerX);
      expect(pos.y).toBeCloseTo(pos.centerY);
    });

    it('clamps entities beyond world radius to minimap bounds', () => {
      const player = new Player(0, 0);
      // Entity very far away (beyond 2000px world radius)
      const pos = minimap.worldToMinimap(5000, 0, player, 800, 600);
      // x should be clamped within minimap bounds
      const maxOffset = minimap.getSize() / 2;
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
  });
});
