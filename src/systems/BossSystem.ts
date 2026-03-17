import { Enemy, createEnemy } from '../entities/Entity';
import { scaleEnemy } from '../world/POIGenerator';

/**
 * BossSystem manages boss-specific behavior:
 * - Phase transitions based on HP thresholds
 * - Fire rate and speed adjustments per phase
 * - Minion spawning in phase 2+
 *
 * The boss is a regular Enemy with isBoss=true. This system modifies
 * its stats each frame based on the current phase.
 */

/** Phase 1 base stats (stored at spawn) */
interface BossBaseStats {
  fireRate: number;
  speed: number;
}

export class BossSystem {
  private baseStats: BossBaseStats | null = null;
  private minionTimer = 0;
  /** Interval between minion spawns in phase 2+ (seconds) */
  private readonly MINION_INTERVAL = 10;

  /**
   * Update boss phase and behavior. Call once per frame during final_wave.
   *
   * @returns Array of newly spawned minion enemies (caller adds to world.entities).
   *          Empty array if no minions spawned this frame.
   */
  updateBoss(boss: Enemy, dt: number, runCount: number): Enemy[] {
    if (!boss.active || !boss.isBoss) return [];

    // Capture base stats on first call
    if (!this.baseStats) {
      this.baseStats = {
        fireRate: boss.fireRate,
        speed: boss.speed,
      };
    }

    // Determine phase from HP ratio
    const hpRatio = boss.health / boss.maxHealth;
    let newPhase: number;
    if (hpRatio > 0.6) {
      newPhase = 1;
    } else if (hpRatio > 0.3) {
      newPhase = 2;
    } else {
      newPhase = 3;
    }
    boss.bossPhase = newPhase;

    // Apply phase-specific stat modifications
    if (newPhase === 1) {
      boss.fireRate = this.baseStats.fireRate;  // 1.5s
      boss.speed = this.baseStats.speed;        // 40
    } else if (newPhase === 2) {
      boss.fireRate = 1.0;
      boss.speed = this.baseStats.speed * 1.2;  // 48
    } else {
      boss.fireRate = 0.7;
      boss.speed = this.baseStats.speed * 1.5;  // 60
    }

    // Minion spawning in phase 2+
    const minions: Enemy[] = [];
    if (newPhase >= 2) {
      this.minionTimer += dt;
      if (this.minionTimer >= this.MINION_INTERVAL) {
        this.minionTimer -= this.MINION_INTERVAL;
        // Spawn 2 scouts near the boss
        const difficulty = 1 + runCount * 0.3;
        for (let i = 0; i < 2; i++) {
          const offsetAngle = Math.random() * Math.PI * 2;
          const offsetDist = 30 + Math.random() * 40;
          const minion = createEnemy(
            boss.x + Math.cos(offsetAngle) * offsetDist,
            boss.y + Math.sin(offsetAngle) * offsetDist,
            'scout',
          );
          scaleEnemy(minion, difficulty);
          minion.waveEnemy = true;
          minion.visible = true;
          minion.aggro = true;
          minions.push(minion);
        }
      }
    }

    return minions;
  }

  /** Reset system state for a new boss fight */
  reset(): void {
    this.baseStats = null;
    this.minionTimer = 0;
  }
}
