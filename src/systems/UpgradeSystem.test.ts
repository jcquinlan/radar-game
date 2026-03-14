import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpgradeSystem } from './UpgradeSystem';
import { Player } from '../entities/Player';
import { RadarDisplay } from '../radar/RadarDisplay';

describe('UpgradeSystem', () => {
  let player: Player;
  let radar: RadarDisplay;
  let upgrades: UpgradeSystem;
  let resolutionLevel: number;

  beforeEach(() => {
    player = new Player();
    radar = new RadarDisplay();
    resolutionLevel = 0;
    upgrades = new UpgradeSystem(player, radar, (lvl) => {
      resolutionLevel = lvl;
    });
  });

  it('initializes with 4 upgrades at level 0', () => {
    expect(upgrades.upgrades).toHaveLength(4);
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
    expect(player.energy).toBe(1); // unchanged
  });

  it('cannot purchase beyond max level', () => {
    player.addEnergy(10000);
    const upgrade = upgrades.getUpgrade('sweep_speed')!;

    // Buy to max
    for (let i = 0; i < upgrade.maxLevel; i++) {
      upgrades.purchase('sweep_speed', player);
    }
    expect(upgrade.level).toBe(upgrade.maxLevel);

    const result = upgrades.purchase('sweep_speed', player);
    expect(result).toBe(false);
  });

  it('sweep speed upgrade increases radar sweep speed', () => {
    const initialSpeed = radar.getConfig().sweepSpeed;
    player.addEnergy(100);
    upgrades.purchase('sweep_speed', player);
    expect(radar.getConfig().sweepSpeed).toBeGreaterThan(initialSpeed);
  });

  it('sweep range upgrade increases radar radius', () => {
    const initialRadius = radar.getRadius();
    player.addEnergy(100);
    upgrades.purchase('sweep_range', player);
    expect(radar.getRadius()).toBeGreaterThan(initialRadius);
  });

  it('sweep damage upgrade increases player sweep damage', () => {
    const initialDamage = player.sweepDamage;
    player.addEnergy(100);
    upgrades.purchase('sweep_damage', player);
    expect(player.sweepDamage).toBeGreaterThan(initialDamage);
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

  it('canPurchase returns correct values', () => {
    expect(upgrades.canPurchase('sweep_speed', 0)).toBe(false);
    expect(upgrades.canPurchase('sweep_speed', 1000)).toBe(true);
    expect(upgrades.canPurchase('nonexistent', 1000)).toBe(false);
  });
});
