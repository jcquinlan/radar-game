import { describe, it, expect } from 'vitest';
import { spawnWave, spawnBoss } from './WaveSpawner';

describe('spawnWave', () => {
  it('spawns 10 + runCount*5 enemies for runCount 1', () => {
    const enemies = spawnWave(1);
    expect(enemies).toHaveLength(15);
  });

  it('spawns 10 + runCount*5 enemies for runCount 3', () => {
    const enemies = spawnWave(3);
    expect(enemies).toHaveLength(25);
  });

  it('spawns melee enemies at 800px and ranged at 400px', () => {
    const enemies = spawnWave(1);
    for (const e of enemies) {
      const dist = Math.sqrt(e.x * e.x + e.y * e.y);
      if (e.subtype === 'ranged') {
        expect(dist).toBeCloseTo(400, 0);
      } else {
        expect(dist).toBeCloseTo(800, 0);
      }
    }
  });

  it('produces approximately 55% scouts, 35% brutes, 10% ranged', () => {
    const enemies = spawnWave(2); // 20 enemies
    const scouts = enemies.filter(e => e.subtype === 'scout').length;
    const brutes = enemies.filter(e => e.subtype === 'brute').length;
    const ranged = enemies.filter(e => e.subtype === 'ranged').length;

    expect(scouts).toBe(11); // 55% of 20
    expect(brutes).toBe(7);  // 35% of 20
    expect(ranged).toBe(2);  // 10% of 20
  });

  it('marks all enemies as waveEnemy', () => {
    const enemies = spawnWave(1);
    for (const e of enemies) {
      expect(e.waveEnemy).toBe(true);
    }
  });

  it('makes all wave enemies visible', () => {
    const enemies = spawnWave(1);
    for (const e of enemies) {
      expect(e.visible).toBe(true);
    }
  });

  it('designates exactly one boss (a brute with 5x HP and 2x damage)', () => {
    const enemies = spawnWave(1);
    const bosses = enemies.filter(e => e.isBoss);
    expect(bosses).toHaveLength(1);
    expect(bosses[0].subtype).toBe('brute');

    // Compare boss stats to a non-boss brute
    const normalBrutes = enemies.filter(e => e.subtype === 'brute' && !e.isBoss);
    if (normalBrutes.length > 0) {
      // Boss has 5x HP of a normal brute at same difficulty
      expect(bosses[0].maxHealth).toBe(normalBrutes[0].maxHealth * 5);
      // Boss has 2x damage of a normal brute at same difficulty
      expect(bosses[0].damage).toBe(normalBrutes[0].damage * 2);
    }
  });

  it('scales enemies by difficulty based on runCount', () => {
    const run1 = spawnWave(1);
    const run3 = spawnWave(3);

    // Find a non-boss scout from each wave
    const scout1 = run1.find(e => e.subtype === 'scout' && !e.isBoss)!;
    const scout3 = run3.find(e => e.subtype === 'scout' && !e.isBoss)!;

    // Run 3 has higher difficulty (1 + 3*0.3 = 1.9) vs run 1 (1 + 1*0.3 = 1.3)
    expect(scout3.maxHealth).toBeGreaterThan(scout1.maxHealth);
  });
});

describe('spawnBoss', () => {
  it('spawns a boss at 2000-3000px from origin', () => {
    const boss = spawnBoss(1);
    const dist = Math.sqrt(boss.x * boss.x + boss.y * boss.y);
    expect(dist).toBeGreaterThanOrEqual(2000);
    expect(dist).toBeLessThanOrEqual(3000);
  });

  it('creates a boss with isBoss=true and waveEnemy=true', () => {
    const boss = spawnBoss(1);
    expect(boss.isBoss).toBe(true);
    expect(boss.waveEnemy).toBe(true);
    expect(boss.visible).toBe(true);
    expect(boss.aggro).toBe(true);
  });

  it('boss has 350+ HP base (scaled by run count)', () => {
    const boss = spawnBoss(1);
    // At runCount 1: difficulty = 1.15, so HP = floor(350 * 1.15) = 402
    expect(boss.health).toBeGreaterThanOrEqual(350);
    expect(boss.maxHealth).toBe(boss.health);
  });

  it('boss is stronger on later runs', () => {
    const boss1 = spawnBoss(1);
    const boss5 = spawnBoss(5);
    expect(boss5.maxHealth).toBeGreaterThan(boss1.maxHealth);
    expect(boss5.damage).toBeGreaterThan(boss1.damage);
  });

  it('boss starts in phase 1', () => {
    const boss = spawnBoss(1);
    expect(boss.bossPhase).toBe(1);
  });
});
