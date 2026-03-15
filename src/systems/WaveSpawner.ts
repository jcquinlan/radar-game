import { Enemy, EnemySubtype, createEnemy } from '../entities/Entity';
import { scaleEnemy } from '../world/POIGenerator';

/**
 * Spawn a wave of enemies in a circle around the origin.
 * Returns the spawned enemies (caller adds them to the world entity list).
 *
 * @param runCount - Current run number (1-based). Controls wave size and difficulty.
 */
export function spawnWave(runCount: number): Enemy[] {
  const totalEnemies = 10 + runCount * 5;
  const difficulty = 1 + runCount * 0.3;
  const spawnRadius = 800;
  const enemies: Enemy[] = [];

  for (let i = 0; i < totalEnemies; i++) {
    // Distribute evenly around the circle
    const angle = (i / totalEnemies) * Math.PI * 2;
    const x = Math.cos(angle) * spawnRadius;
    const y = Math.sin(angle) * spawnRadius;

    // Mix: 50% scouts, 30% brutes, 20% ranged
    let subtype: EnemySubtype;
    const ratio = i / totalEnemies;
    if (ratio < 0.5) {
      subtype = 'scout';
    } else if (ratio < 0.8) {
      subtype = 'brute';
    } else {
      subtype = 'ranged';
    }

    const enemy = createEnemy(x, y, subtype);
    scaleEnemy(enemy, difficulty);
    enemy.waveEnemy = true;
    enemy.visible = true; // Wave enemies are always visible
    enemies.push(enemy);
  }

  // Designate one boss: the first brute, upgraded with 5x HP and 2x damage
  const firstBrute = enemies.find(e => e.subtype === 'brute');
  if (firstBrute) {
    firstBrute.health *= 5;
    firstBrute.maxHealth = firstBrute.health;
    firstBrute.damage *= 2;
    firstBrute.isBoss = true;
  }

  return enemies;
}
