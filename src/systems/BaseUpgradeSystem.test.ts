import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BASE_UPGRADES,
  getBaseUpgradeLevel,
  getBaseUpgradeCost,
  purchaseBaseUpgrade,
} from './BaseUpgradeSystem';
import { SaveData, defaultSaveData } from './SaveData';

// Mock saveSaveData to avoid localStorage in tests
vi.mock('./SaveData', async () => {
  const actual = await vi.importActual<typeof import('./SaveData')>('./SaveData');
  return {
    ...actual,
    saveSaveData: vi.fn(),
  };
});

describe('BaseUpgradeSystem', () => {
  let saveData: SaveData;

  beforeEach(() => {
    saveData = defaultSaveData();
  });

  describe('cost formulas', () => {
    it('base_hp costs 100 + level*75', () => {
      const upgrade = BASE_UPGRADES.find(u => u.id === 'base_hp')!;
      expect(upgrade.cost(0)).toBe(100);
      expect(upgrade.cost(1)).toBe(175);
      expect(upgrade.cost(4)).toBe(400);
    });

    it('salvage_capacity costs 150 + level*100', () => {
      const upgrade = BASE_UPGRADES.find(u => u.id === 'salvage_capacity')!;
      expect(upgrade.cost(0)).toBe(150);
      expect(upgrade.cost(1)).toBe(250);
      expect(upgrade.cost(2)).toBe(350);
    });

    it('starting_energy costs 75 + level*50', () => {
      const upgrade = BASE_UPGRADES.find(u => u.id === 'starting_energy')!;
      expect(upgrade.cost(0)).toBe(75);
      expect(upgrade.cost(3)).toBe(225);
    });

    it('max_health costs 80 + level*60', () => {
      const upgrade = BASE_UPGRADES.find(u => u.id === 'max_health')!;
      expect(upgrade.cost(0)).toBe(80);
      expect(upgrade.cost(2)).toBe(200);
    });
  });

  describe('getBaseUpgradeLevel', () => {
    it('returns 0 for upgrades not in save data', () => {
      expect(getBaseUpgradeLevel(saveData, 'base_hp')).toBe(0);
    });

    it('returns the stored level', () => {
      saveData.baseUpgrades['base_hp'] = 3;
      expect(getBaseUpgradeLevel(saveData, 'base_hp')).toBe(3);
    });
  });

  describe('getBaseUpgradeCost', () => {
    it('returns cost for the next level', () => {
      expect(getBaseUpgradeCost(saveData, 'base_hp')).toBe(100);
    });

    it('returns cost based on current level', () => {
      saveData.baseUpgrades['base_hp'] = 2;
      expect(getBaseUpgradeCost(saveData, 'base_hp')).toBe(100 + 2 * 75);
    });

    it('returns null when maxed', () => {
      saveData.baseUpgrades['base_hp'] = 5;
      expect(getBaseUpgradeCost(saveData, 'base_hp')).toBeNull();
    });

    it('returns null for unknown upgrade id', () => {
      expect(getBaseUpgradeCost(saveData, 'nonexistent')).toBeNull();
    });
  });

  describe('purchaseBaseUpgrade', () => {
    it('deducts currency and increments level on purchase', () => {
      saveData.currency = 500;
      const result = purchaseBaseUpgrade(saveData, 'base_hp');
      expect(result).toBe(true);
      expect(saveData.currency).toBe(400); // 500 - 100
      expect(saveData.baseUpgrades['base_hp']).toBe(1);
    });

    it('returns false when currency is insufficient', () => {
      saveData.currency = 50;
      const result = purchaseBaseUpgrade(saveData, 'base_hp');
      expect(result).toBe(false);
      expect(saveData.currency).toBe(50);
      expect(getBaseUpgradeLevel(saveData, 'base_hp')).toBe(0);
    });

    it('returns false when upgrade is maxed', () => {
      saveData.currency = 10000;
      saveData.baseUpgrades['salvage_capacity'] = 3; // max level
      const result = purchaseBaseUpgrade(saveData, 'salvage_capacity');
      expect(result).toBe(false);
      expect(saveData.currency).toBe(10000);
    });

    it('correctly increments through multiple purchases', () => {
      saveData.currency = 1000;
      purchaseBaseUpgrade(saveData, 'starting_energy'); // costs 75
      expect(saveData.baseUpgrades['starting_energy']).toBe(1);
      expect(saveData.currency).toBe(925);

      purchaseBaseUpgrade(saveData, 'starting_energy'); // costs 75 + 1*50 = 125
      expect(saveData.baseUpgrades['starting_energy']).toBe(2);
      expect(saveData.currency).toBe(800);
    });

    it('returns false for unknown upgrade id', () => {
      saveData.currency = 1000;
      const result = purchaseBaseUpgrade(saveData, 'nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('max levels', () => {
    it('base_hp max level is 5', () => {
      expect(BASE_UPGRADES.find(u => u.id === 'base_hp')!.maxLevel).toBe(5);
    });

    it('salvage_capacity max level is 3', () => {
      expect(BASE_UPGRADES.find(u => u.id === 'salvage_capacity')!.maxLevel).toBe(3);
    });

    it('starting_energy max level is 5', () => {
      expect(BASE_UPGRADES.find(u => u.id === 'starting_energy')!.maxLevel).toBe(5);
    });

    it('max_health max level is 5', () => {
      expect(BASE_UPGRADES.find(u => u.id === 'max_health')!.maxLevel).toBe(5);
    });
  });
});
