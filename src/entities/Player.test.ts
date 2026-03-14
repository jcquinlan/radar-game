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
