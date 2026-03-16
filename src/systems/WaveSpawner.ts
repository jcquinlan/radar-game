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
  const rangedSpawnRadius = 400; // Closer so projectiles can reach the base
  const enemies: Enemy[] = [];

  for (let i = 0; i < totalEnemies; i++) {
    // Distribute evenly around the circle
    const angle = (i / totalEnemies) * Math.PI * 2;

    // Mix: 55% scouts, 35% brutes, 10% ranged
    let subtype: EnemySubtype;
    const ratio = i / totalEnemies;
    if (ratio < 0.55) {
      subtype = 'scout';
    } else if (ratio < 0.9) {
      subtype = 'brute';
    } else {
      subtype = 'ranged';
    }

    const radius = subtype === 'ranged' ? rangedSpawnRadius : spawnRadius;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

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
