const SAVE_KEY = 'radar-game-save';

export interface SaveData {
  currency: number;
  runCount: number;
  baseUpgrades: Record<string, number>;
}

const DEFAULT_SAVE: SaveData = {
  currency: 0,
  runCount: 0,
  baseUpgrades: {},
};

/**
 * Currency formula: (salvageDeposited * 50) + (enemiesKilled * 10) + floor(baseHpPercent * 50)
 */
export function calculateCurrency(salvageDeposited: number, enemiesKilled: number, baseHpPercent: number): number {
  return (salvageDeposited * 50) + (enemiesKilled * 10) + Math.floor(baseHpPercent * 50);
}

/**
 * Reduced currency for game_over (lose) path: 25% of normal, floored.
 */
export function calculateReducedCurrency(salvageDeposited: number, enemiesKilled: number, baseHpPercent: number): number {
  return Math.floor(calculateCurrency(salvageDeposited, enemiesKilled, baseHpPercent) * 0.25);
}

export function loadSaveData(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...DEFAULT_SAVE, baseUpgrades: {} };
    const parsed = JSON.parse(raw);
    return {
      currency: parsed.currency ?? 0,
      runCount: parsed.runCount ?? 0,
      baseUpgrades: parsed.baseUpgrades ?? {},
    };
  } catch {
    return { ...DEFAULT_SAVE, baseUpgrades: {} };
  }
}

export function saveSaveData(data: SaveData): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}
