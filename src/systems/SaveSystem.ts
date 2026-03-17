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

/**
 * Migrate legacy upgrade IDs to current ones.
 * - max_mining_bots + max_combat_bots -> max_bot_slots (sum, capped at 5)
 */
export function migrateUpgrades(upgrades: Record<string, number>): Record<string, number> {
  const result = { ...upgrades };

  const oldMining = result['max_mining_bots'];
  const oldCombat = result['max_combat_bots'];

  if (oldMining != null || oldCombat != null) {
    // Only migrate if max_bot_slots is not already set
    if (result['max_bot_slots'] == null) {
      const sum = (oldMining ?? 0) + (oldCombat ?? 0);
      result['max_bot_slots'] = Math.min(sum, 5);
    }
    delete result['max_mining_bots'];
    delete result['max_combat_bots'];
  }

  return result;
}

export function loadSaveData(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...DEFAULT_SAVE, baseUpgrades: {} };
    const parsed = JSON.parse(raw);
    const baseUpgrades = migrateUpgrades(parsed.baseUpgrades ?? {});
    return {
      currency: parsed.currency ?? 0,
      runCount: parsed.runCount ?? 0,
      baseUpgrades,
    };
  } catch {
    return { ...DEFAULT_SAVE, baseUpgrades: {} };
  }
}

export function saveSaveData(data: SaveData): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}
