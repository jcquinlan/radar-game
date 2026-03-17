import { describe, it, expect, beforeEach } from 'vitest';
import { calculateCurrency, calculateReducedCurrency, loadSaveData, saveSaveData, migrateUpgrades, SaveData } from './SaveSystem';

describe('calculateCurrency', () => {
  it('returns correct currency per formula: (salvage*50) + (kills*10) + floor(baseHpPercent*50)', () => {
    // 3 salvage * 50 = 150, 5 kills * 10 = 50, 80% base HP = floor(0.8*50) = 40
    expect(calculateCurrency(3, 5, 0.8)).toBe(240);
  });

  it('returns 0 when all inputs are 0', () => {
    expect(calculateCurrency(0, 0, 0)).toBe(0);
  });

  it('handles 100% base HP', () => {
    expect(calculateCurrency(0, 0, 1.0)).toBe(50);
  });

  it('floors the base HP contribution', () => {
    // 33% base HP: floor(0.33 * 50) = floor(16.5) = 16
    expect(calculateCurrency(0, 0, 0.33)).toBe(16);
  });

  it('handles large values', () => {
    // 10 salvage * 50 = 500, 20 kills * 10 = 200, 100% = 50
    expect(calculateCurrency(10, 20, 1.0)).toBe(750);
  });
});

describe('calculateReducedCurrency', () => {
  it('returns 25% of normal currency (floored)', () => {
    // Normal would be 240, reduced = floor(240 * 0.25) = 60
    expect(calculateReducedCurrency(3, 5, 0.8)).toBe(60);
  });

  it('returns 0 when all inputs are 0', () => {
    expect(calculateReducedCurrency(0, 0, 0)).toBe(0);
  });

  it('floors the result', () => {
    // Normal = 50 (just base HP at 100%), reduced = floor(50 * 0.25) = floor(12.5) = 12
    expect(calculateReducedCurrency(0, 0, 1.0)).toBe(12);
  });
});

describe('loadSaveData', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default save data when nothing is stored', () => {
    const data = loadSaveData();
    expect(data.currency).toBe(0);
    expect(data.runCount).toBe(0);
    expect(data.baseUpgrades).toEqual({});
  });

  it('loads saved data from localStorage', () => {
    const saved: SaveData = { currency: 500, runCount: 3, baseUpgrades: { armor: 2 } };
    localStorage.setItem('radar-game-save', JSON.stringify(saved));
    const data = loadSaveData();
    expect(data.currency).toBe(500);
    expect(data.runCount).toBe(3);
    expect(data.baseUpgrades).toEqual({ armor: 2 });
  });

  it('returns default when localStorage has invalid JSON', () => {
    localStorage.setItem('radar-game-save', 'not-json');
    const data = loadSaveData();
    expect(data.currency).toBe(0);
    expect(data.runCount).toBe(0);
  });

  it('migrates legacy max_mining_bots and max_combat_bots to max_bot_slots', () => {
    const saved = {
      currency: 500,
      runCount: 3,
      baseUpgrades: { max_mining_bots: 2, max_combat_bots: 1, hull_armor: 3 },
    };
    localStorage.setItem('radar-game-save', JSON.stringify(saved));
    const data = loadSaveData();
    expect(data.baseUpgrades['max_bot_slots']).toBe(3);
    expect(data.baseUpgrades['max_mining_bots']).toBeUndefined();
    expect(data.baseUpgrades['max_combat_bots']).toBeUndefined();
    expect(data.baseUpgrades['hull_armor']).toBe(3);
  });
});

describe('saveSaveData', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves data to localStorage', () => {
    const data: SaveData = { currency: 100, runCount: 1, baseUpgrades: {} };
    saveSaveData(data);
    const raw = localStorage.getItem('radar-game-save');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual(data);
  });

  it('overwrites previous save', () => {
    saveSaveData({ currency: 50, runCount: 1, baseUpgrades: {} });
    saveSaveData({ currency: 200, runCount: 2, baseUpgrades: { speed: 1 } });
    const raw = localStorage.getItem('radar-game-save');
    const parsed = JSON.parse(raw!);
    expect(parsed.currency).toBe(200);
    expect(parsed.runCount).toBe(2);
  });
});

describe('migrateUpgrades', () => {
  it('converts max_mining_bots + max_combat_bots to max_bot_slots', () => {
    const result = migrateUpgrades({ max_mining_bots: 2, max_combat_bots: 3 });
    expect(result['max_bot_slots']).toBe(5);
    expect(result['max_mining_bots']).toBeUndefined();
    expect(result['max_combat_bots']).toBeUndefined();
  });

  it('caps max_bot_slots at 5', () => {
    const result = migrateUpgrades({ max_mining_bots: 4, max_combat_bots: 4 });
    expect(result['max_bot_slots']).toBe(5);
  });

  it('handles only max_mining_bots being present', () => {
    const result = migrateUpgrades({ max_mining_bots: 3 });
    expect(result['max_bot_slots']).toBe(3);
    expect(result['max_mining_bots']).toBeUndefined();
  });

  it('handles only max_combat_bots being present', () => {
    const result = migrateUpgrades({ max_combat_bots: 2 });
    expect(result['max_bot_slots']).toBe(2);
    expect(result['max_combat_bots']).toBeUndefined();
  });

  it('does not overwrite existing max_bot_slots', () => {
    const result = migrateUpgrades({ max_mining_bots: 3, max_bot_slots: 1 });
    expect(result['max_bot_slots']).toBe(1);
    expect(result['max_mining_bots']).toBeUndefined();
  });

  it('preserves other upgrade keys', () => {
    const result = migrateUpgrades({ hull_armor: 3, mining_speed: 2 });
    expect(result['hull_armor']).toBe(3);
    expect(result['mining_speed']).toBe(2);
  });

  it('returns empty object for empty input', () => {
    const result = migrateUpgrades({});
    expect(result).toEqual({});
  });
});
