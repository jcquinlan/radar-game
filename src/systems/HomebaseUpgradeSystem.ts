import { Player } from '../entities/Player';
import { MiningBotSystem } from './MiningBotSystem';
import { CombatBotSystem } from './CombatBotSystem';
import { BotSlotSystem } from './BotSlotSystem';
import { PingSystem, DEFAULT_PING_CONFIG } from './PingSystem';
import { RadarDisplay } from '../radar/RadarDisplay';
import { SaveData } from './SaveSystem';

export type BuildingCategory = 'player' | 'mining' | 'combat';

export interface HomebaseUpgrade {
  id: string;
  building: BuildingCategory;
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  /** Cost in persistent currency for the next level */
  cost: (currentLevel: number) => number;
}

// --- Upgrade definitions ---

function createPlayerUpgrades(): HomebaseUpgrade[] {
  return [
    {
      id: 'hull_armor',
      building: 'player',
      name: 'Hull Armor',
      description: '+2 flat damage reduction per level',
      level: 0,
      maxLevel: 5,
      cost: (lvl) => 30 + lvl * 25,
    },
    {
      id: 'engine_speed',
      building: 'player',
      name: 'Engine Speed',
      description: '+15 movement speed per level',
      level: 0,
      maxLevel: 5,
      cost: (lvl) => 25 + lvl * 20,
    },
    {
      id: 'ping_range',
      building: 'player',
      name: 'Ping Range',
      description: '+40px radar detection radius per level',
      level: 0,
      maxLevel: 5,
      cost: (lvl) => 30 + lvl * 25,
    },
    {
      id: 'ping_frequency',
      building: 'player',
      name: 'Ping Frequency',
      description: '-12% ping cooldown per level',
      level: 0,
      maxLevel: 5,
      cost: (lvl) => 35 + lvl * 30,
    },
  ];
}

function createMiningUpgrades(): HomebaseUpgrade[] {
  return [
    {
      id: 'max_bot_slots',
      building: 'mining',
      name: 'Bot Fleet',
      description: '+1 max bot slot per level',
      level: 0,
      maxLevel: 5,
      cost: (lvl) => 40 + lvl * 35,
    },
    {
      id: 'mining_speed',
      building: 'mining',
      name: 'Mining Speed',
      description: '+20% mining rate per level',
      level: 0,
      maxLevel: 5,
      cost: (lvl) => 30 + lvl * 25,
    },
    {
      id: 'mining_range',
      building: 'mining',
      name: 'Mining Range',
      description: '+30px deploy radius per level',
      level: 0,
      maxLevel: 5,
      cost: (lvl) => 25 + lvl * 20,
    },
  ];
}

function createCombatUpgrades(): HomebaseUpgrade[] {
  return [
    {
      id: 'bot_cooldown',
      building: 'combat',
      name: 'Quick Recharge',
      description: '-1s bot slot cooldown per level',
      level: 0,
      maxLevel: 5,
      cost: (lvl) => 40 + lvl * 35,
    },
    {
      id: 'combat_damage',
      building: 'combat',
      name: 'Bot Weapons',
      description: '+2 combat bot damage per level',
      level: 0,
      maxLevel: 5,
      cost: (lvl) => 35 + lvl * 30,
    },
    {
      id: 'combat_lifetime',
      building: 'combat',
      name: 'Bot Durability',
      description: '+5s combat bot lifetime per level',
      level: 0,
      maxLevel: 5,
      cost: (lvl) => 30 + lvl * 25,
    },
  ];
}

export class HomebaseUpgradeSystem {
  upgrades: HomebaseUpgrade[];

  constructor() {
    this.upgrades = [
      ...createPlayerUpgrades(),
      ...createMiningUpgrades(),
      ...createCombatUpgrades(),
    ];
  }

  getUpgrade(id: string): HomebaseUpgrade | undefined {
    return this.upgrades.find((u) => u.id === id);
  }

  getUpgradesForBuilding(building: BuildingCategory): HomebaseUpgrade[] {
    return this.upgrades.filter((u) => u.building === building);
  }

  /**
   * Check if an upgrade can be purchased with the given currency amount.
   */
  canPurchase(id: string, currency: number): boolean {
    const upgrade = this.getUpgrade(id);
    if (!upgrade) return false;
    if (upgrade.level >= upgrade.maxLevel) return false;
    return currency >= upgrade.cost(upgrade.level);
  }

  /**
   * Purchase an upgrade, deducting currency from saveData.
   * Returns true if successful, false if insufficient currency or max level.
   */
  purchase(id: string, saveData: SaveData): boolean {
    const upgrade = this.getUpgrade(id);
    if (!upgrade) return false;
    if (upgrade.level >= upgrade.maxLevel) return false;

    const cost = upgrade.cost(upgrade.level);
    if (saveData.currency < cost) return false;

    saveData.currency -= cost;
    upgrade.level++;
    saveData.baseUpgrades[id] = upgrade.level;
    return true;
  }

  /**
   * Get the cost of the next level for an upgrade.
   * Returns null if at max level or upgrade doesn't exist.
   */
  getNextCost(id: string): number | null {
    const upgrade = this.getUpgrade(id);
    if (!upgrade || upgrade.level >= upgrade.maxLevel) return null;
    return upgrade.cost(upgrade.level);
  }

  /**
   * Load upgrade levels from persisted save data.
   */
  loadFromSave(saveData: SaveData): void {
    for (const upgrade of this.upgrades) {
      const savedLevel = saveData.baseUpgrades[upgrade.id];
      if (savedLevel != null && savedLevel >= 0 && savedLevel <= upgrade.maxLevel) {
        upgrade.level = savedLevel;
      }
    }
  }

  /**
   * Write current upgrade levels to save data.
   */
  saveToSave(saveData: SaveData): void {
    for (const upgrade of this.upgrades) {
      if (upgrade.level > 0) {
        saveData.baseUpgrades[upgrade.id] = upgrade.level;
      }
    }
  }

  /**
   * Apply all current upgrade levels to game systems at the start of a run.
   */
  applyUpgrades(
    player: Player,
    radar: RadarDisplay,
    pingSystem: PingSystem,
    miningBotSystem: MiningBotSystem,
    combatBotSystem: CombatBotSystem,
    botSlotSystem: BotSlotSystem,
  ): void {
    for (const upgrade of this.upgrades) {
      if (upgrade.level === 0) continue;

      switch (upgrade.id) {
        // Player building
        case 'hull_armor':
          player.armor = upgrade.level * 2;
          break;
        case 'engine_speed':
          player.speed = player.baseSpeed + upgrade.level * 15;
          break;
        case 'ping_range': {
          const newRadius = 340 + upgrade.level * 40;
          radar.setRadius(newRadius);
          pingSystem.setMaxRadius(newRadius);
          break;
        }
        case 'ping_frequency':
          pingSystem.setCooldown(DEFAULT_PING_CONFIG.cooldown * (1 - upgrade.level * 0.12));
          break;

        // Mining building
        case 'max_bot_slots':
          botSlotSystem.setTotalSlots(5 + upgrade.level);
          break;
        case 'mining_speed':
          miningBotSystem.miningRateMultiplier = 1 + upgrade.level * 0.2;
          break;
        case 'mining_range':
          miningBotSystem.deployRange = 100 + upgrade.level * 30;
          break;

        // Combat building
        case 'bot_cooldown':
          botSlotSystem.setCooldownDuration(8 - upgrade.level);
          break;
        case 'combat_damage':
          combatBotSystem.baseDamage = 4 + upgrade.level * 2;
          break;
        case 'combat_lifetime':
          combatBotSystem.baseLifetime = 20 + upgrade.level * 5;
          break;
      }
    }
  }
}
