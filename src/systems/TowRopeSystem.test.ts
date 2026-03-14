import { describe, it, expect, beforeEach } from 'vitest';
import { createResource } from '../entities/Entity';
import { Player } from '../entities/Player';
import {
  TowRopeSystem,
  MAX_TOWED,
  FADE_OUT_DURATION,
} from './TowRopeSystem';

function buildResource(x = 100, y = 100) {
  return createResource(x, y);
}

describe('TowRopeSystem', () => {
  let system: TowRopeSystem;
  let player: Player;

  beforeEach(() => {
    system = new TowRopeSystem();
    player = new Player(0, 0);
  });

  describe('collect', () => {
    it('adds a resource to the towed chain', () => {
      const resource = buildResource();
      system.collect(resource, player);

      expect(system.getTowedItems()).toHaveLength(1);
      expect(system.getTowedItems()[0].resource).toBe(resource);
    });

    it('marks the resource as towed with initial physics state', () => {
      const resource = buildResource();
      system.collect(resource, player);

      expect(resource.towedByPlayer).toBe(true);
      expect(resource.towVx).toBe(0);
      expect(resource.towVy).toBe(0);
      expect(resource.towChainIndex).toBe(0);
    });

    it('assigns sequential chain indices', () => {
      const r1 = buildResource(50, 50);
      const r2 = buildResource(100, 100);
      system.collect(r1, player);
      system.collect(r2, player);

      expect(r1.towChainIndex).toBe(0);
      expect(r2.towChainIndex).toBe(1);
    });

    it('ignores already-towed resources', () => {
      const resource = buildResource();
      system.collect(resource, player);
      system.collect(resource, player);

      expect(system.getTowedItems()).toHaveLength(1);
    });

    it('starts fading the oldest item when exceeding MAX_TOWED', () => {
      for (let i = 0; i <= MAX_TOWED; i++) {
        system.collect(buildResource(i * 20, i * 20), player);
      }

      // Should have MAX_TOWED + 1 items, with the oldest fading
      expect(system.getTowedItems()).toHaveLength(MAX_TOWED + 1);
      expect(system.getTowedItems()[0].fadeOut).toBe(FADE_OUT_DURATION);
    });

    it('keeps the resource position at its current world location', () => {
      const resource = buildResource(200, 300);
      system.collect(resource, player);

      expect(resource.x).toBe(200);
      expect(resource.y).toBe(300);
    });
  });

  describe('update - spring physics', () => {
    it('pulls a towed item toward the player via spring force', () => {
      const resource = buildResource(200, 0);
      system.collect(resource, player);

      // Run several frames to see movement
      for (let i = 0; i < 10; i++) {
        system.update(player, 1 / 60);
      }

      // Resource should have moved closer to player
      expect(resource.x).toBeLessThan(200);
    });

    it('chains items together — second item follows first, not player', () => {
      const r1 = buildResource(50, 0);
      const r2 = buildResource(100, 0);
      system.collect(r1, player);
      system.collect(r2, player);

      // Run physics
      for (let i = 0; i < 60; i++) {
        system.update(player, 1 / 60);
      }

      // r2 should be further from player than r1 (following the chain)
      const d1 = Math.sqrt(r1.x * r1.x + r1.y * r1.y);
      const d2 = Math.sqrt(r2.x * r2.x + r2.y * r2.y);
      expect(d2).toBeGreaterThan(d1);
    });

    it('applies exponential friction to velocity', () => {
      const resource = buildResource(200, 0);
      system.collect(resource, player);

      // Give it initial velocity
      system.getTowedItems()[0].vx = 100;
      system.update(player, 1 / 60);

      // Velocity should be decayed
      const item = system.getTowedItems()[0];
      expect(Math.abs(item.vx)).toBeLessThan(100);
    });

    it('syncs velocity back to resource tow fields', () => {
      const resource = buildResource(200, 0);
      system.collect(resource, player);
      system.update(player, 1 / 60);

      const item = system.getTowedItems()[0];
      expect(resource.towVx).toBe(item.vx);
      expect(resource.towVy).toBe(item.vy);
    });
  });

  describe('update - inter-item repulsion', () => {
    it('pushes overlapping items apart', () => {
      // Place two items at nearly the same spot
      const r1 = buildResource(50, 50);
      const r2 = buildResource(55, 50);
      system.collect(r1, player);
      system.collect(r2, player);

      // They're within REPULSION_RADIUS (5px apart < 20px)
      system.update(player, 1 / 60);

      const items = system.getTowedItems();
      // r1 should have been pushed left (negative vx component from repulsion)
      // r2 should have been pushed right (positive vx component from repulsion)
      expect(items[0].vx).toBeLessThan(items[1].vx);
    });
  });

  describe('update - fade-out', () => {
    it('removes items when fade-out timer reaches zero', () => {
      const resource = buildResource();
      system.collect(resource, player);
      system.getTowedItems()[0].fadeOut = 0.1;

      // Step past the fade-out time
      system.update(player, 0.15);

      expect(system.getTowedItems()).toHaveLength(0);
      expect(resource.towedByPlayer).toBe(false);
      expect(resource.active).toBe(false);
    });

    it('decrements fade-out timer each frame', () => {
      const resource = buildResource();
      system.collect(resource, player);
      system.getTowedItems()[0].fadeOut = FADE_OUT_DURATION;

      system.update(player, 1 / 60);

      const remaining = system.getTowedItems()[0].fadeOut!;
      expect(remaining).toBeLessThan(FADE_OUT_DURATION);
      expect(remaining).toBeGreaterThan(0);
    });

    it('re-indexes chain after removing faded items', () => {
      const r1 = buildResource(50, 0);
      const r2 = buildResource(100, 0);
      const r3 = buildResource(150, 0);
      system.collect(r1, player);
      system.collect(r2, player);
      system.collect(r3, player);

      // Fade out the first item
      system.getTowedItems()[0].fadeOut = 0.01;
      system.update(player, 0.02);

      const items = system.getTowedItems();
      expect(items).toHaveLength(2);
      expect(items[0].chainIndex).toBe(0);
      expect(items[1].chainIndex).toBe(1);
      expect(items[0].resource.towChainIndex).toBe(0);
      expect(items[1].resource.towChainIndex).toBe(1);
    });
  });

  describe('clear', () => {
    it('removes all towed items', () => {
      system.collect(buildResource(50, 50), player);
      system.collect(buildResource(100, 100), player);

      system.clear();

      expect(system.getTowedItems()).toHaveLength(0);
    });

    it('unmarks resources as towed', () => {
      const resource = buildResource();
      system.collect(resource, player);

      system.clear();

      expect(resource.towedByPlayer).toBe(false);
    });
  });

  describe('getTowedItems', () => {
    it('returns empty array when nothing is towed', () => {
      expect(system.getTowedItems()).toEqual([]);
    });

    it('returns items in chain order', () => {
      const r1 = buildResource(50, 0);
      const r2 = buildResource(100, 0);
      system.collect(r1, player);
      system.collect(r2, player);

      const items = system.getTowedItems();
      expect(items[0].resource).toBe(r1);
      expect(items[1].resource).toBe(r2);
    });
  });
});
