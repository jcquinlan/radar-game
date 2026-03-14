import { describe, it, expect } from 'vitest';
import { Player } from './Player';

describe('Player', () => {
  it('initializes with default values', () => {
    const player = new Player();
    expect(player.x).toBe(0);
    expect(player.y).toBe(0);
    expect(player.health).toBe(100);
    expect(player.maxHealth).toBe(100);
    expect(player.energy).toBe(0);
    expect(player.isAlive()).toBe(true);
    expect(player.armor).toBe(0);
    expect(player.magnetRange).toBe(0);
  });

  it('initializes at a given position', () => {
    const player = new Player(50, 100);
    expect(player.x).toBe(50);
    expect(player.y).toBe(100);
  });

  it('takes damage without going below 0', () => {
    const player = new Player();
    player.takeDamage(30);
    expect(player.health).toBe(70);

    player.takeDamage(200);
    expect(player.health).toBe(0);
    expect(player.isAlive()).toBe(false);
  });

  it('reduces damage taken by armor amount', () => {
    const player = new Player();
    player.armor = 3;
    player.takeDamage(10);
    expect(player.health).toBe(93); // 100 - (10-3)
  });

  it('reduces damage further when shield is active', () => {
    const player = new Player();
    player.applyShield(0.5, 5);
    player.takeDamage(20);
    expect(player.health).toBe(90); // 100 - (20 * 0.5)
  });

  it('shield expires after its duration', () => {
    const player = new Player();
    player.applyShield(0.5, 2);
    expect(player.shieldActive).toBe(true);

    player.updateShield(2.1);
    expect(player.shieldActive).toBe(false);
  });

  it('heals without exceeding max health', () => {
    const player = new Player();
    player.takeDamage(50);
    player.heal(30);
    expect(player.health).toBe(80);

    player.heal(100);
    expect(player.health).toBe(100);
  });

  it('adds and spends energy', () => {
    const player = new Player();
    player.addEnergy(50);
    expect(player.energy).toBe(50);

    expect(player.spendEnergy(30)).toBe(true);
    expect(player.energy).toBe(20);

    expect(player.spendEnergy(30)).toBe(false);
    expect(player.energy).toBe(20); // unchanged
  });
});
