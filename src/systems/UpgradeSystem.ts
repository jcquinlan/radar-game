import { Player } from '../entities/Player';
import { RadarDisplay } from '../radar/RadarDisplay';
import { PingSystem, DEFAULT_PING_CONFIG } from './PingSystem';

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  cost: (level: number) => number;
  apply: (level: number) => void;
}

export class UpgradeSystem {
  upgrades: Upgrade[];

  constructor(
    player: Player,
    radar: RadarDisplay,
    onResolutionChange: (level: number) => void,
    pingSystem?: PingSystem
  ) {
    this.upgrades = [
      {
        id: 'sweep_speed',
        name: 'Ping Frequency',
        description: 'Shorter cooldown between pings',
        level: 0,
        maxLevel: 5,
        cost: (lvl) => 20 + lvl * 30,
        apply: (lvl) => {
          if (pingSystem) {
            pingSystem.setCooldown(DEFAULT_PING_CONFIG.cooldown * (1 - lvl * 0.12));
          }
        },
      },
      {
        id: 'sweep_range',
        name: 'Ping Range',
        description: 'Larger radar detection radius',
        level: 0,
        maxLevel: 5,
        cost: (lvl) => 30 + lvl * 40,
        apply: (lvl) => {
          const newRadius = 340 + lvl * 40;
          radar.setRadius(newRadius);
          if (pingSystem) {
            pingSystem.setMaxRadius(newRadius);
          }
        },
      },
      {
        id: 'sweep_damage',
        name: 'Ping Damage',
        description: 'More damage to enemies on ping',
        level: 0,
        maxLevel: 5,
        cost: (lvl) => 25 + lvl * 35,
        apply: (lvl) => {
          player.sweepDamage = 10 + lvl * 8;
        },
      },
      {
        id: 'radar_resolution',
        name: 'Radar Resolution',
        description: 'Show entity type details on blips',
        level: 0,
        maxLevel: 3,
        cost: (lvl) => 50 + lvl * 50,
        apply: (lvl) => {
          onResolutionChange(lvl);
        },
      },
      {
        id: 'hull_armor',
        name: 'Hull Armor',
        description: 'Reduce incoming damage',
        level: 0,
        maxLevel: 5,
        cost: (lvl) => 35 + lvl * 40,
        apply: (lvl) => {
          player.armor = lvl * 2;
        },
      },
      {
        id: 'engine_speed',
        name: 'Engine Speed',
        description: 'Increase movement speed',
        level: 0,
        maxLevel: 5,
        cost: (lvl) => 25 + lvl * 30,
        apply: (lvl) => {
          player.speed = player.baseSpeed + lvl * 15;
        },
      },
      {
        id: 'energy_magnet',
        name: 'Energy Magnet',
        description: 'Auto-collect nearby resources',
        level: 0,
        maxLevel: 5,
        cost: (lvl) => 40 + lvl * 45,
        apply: (lvl) => {
          player.magnetRange = 50 + lvl * 30;
        },
      },
    ];
  }

  getUpgrade(id: string): Upgrade | undefined {
    return this.upgrades.find((u) => u.id === id);
  }

  canPurchase(id: string, energy: number): boolean {
    const upgrade = this.getUpgrade(id);
    if (!upgrade) return false;
    if (upgrade.level >= upgrade.maxLevel) return false;
    return energy >= upgrade.cost(upgrade.level);
  }

  purchase(id: string, player: Player): boolean {
    const upgrade = this.getUpgrade(id);
    if (!upgrade) return false;
    if (upgrade.level >= upgrade.maxLevel) return false;

    const cost = upgrade.cost(upgrade.level);
    if (!player.spendEnergy(cost)) return false;

    upgrade.level++;
    upgrade.apply(upgrade.level);
    return true;
  }

  getNextCost(id: string): number | null {
    const upgrade = this.getUpgrade(id);
    if (!upgrade || upgrade.level >= upgrade.maxLevel) return null;
    return upgrade.cost(upgrade.level);
  }
}
