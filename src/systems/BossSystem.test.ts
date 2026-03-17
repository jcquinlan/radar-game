import { describe, it, expect, beforeEach } from 'vitest';
import { createBossEnemy } from '../entities/Entity';
import { BossSystem } from './BossSystem';

describe('BossSystem', () => {
  let bossSystem: BossSystem;

  beforeEach(() => {
    bossSystem = new BossSystem();
  });

  describe('phase transitions', () => {
    it('stays in phase 1 when HP is above 60%', () => {
      const boss = createBossEnemy(0, 0);
      boss.health = boss.maxHealth * 0.8; // 80% HP
      bossSystem.updateBoss(boss, 0.016, 1);
      expect(boss.bossPhase).toBe(1);
    });

    it('transitions to phase 2 when HP drops to 60%', () => {
      const boss = createBossEnemy(0, 0);
      boss.health = boss.maxHealth * 0.6; // exactly 60%
      bossSystem.updateBoss(boss, 0.016, 1);
      expect(boss.bossPhase).toBe(2);
    });

    it('transitions to phase 2 when HP is between 30-60%', () => {
      const boss = createBossEnemy(0, 0);
      boss.health = boss.maxHealth * 0.45; // 45% HP
      bossSystem.updateBoss(boss, 0.016, 1);
      expect(boss.bossPhase).toBe(2);
    });

    it('transitions to phase 3 when HP drops to 30%', () => {
      const boss = createBossEnemy(0, 0);
      boss.health = boss.maxHealth * 0.3; // exactly 30%
      bossSystem.updateBoss(boss, 0.016, 1);
      expect(boss.bossPhase).toBe(3);
    });

    it('transitions to phase 3 when HP is below 30%', () => {
      const boss = createBossEnemy(0, 0);
      boss.health = boss.maxHealth * 0.1; // 10% HP
      bossSystem.updateBoss(boss, 0.016, 1);
      expect(boss.bossPhase).toBe(3);
    });
  });

  describe('stat modifications per phase', () => {
    it('phase 1 uses base fire rate (1.5s) and base speed (40)', () => {
      const boss = createBossEnemy(0, 0);
      boss.health = boss.maxHealth; // 100% HP
      bossSystem.updateBoss(boss, 0.016, 1);
      expect(boss.fireRate).toBe(1.5);
      expect(boss.speed).toBe(40);
    });

    it('phase 2 increases fire rate to 1.0s and speed by 20%', () => {
      const boss = createBossEnemy(0, 0);
      boss.health = boss.maxHealth * 0.5; // 50% HP → phase 2
      bossSystem.updateBoss(boss, 0.016, 1);
      expect(boss.fireRate).toBe(1.0);
      expect(boss.speed).toBe(48); // 40 * 1.2
    });

    it('phase 3 increases fire rate to 0.7s and speed by 50%', () => {
      const boss = createBossEnemy(0, 0);
      boss.health = boss.maxHealth * 0.2; // 20% HP → phase 3
      bossSystem.updateBoss(boss, 0.016, 1);
      expect(boss.fireRate).toBe(0.7);
      expect(boss.speed).toBe(60); // 40 * 1.5
    });
  });

  describe('minion spawning', () => {
    it('does not spawn minions in phase 1', () => {
      const boss = createBossEnemy(0, 0);
      boss.health = boss.maxHealth; // phase 1
      // Accumulate 15 seconds
      const minions = bossSystem.updateBoss(boss, 15, 1);
      expect(minions).toHaveLength(0);
    });

    it('spawns 2 scout minions every 10s in phase 2', () => {
      const boss = createBossEnemy(0, 0);
      boss.health = boss.maxHealth * 0.5; // phase 2

      // First 9 seconds: no minions
      let minions = bossSystem.updateBoss(boss, 9, 1);
      expect(minions).toHaveLength(0);

      // At 10 seconds: spawn 2 scouts
      minions = bossSystem.updateBoss(boss, 1, 1);
      expect(minions).toHaveLength(2);
      expect(minions[0].subtype).toBe('scout');
      expect(minions[1].subtype).toBe('scout');
      expect(minions[0].waveEnemy).toBe(true);
      expect(minions[0].visible).toBe(true);
    });

    it('spawns minions in phase 3 as well', () => {
      const boss = createBossEnemy(0, 0);
      boss.health = boss.maxHealth * 0.1; // phase 3
      const minions = bossSystem.updateBoss(boss, 10, 1);
      expect(minions).toHaveLength(2);
    });

    it('minions spawn near the boss position', () => {
      const boss = createBossEnemy(1000, 2000);
      boss.health = boss.maxHealth * 0.5; // phase 2
      const minions = bossSystem.updateBoss(boss, 10, 1);
      for (const minion of minions) {
        const dx = minion.x - boss.x;
        const dy = minion.y - boss.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeLessThan(100); // within 70px offset max
      }
    });
  });

  describe('inactive boss', () => {
    it('returns empty array for inactive boss', () => {
      const boss = createBossEnemy(0, 0);
      boss.active = false;
      const minions = bossSystem.updateBoss(boss, 10, 1);
      expect(minions).toHaveLength(0);
    });

    it('returns empty array for non-boss enemy', () => {
      const boss = createBossEnemy(0, 0);
      boss.isBoss = false;
      const minions = bossSystem.updateBoss(boss, 10, 1);
      expect(minions).toHaveLength(0);
    });
  });

  describe('reset', () => {
    it('resets minion timer so minions do not spawn immediately after reset', () => {
      const boss = createBossEnemy(0, 0);
      boss.health = boss.maxHealth * 0.5; // phase 2
      // Accumulate 8 seconds
      bossSystem.updateBoss(boss, 8, 1);
      bossSystem.reset();
      // After reset, 3 more seconds should not trigger spawn (total < 10)
      const minions = bossSystem.updateBoss(boss, 3, 1);
      expect(minions).toHaveLength(0);
    });
  });
});
