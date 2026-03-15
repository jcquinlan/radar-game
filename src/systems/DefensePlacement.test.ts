import { describe, it, expect } from 'vitest';
import { createTurret, createRepairStation } from '../entities/Entity';
import {
  isValidDefensePosition,
  tryPlaceDefense,
  TURRET_COST,
  REPAIR_STATION_COST,
} from './DefensePlacement';

describe('DefensePlacement', () => {
  describe('isValidDefensePosition', () => {
    it('accepts a position within base radius with no existing defenses', () => {
      expect(isValidDefensePosition(10, 10, 150, [])).toBe(true);
    });

    it('rejects a position outside base radius', () => {
      expect(isValidDefensePosition(200, 0, 150, [])).toBe(false);
    });

    it('rejects a position too close to an existing defense', () => {
      const existing = [createTurret(50, 50)];
      // 10px away — less than 30px minimum
      expect(isValidDefensePosition(55, 55, 150, existing)).toBe(false);
    });

    it('accepts a position far enough from existing defenses', () => {
      const existing = [createTurret(50, 50)];
      // ~42px away (diagonal) — more than 30px minimum
      expect(isValidDefensePosition(80, 80, 150, existing)).toBe(true);
    });

    it('checks distance against all existing defenses', () => {
      const existing = [createTurret(50, 0), createRepairStation(-50, 0)];
      // Close to the second defense
      expect(isValidDefensePosition(-45, 5, 150, existing)).toBe(false);
    });
  });

  describe('tryPlaceDefense', () => {
    it('fails when player is outside base radius', () => {
      const result = tryPlaceDefense('turret', 200, [], 3, 150, 300, 0);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('Too far from base');
      }
    });

    it('fails when max defenses reached', () => {
      const defenses = [createTurret(0, 0), createTurret(50, 0), createRepairStation(-50, 0)];
      const result = tryPlaceDefense('turret', 200, defenses, 3, 150, 10, 10);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('Max defenses reached');
      }
    });

    it('fails when player lacks energy for turret', () => {
      const result = tryPlaceDefense('turret', 50, [], 3, 150, 10, 10);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('Not enough energy');
      }
    });

    it('fails when player lacks energy for repair station', () => {
      const result = tryPlaceDefense('repair_station', 50, [], 3, 150, 10, 10);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('Not enough energy');
      }
    });

    it('places a turret successfully with enough energy and space', () => {
      const result = tryPlaceDefense('turret', 200, [], 3, 150, 10, 10);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.defense.type).toBe('turret');
        expect(result.cost).toBe(TURRET_COST);
        // Position should be within base radius
        const { x, y } = result.defense;
        expect(x * x + y * y).toBeLessThanOrEqual(150 * 150);
      }
    });

    it('places a repair station successfully', () => {
      const result = tryPlaceDefense('repair_station', 200, [], 3, 150, 10, 10);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.defense.type).toBe('repair_station');
        expect(result.cost).toBe(REPAIR_STATION_COST);
      }
    });

    it('turret costs 100 energy', () => {
      expect(TURRET_COST).toBe(100);
    });

    it('repair station costs 75 energy', () => {
      expect(REPAIR_STATION_COST).toBe(75);
    });

    it('placed defense is not overlapping existing defenses', () => {
      const existing = [createTurret(0, 0)];
      const result = tryPlaceDefense('turret', 200, existing, 3, 150, 10, 10);
      if (result.success) {
        const dx = result.defense.x - existing[0].x;
        const dy = result.defense.y - existing[0].y;
        expect(dx * dx + dy * dy).toBeGreaterThanOrEqual(30 * 30);
      }
    });
  });
});
