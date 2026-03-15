import { SaveData, saveSaveData } from './SaveData';

export interface BaseUpgrade {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  cost: (level: number) => number;
}

/** The 4 persistent base upgrades. Cost formula takes the CURRENT level (0-based). */
export const BASE_UPGRADES: BaseUpgrade[] = [
  {
    id: 'base_hp',
    name: 'Reinforced Hull',
    description: '+100 max base HP per level',
    maxLevel: 5,
    cost: (level) => 100 + level * 75,
  },
  {
    id: 'salvage_capacity',
    name: 'Cargo Hold',
    description: '+2 max towed salvage per level',
    maxLevel: 3,
    cost: (level) => 150 + level * 100,
  },
  {
    id: 'starting_energy',
    name: 'Energy Reserves',
    description: '+25 starting energy per level',
    maxLevel: 5,
    cost: (level) => 75 + level * 50,
  },
  {
    id: 'max_health',
    name: 'Vital Systems',
    description: '+20 max player HP per level',
    maxLevel: 5,
    cost: (level) => 80 + level * 60,
  },
];

/** Get the current level of a base upgrade from save data. */
export function getBaseUpgradeLevel(saveData: SaveData, upgradeId: string): number {
  return saveData.baseUpgrades[upgradeId] ?? 0;
}

/** Get the cost to purchase the next level of a base upgrade. Returns null if maxed. */
export function getBaseUpgradeCost(saveData: SaveData, upgradeId: string): number | null {
  const upgrade = BASE_UPGRADES.find(u => u.id === upgradeId);
  if (!upgrade) return null;
  const currentLevel = getBaseUpgradeLevel(saveData, upgradeId);
  if (currentLevel >= upgrade.maxLevel) return null;
  return upgrade.cost(currentLevel);
}

/** Attempt to purchase a base upgrade. Returns true if successful. Mutates and saves the SaveData. */
export function purchaseBaseUpgrade(saveData: SaveData, upgradeId: string): boolean {
  const cost = getBaseUpgradeCost(saveData, upgradeId);
  if (cost === null) return false;
  if (saveData.currency < cost) return false;

  saveData.currency -= cost;
  saveData.baseUpgrades[upgradeId] = (saveData.baseUpgrades[upgradeId] ?? 0) + 1;
  saveSaveData(saveData);
  return true;
}
