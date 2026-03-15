import { describe, it, expect } from 'vitest';
import { spawnWave } from './WaveSpawner';

describe('spawnWave', () => {
  it('spawns 10 + runCount*5 enemies for runCount 1', () => {
    const enemies = spawnWave(1);
    expect(enemies).toHaveLength(15);
  });

  it('spawns 10 + runCount*5 enemies for runCount 3', () => {
    const enemies = spawnWave(3);
    expect(enemies).toHaveLength(25);
  });

  it('spawns enemies on an 800px circle around origin', () => {
    const enemies = spawnWave(1);
    for (const e of enemies) {
      const dist = Math.sqrt(e.x * e.x + e.y * e.y);
      expect(dist).toBeCloseTo(800, 0);
    }
  });

  it('produces approximately 50% scouts, 30% brutes, 20% ranged', () => {
    const enemies = spawnWave(2); // 20 enemies
    const scouts = enemies.filter(e => e.subtype === 'scout').length;
    const brutes = enemies.filter(e => e.subtype === 'brute').length;
    const ranged = enemies.filter(e => e.subtype === 'ranged').length;

    expect(scouts).toBe(10); // 50% of 20
    expect(brutes).toBe(6);  // 30% of 20
    expect(ranged).toBe(4);  // 20% of 20
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
