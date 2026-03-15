const SAVE_KEY = 'radar-game-save';

export interface SaveData {
  currency: number;
  runCount: number;
  baseUpgrades: Record<string, number>;
}

export function defaultSaveData(): SaveData {
  return {
    currency: 0,
    runCount: 0,
    baseUpgrades: {},
  };
}

export function loadSaveData(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSaveData();
    const parsed = JSON.parse(raw);
    // Merge with defaults to handle missing fields from older saves
    const defaults = defaultSaveData();
    return {
      currency: typeof parsed.currency === 'number' ? parsed.currency : defaults.currency,
      runCount: typeof parsed.runCount === 'number' ? parsed.runCount : defaults.runCount,
      baseUpgrades: parsed.baseUpgrades && typeof parsed.baseUpgrades === 'object'
        ? parsed.baseUpgrades
        : defaults.baseUpgrades,
    };
  } catch {
    return defaultSaveData();
  }
}

export function saveSaveData(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable — silently skip
  }
}
