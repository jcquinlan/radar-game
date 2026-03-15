import { describe, it, expect, beforeEach } from 'vitest';
import { defaultSaveData, loadSaveData, saveSaveData, SaveData } from './SaveData';

describe('SaveData', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('defaultSaveData', () => {
    it('returns zero currency, zero runs, empty upgrades', () => {
      const data = defaultSaveData();
      expect(data.currency).toBe(0);
      expect(data.runCount).toBe(0);
      expect(data.baseUpgrades).toEqual({});
    });
  });

  describe('loadSaveData', () => {
    it('returns defaults when no save exists', () => {
      const data = loadSaveData();
      expect(data).toEqual(defaultSaveData());
    });

    it('loads saved data from localStorage', () => {
      const saved: SaveData = { currency: 250, runCount: 3, baseUpgrades: { base_hp: 2 } };
      localStorage.setItem('radar-game-save', JSON.stringify(saved));
      const data = loadSaveData();
      expect(data.currency).toBe(250);
      expect(data.runCount).toBe(3);
      expect(data.baseUpgrades.base_hp).toBe(2);
    });

    it('returns defaults for corrupt JSON', () => {
      localStorage.setItem('radar-game-save', 'not json');
      const data = loadSaveData();
      expect(data).toEqual(defaultSaveData());
    });

    it('fills missing fields with defaults', () => {
      localStorage.setItem('radar-game-save', JSON.stringify({ currency: 100 }));
      const data = loadSaveData();
      expect(data.currency).toBe(100);
      expect(data.runCount).toBe(0);
      expect(data.baseUpgrades).toEqual({});
    });
  });

  describe('saveSaveData', () => {
    it('persists data to localStorage', () => {
      const data: SaveData = { currency: 500, runCount: 5, baseUpgrades: { base_hp: 1 } };
      saveSaveData(data);
      const raw = localStorage.getItem('radar-game-save');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.currency).toBe(500);
      expect(parsed.runCount).toBe(5);
      expect(parsed.baseUpgrades.base_hp).toBe(1);
    });
  });
});
