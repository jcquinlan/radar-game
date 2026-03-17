import { describe, it, expect, beforeEach } from 'vitest';
import { HomebaseUpgradeSystem, BuildingCategory } from './HomebaseUpgradeSystem';
import { Player } from '../entities/Player';
import { MiningBotSystem } from './MiningBotSystem';
import { CombatBotSystem } from './CombatBotSystem';
import { PingSystem, DEFAULT_PING_CONFIG } from './PingSystem';
import { RadarDisplay } from '../radar/RadarDisplay';
import { SaveData } from './SaveSystem';

function createSaveData(currency = 1000): SaveData {
  return { currency, runCount: 0, baseUpgrades: {} };
}

describe('HomebaseUpgradeSystem', () => {
  let system: HomebaseUpgradeSystem;
  let saveData: SaveData;

  beforeEach(() => {
    system = new HomebaseUpgradeSystem();
    saveData = createSaveData();
  });

  it('initializes with 10 upgrades across 3 buildings', () => {
    expect(system.upgrades).toHaveLength(10);
    expect(system.getUpgradesForBuilding('player')).toHaveLength(4);
    expect(system.getUpgradesForBuilding('mining')).toHaveLength(3);
    expect(system.getUpgradesForBuilding('combat')).toHaveLength(3);
  });

  it('all upgrades start at level 0', () => {
    for (const u of system.upgrades) {
      expect(u.level).toBe(0);
    }
  });

  it('purchase deducts currency and increments level', () => {
    const cost = system.getNextCost('hull_armor')!;
    const result = system.purchase('hull_armor', saveData);
    expect(result).toBe(true);
    expect(system.getUpgrade('hull_armor')!.level).toBe(1);
    expect(saveData.currency).toBe(1000 - cost);
  });

  it('purchase fails when currency is insufficient', () => {
    saveData.currency = 1;
    const result = system.purchase('hull_armor', saveData);
    expect(result).toBe(false);
    expect(system.getUpgrade('hull_armor')!.level).toBe(0);
    expect(saveData.currency).toBe(1);
  });

  it('purchase fails when upgrade is at max level', () => {
    saveData.currency = 100000;
    const upgrade = system.getUpgrade('hull_armor')!;
    for (let i = 0; i < upgrade.maxLevel; i++) {
      system.purchase('hull_armor', saveData);
    }
    expect(upgrade.level).toBe(upgrade.maxLevel);
    const result = system.purchase('hull_armor', saveData);
    expect(result).toBe(false);
  });

  it('purchase fails for nonexistent upgrade', () => {
    const result = system.purchase('nonexistent', saveData);
    expect(result).toBe(false);
  });

  it('purchase persists level to saveData.baseUpgrades', () => {
    system.purchase('hull_armor', saveData);
    expect(saveData.baseUpgrades['hull_armor']).toBe(1);
    system.purchase('hull_armor', saveData);
    expect(saveData.baseUpgrades['hull_armor']).toBe(2);
  });

  it('getNextCost returns null at max level', () => {
    saveData.currency = 100000;
    const upgrade = system.getUpgrade('hull_armor')!;
    for (let i = 0; i < upgrade.maxLevel; i++) {
      system.purchase('hull_armor', saveData);
    }
    expect(system.getNextCost('hull_armor')).toBeNull();
  });

  it('getNextCost returns null for nonexistent upgrade', () => {
    expect(system.getNextCost('nonexistent')).toBeNull();
  });

  it('canPurchase returns correct values', () => {
    expect(system.canPurchase('hull_armor', 0)).toBe(false);
    expect(system.canPurchase('hull_armor', 10000)).toBe(true);
    expect(system.canPurchase('nonexistent', 10000)).toBe(false);
  });

  it('loadFromSave restores upgrade levels', () => {
    saveData.baseUpgrades = { hull_armor: 3, max_mining_bots: 2 };
    system.loadFromSave(saveData);
    expect(system.getUpgrade('hull_armor')!.level).toBe(3);
    expect(system.getUpgrade('max_mining_bots')!.level).toBe(2);
    expect(system.getUpgrade('engine_speed')!.level).toBe(0);
  });

  it('loadFromSave ignores invalid levels', () => {
    saveData.baseUpgrades = { hull_armor: 99 };
    system.loadFromSave(saveData);
    expect(system.getUpgrade('hull_armor')!.level).toBe(0);
  });

  it('saveToSave writes current levels to save data', () => {
    saveData.currency = 100000;
    system.purchase('hull_armor', saveData);
    system.purchase('hull_armor', saveData);
    const freshSave = createSaveData();
    system.saveToSave(freshSave);
    expect(freshSave.baseUpgrades['hull_armor']).toBe(2);
  });

  describe('applyUpgrades', () => {
    let player: Player;
    let radar: RadarDisplay;
    let pingSystem: PingSystem;
    let miningBotSystem: MiningBotSystem;
    let combatBotSystem: CombatBotSystem;

    beforeEach(() => {
      player = new Player();
      radar = new RadarDisplay();
      pingSystem = new PingSystem();
      miningBotSystem = new MiningBotSystem();
      combatBotSystem = new CombatBotSystem();
    });

    it('hull_armor upgrade sets player armor', () => {
      saveData.currency = 100000;
      system.purchase('hull_armor', saveData);
      system.purchase('hull_armor', saveData);
      system.applyUpgrades(player, radar, pingSystem, miningBotSystem, combatBotSystem);
      expect(player.armor).toBe(4);
    });

    it('engine_speed upgrade increases player speed', () => {
      const baseSpeed = player.baseSpeed;
      saveData.currency = 100000;
      system.purchase('engine_speed', saveData);
      system.applyUpgrades(player, radar, pingSystem, miningBotSystem, combatBotSystem);
      expect(player.speed).toBe(baseSpeed + 15);
    });

    it('ping_range upgrade increases radar and ping radius', () => {
      saveData.currency = 100000;
      system.purchase('ping_range', saveData);
      system.applyUpgrades(player, radar, pingSystem, miningBotSystem, combatBotSystem);
      expect(radar.getRadius()).toBe(380);
      expect(pingSystem.getConfig().maxRadius).toBe(380);
    });

    it('ping_frequency upgrade reduces cooldown', () => {
      saveData.currency = 100000;
      system.purchase('ping_frequency', saveData);
      system.applyUpgrades(player, radar, pingSystem, miningBotSystem, combatBotSystem);
      expect(pingSystem.getConfig().cooldown).toBeLessThan(DEFAULT_PING_CONFIG.cooldown);
    });

    it('max_mining_bots upgrade increases mining bot limit', () => {
      saveData.currency = 100000;
      system.purchase('max_mining_bots', saveData);
      system.purchase('max_mining_bots', saveData);
      system.applyUpgrades(player, radar, pingSystem, miningBotSystem, combatBotSystem);
      expect(miningBotSystem.maxBots).toBe(5);
    });

    it('mining_speed upgrade increases mining rate multiplier', () => {
      saveData.currency = 100000;
      system.purchase('mining_speed', saveData);
      system.applyUpgrades(player, radar, pingSystem, miningBotSystem, combatBotSystem);
      expect(miningBotSystem.miningRateMultiplier).toBeCloseTo(1.2);
    });

    it('mining_range upgrade increases deploy range', () => {
      saveData.currency = 100000;
      system.purchase('mining_range', saveData);
      system.applyUpgrades(player, radar, pingSystem, miningBotSystem, combatBotSystem);
      expect(miningBotSystem.deployRange).toBe(130);
    });

    it('max_combat_bots upgrade increases combat bot limit', () => {
      saveData.currency = 100000;
      system.purchase('max_combat_bots', saveData);
      system.applyUpgrades(player, radar, pingSystem, miningBotSystem, combatBotSystem);
      expect(combatBotSystem.maxBots).toBe(3);
    });

    it('combat_damage upgrade increases bot base damage', () => {
      saveData.currency = 100000;
      system.purchase('combat_damage', saveData);
      system.applyUpgrades(player, radar, pingSystem, miningBotSystem, combatBotSystem);
      expect(combatBotSystem.baseDamage).toBe(6);
    });

    it('combat_lifetime upgrade increases bot base lifetime', () => {
      saveData.currency = 100000;
      system.purchase('combat_lifetime', saveData);
      system.applyUpgrades(player, radar, pingSystem, miningBotSystem, combatBotSystem);
      expect(combatBotSystem.baseLifetime).toBe(25);
    });

    it('skips upgrades at level 0', () => {
      const initialArmor = player.armor;
      system.applyUpgrades(player, radar, pingSystem, miningBotSystem, combatBotSystem);
      expect(player.armor).toBe(initialArmor);
    });
  });
});
