import { describe, it, expect, beforeEach } from 'vitest';
import { UpgradeSystem } from './UpgradeSystem';
import { Player } from '../entities/Player';
import { RadarDisplay } from '../radar/RadarDisplay';
import { PingSystem, DEFAULT_PING_CONFIG } from './PingSystem';

describe('UpgradeSystem', () => {
  let player: Player;
  let radar: RadarDisplay;
  let pingSystem: PingSystem;
  let upgrades: UpgradeSystem;
  let resolutionLevel: number;

  beforeEach(() => {
    player = new Player();
    radar = new RadarDisplay();
    pingSystem = new PingSystem();
    resolutionLevel = 0;
    upgrades = new UpgradeSystem(player, radar, (lvl) => {
      resolutionLevel = lvl;
    }, pingSystem);
  });

  it('initializes with 6 upgrades at level 0', () => {
    expect(upgrades.upgrades).toHaveLength(6);
    for (const u of upgrades.upgrades) {
      expect(u.level).toBe(0);
    }
  });

  it('can purchase an upgrade when player has enough energy', () => {
    player.addEnergy(100);
    const result = upgrades.purchase('sweep_speed', player);
    expect(result).toBe(true);

    const upgrade = upgrades.getUpgrade('sweep_speed')!;
    expect(upgrade.level).toBe(1);
  });

  it('deducts energy on purchase', () => {
    player.addEnergy(100);
    const cost = upgrades.getNextCost('sweep_speed')!;
    upgrades.purchase('sweep_speed', player);
    expect(player.energy).toBe(100 - cost);
  });

  it('cannot purchase without enough energy', () => {
    player.addEnergy(1);
    const result = upgrades.purchase('sweep_speed', player);
    expect(result).toBe(false);

    const upgrade = upgrades.getUpgrade('sweep_speed')!;
    expect(upgrade.level).toBe(0);
    expect(player.energy).toBe(1);
  });

  it('cannot purchase beyond max level', () => {
    player.addEnergy(10000);
    const upgrade = upgrades.getUpgrade('sweep_speed')!;

    for (let i = 0; i < upgrade.maxLevel; i++) {
      upgrades.purchase('sweep_speed', player);
    }
    expect(upgrade.level).toBe(upgrade.maxLevel);

    const result = upgrades.purchase('sweep_speed', player);
    expect(result).toBe(false);
  });

  it('ping frequency upgrade reduces ping cooldown', () => {
    const initialCooldown = pingSystem.getConfig().cooldown;
    player.addEnergy(100);
    upgrades.purchase('sweep_speed', player);
    expect(pingSystem.getConfig().cooldown).toBeLessThan(initialCooldown);
  });

  it('ping range upgrade increases radar radius and ping max radius', () => {
    const initialRadius = radar.getRadius();
    player.addEnergy(100);
    upgrades.purchase('sweep_range', player);
    expect(radar.getRadius()).toBeGreaterThan(initialRadius);
    expect(pingSystem.getConfig().maxRadius).toBe(radar.getRadius());
  });

  it('radar resolution upgrade triggers the callback', () => {
    player.addEnergy(100);
    upgrades.purchase('radar_resolution', player);
    expect(resolutionLevel).toBe(1);
  });

  it('getNextCost returns null at max level', () => {
    player.addEnergy(10000);
    const upgrade = upgrades.getUpgrade('radar_resolution')!;
    for (let i = 0; i < upgrade.maxLevel; i++) {
      upgrades.purchase('radar_resolution', player);
    }
    expect(upgrades.getNextCost('radar_resolution')).toBeNull();
  });

  it('hull armor upgrade reduces damage taken', () => {
    player.addEnergy(100);
    upgrades.purchase('hull_armor', player);
    expect(player.armor).toBeGreaterThan(0);
  });

  it('engine speed upgrade increases player speed', () => {
    const initialSpeed = player.speed;
    player.addEnergy(100);
    upgrades.purchase('engine_speed', player);
    expect(player.speed).toBeGreaterThan(initialSpeed);
  });

  it('energy magnet upgrade sets magnet range', () => {
    player.addEnergy(100);
    upgrades.purchase('energy_magnet', player);
    expect(player.magnetRange).toBeGreaterThan(0);
  });

  it('canPurchase returns correct values', () => {
    expect(upgrades.canPurchase('sweep_speed', 0)).toBe(false);
    expect(upgrades.canPurchase('sweep_speed', 1000)).toBe(true);
    expect(upgrades.canPurchase('nonexistent', 1000)).toBe(false);
  });
});
