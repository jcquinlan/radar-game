import { describe, it, expect, beforeEach } from 'vitest';
import { createSalvage, createDropoff, createHomeBase } from '../entities/Entity';
import { Player } from '../entities/Player';
import {
  TowRopeSystem,
  MAX_TOWED,
  FADE_OUT_DURATION,
  PICKUP_RADIUS,
} from './TowRopeSystem';

function buildSalvage(x = 100, y = 100) {
  return createSalvage(x, y);
}

describe('TowRopeSystem', () => {
  let system: TowRopeSystem;
  let player: Player;

  beforeEach(() => {
    system = new TowRopeSystem();
    player = new Player(0, 0);
  });

  describe('collect', () => {
    it('adds a salvage item to the towed list', () => {
      const salvage = buildSalvage();
      system.collect(salvage);

      expect(system.getTowedItems()).toHaveLength(1);
      expect(system.getTowedItems()[0].salvage).toBe(salvage);
    });

    it('marks the salvage as towed with initial physics state', () => {
      const salvage = buildSalvage();
      system.collect(salvage);

      expect(salvage.towedByPlayer).toBe(true);
      expect(salvage.towVx).toBe(0);
      expect(salvage.towVy).toBe(0);
    });

    it('ignores already-towed salvage', () => {
      const salvage = buildSalvage();
      system.collect(salvage);
      system.collect(salvage);

      expect(system.getTowedItems()).toHaveLength(1);
    });

    it('starts fading the oldest item when exceeding MAX_TOWED', () => {
      for (let i = 0; i <= MAX_TOWED; i++) {
        system.collect(buildSalvage(i * 20, i * 20));
      }

      expect(system.getTowedItems()).toHaveLength(MAX_TOWED + 1);
      expect(system.getTowedItems()[0].fadeOut).toBe(FADE_OUT_DURATION);
    });

    it('preserves the salvage position at its current world location', () => {
      const salvage = buildSalvage(200, 300);
      system.collect(salvage);

      expect(salvage.x).toBe(200);
      expect(salvage.y).toBe(300);
    });
  });

  describe('checkPickups', () => {
    it('picks up salvage within pickup radius', () => {
      const salvage = buildSalvage(10, 0); // Within 25px of player at origin
      const collected = system.checkPickups([salvage], player);

      expect(collected).toHaveLength(1);
      expect(collected[0]).toBe(salvage);
      expect(salvage.towedByPlayer).toBe(true);
    });

    it('ignores salvage outside pickup radius', () => {
      const salvage = buildSalvage(100, 0); // Well beyond 25px
      const collected = system.checkPickups([salvage], player);

      expect(collected).toHaveLength(0);
      expect(salvage.towedByPlayer).toBe(false);
    });

    it('ignores non-salvage entities', () => {
      const resource = { type: 'resource', active: true, x: 5, y: 0 };
      const collected = system.checkPickups([resource], player);

      expect(collected).toHaveLength(0);
    });

    it('ignores already-towed salvage', () => {
      const salvage = buildSalvage(10, 0);
      salvage.towedByPlayer = true;
      const collected = system.checkPickups([salvage], player);

      expect(collected).toHaveLength(0);
    });
  });

  describe('update - hub-and-spoke spring physics', () => {
    it('pulls a towed item toward the player', () => {
      const salvage = buildSalvage(200, 0);
      system.collect(salvage);

      for (let i = 0; i < 10; i++) {
        system.update(player, 1 / 60);
      }

      expect(salvage.x).toBeLessThan(200);
    });

    it('each item is anchored to the player independently', () => {
      const s1 = buildSalvage(80, 0);
      const s2 = buildSalvage(0, 80);
      system.collect(s1);
      system.collect(s2);

      for (let i = 0; i < 60; i++) {
        system.update(player, 1 / 60);
      }

      // Both should settle near their rope length from the player
      // They pull independently, not in a chain
      const d1 = Math.sqrt(s1.x * s1.x + s1.y * s1.y);
      const d2 = Math.sqrt(s2.x * s2.x + s2.y * s2.y);
      // Both should be roughly within rope length range (not one behind the other)
      expect(d1).toBeLessThan(80);
      expect(d2).toBeLessThan(80);
    });

    it('uses per-item rope length from the salvage entity', () => {
      const s1 = buildSalvage(200, 0);
      const s2 = buildSalvage(200, 0);
      // Force different rope lengths
      s1.ropeLength = 30;
      s2.ropeLength = 50;
      system.collect(s1);
      system.collect(s2);

      for (let i = 0; i < 120; i++) {
        system.update(player, 1 / 60);
      }

      // After settling, s2 should be further from player than s1
      const d1 = Math.sqrt(s1.x * s1.x + s1.y * s1.y);
      const d2 = Math.sqrt(s2.x * s2.x + s2.y * s2.y);
      expect(d2).toBeGreaterThan(d1);
    });

    it('applies exponential friction to velocity', () => {
      const salvage = buildSalvage(200, 0);
      system.collect(salvage);

      system.getTowedItems()[0].vx = 100;
      system.update(player, 1 / 60);

      expect(Math.abs(system.getTowedItems()[0].vx)).toBeLessThan(100);
    });

    it('syncs velocity back to salvage tow fields', () => {
      const salvage = buildSalvage(200, 0);
      system.collect(salvage);
      system.update(player, 1 / 60);

      const item = system.getTowedItems()[0];
      expect(salvage.towVx).toBe(item.vx);
      expect(salvage.towVy).toBe(item.vy);
    });
  });

  describe('update - inter-item repulsion', () => {
    it('pushes overlapping items apart', () => {
      const s1 = buildSalvage(50, 50);
      const s2 = buildSalvage(55, 50);
      system.collect(s1);
      system.collect(s2);

      system.update(player, 1 / 60);

      const items = system.getTowedItems();
      expect(items[0].vx).toBeLessThan(items[1].vx);
    });
  });

  describe('update - fade-out', () => {
    it('removes items when fade-out timer reaches zero', () => {
      const salvage = buildSalvage();
      system.collect(salvage);
      system.getTowedItems()[0].fadeOut = 0.1;

      system.update(player, 0.15);

      expect(system.getTowedItems()).toHaveLength(0);
      expect(salvage.towedByPlayer).toBe(false);
      expect(salvage.active).toBe(false);
    });

    it('decrements fade-out timer each frame', () => {
      const salvage = buildSalvage();
      system.collect(salvage);
      system.getTowedItems()[0].fadeOut = FADE_OUT_DURATION;

      system.update(player, 1 / 60);

      const remaining = system.getTowedItems()[0].fadeOut!;
      expect(remaining).toBeLessThan(FADE_OUT_DURATION);
      expect(remaining).toBeGreaterThan(0);
    });
  });

  describe('checkDropoffs', () => {
    it('deposits salvage when it enters a dropoff zone', () => {
      const dropoff = createDropoff(100, 0);
      const salvage = buildSalvage(100, 0); // Right on top of the dropoff
      system.collect(salvage);

      const deposited = system.checkDropoffs([dropoff]);

      expect(deposited).toHaveLength(1);
      expect(deposited[0].salvage).toBe(salvage);
      expect(deposited[0].dropoff).toBe(dropoff);
      expect(system.getTowedItems()).toHaveLength(0);
      expect(salvage.towedByPlayer).toBe(false);
      expect(salvage.active).toBe(false);
    });

    it('does not deposit salvage outside the dropoff radius', () => {
      const dropoff = createDropoff(0, 0);
      const salvage = buildSalvage(200, 0); // Far from dropoff (radius is 60)
      system.collect(salvage);

      const deposited = system.checkDropoffs([dropoff]);

      expect(deposited).toHaveLength(0);
      expect(system.getTowedItems()).toHaveLength(1);
    });

    it('ignores fading salvage', () => {
      const dropoff = createDropoff(100, 0);
      const salvage = buildSalvage(100, 0);
      system.collect(salvage);
      system.getTowedItems()[0].fadeOut = 0.2; // Already fading

      const deposited = system.checkDropoffs([dropoff]);

      expect(deposited).toHaveLength(0);
    });

    it('deposits multiple salvage items in a single dropoff', () => {
      const dropoff = createDropoff(100, 0);
      const s1 = buildSalvage(95, 0);
      const s2 = buildSalvage(105, 0);
      system.collect(s1);
      system.collect(s2);

      const deposited = system.checkDropoffs([dropoff]);

      expect(deposited).toHaveLength(2);
      expect(system.getTowedItems()).toHaveLength(0);
    });
  });

  describe('checkHomeDeposit', () => {
    it('deposits salvage when it enters the home base radius', () => {
      const homeBase = createHomeBase(0, 0);
      const salvage = buildSalvage(10, 0); // Within 150px radius
      system.collect(salvage);

      const deposited = system.checkHomeDeposit(homeBase);

      expect(deposited).toHaveLength(1);
      expect(deposited[0]).toBe(salvage);
      expect(system.getTowedItems()).toHaveLength(0);
      expect(salvage.towedByPlayer).toBe(false);
      expect(salvage.active).toBe(false);
    });

    it('does not deposit salvage outside the home base radius', () => {
      const homeBase = createHomeBase(0, 0);
      const salvage = buildSalvage(200, 0); // Beyond 150px radius
      system.collect(salvage);

      const deposited = system.checkHomeDeposit(homeBase);

      expect(deposited).toHaveLength(0);
      expect(system.getTowedItems()).toHaveLength(1);
    });

    it('ignores fading salvage', () => {
      const homeBase = createHomeBase(0, 0);
      const salvage = buildSalvage(10, 0);
      system.collect(salvage);
      system.getTowedItems()[0].fadeOut = 0.2;

      const deposited = system.checkHomeDeposit(homeBase);

      expect(deposited).toHaveLength(0);
    });

    it('deposits multiple salvage items at once', () => {
      const homeBase = createHomeBase(0, 0);
      const s1 = buildSalvage(10, 0);
      const s2 = buildSalvage(0, 10);
      system.collect(s1);
      system.collect(s2);

      const deposited = system.checkHomeDeposit(homeBase);

      expect(deposited).toHaveLength(2);
      expect(system.getTowedItems()).toHaveLength(0);
    });

    it('has a static HOME_DEPOSIT_REWARD of 50', () => {
      expect(TowRopeSystem.HOME_DEPOSIT_REWARD).toBe(50);
    });
  });

  describe('update - destroyed salvage cleanup', () => {
    it('removes towed salvage that has been deactivated', () => {
      const salvage = buildSalvage(50, 0);
      system.collect(salvage);
      salvage.active = false;

      system.update(player, 1 / 60);

      expect(system.getTowedItems()).toHaveLength(0);
      expect(salvage.towedByPlayer).toBe(false);
    });

    it('removes towed salvage with hp <= 0', () => {
      const salvage = buildSalvage(50, 0);
      system.collect(salvage);
      salvage.hp = 0;

      system.update(player, 1 / 60);

      expect(system.getTowedItems()).toHaveLength(0);
      expect(salvage.towedByPlayer).toBe(false);
    });

    it('remaining towed items continue working after sibling is destroyed', () => {
      const s1 = buildSalvage(50, 0);
      const s2 = buildSalvage(60, 0);
      system.collect(s1);
      system.collect(s2);

      s1.active = false; // Destroyed by enemy

      system.update(player, 1 / 60);

      expect(system.getTowedItems()).toHaveLength(1);
      expect(system.getTowedItems()[0].salvage).toBe(s2);
    });
  });

  describe('clear', () => {
    it('removes all towed items', () => {
      system.collect(buildSalvage(50, 50));
      system.collect(buildSalvage(100, 100));

      system.clear();

      expect(system.getTowedItems()).toHaveLength(0);
    });

    it('unmarks salvage as towed', () => {
      const salvage = buildSalvage();
      system.collect(salvage);

      system.clear();

      expect(salvage.towedByPlayer).toBe(false);
    });
  });

  describe('getTowedItems', () => {
    it('returns empty array when nothing is towed', () => {
      expect(system.getTowedItems()).toEqual([]);
    });

    it('returns items in collection order', () => {
      const s1 = buildSalvage(50, 0);
      const s2 = buildSalvage(100, 0);
      system.collect(s1);
      system.collect(s2);

      const items = system.getTowedItems();
      expect(items[0].salvage).toBe(s1);
      expect(items[1].salvage).toBe(s2);
    });
  });
});
