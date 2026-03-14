import {
  GameEntity,
  Enemy,
  createResource,
  createEnemy,
  createAlly,
} from '../entities/Entity';

const CHUNK_SIZE = 400;
const BASE_RESOURCES_PER_CHUNK = 3;
const BASE_ENEMIES_PER_CHUNK = 1;
const ALLIES_PER_CHUNK = 0.6;

/** Returns a difficulty multiplier based on distance from origin */
function getDifficultyMultiplier(x: number, y: number): number {
  const dist = Math.sqrt(x * x + y * y);
  // Gradual scaling: 1.0 at origin, ~2.0 at 2000px, ~3.0 at 5000px
  return 1 + Math.log2(1 + dist / 1000);
}

/** Returns a threat level label for HUD display */
export function getThreatLevel(x: number, y: number): { level: number; label: string; color: string } {
  const mult = getDifficultyMultiplier(x, y);
  if (mult < 1.3) return { level: 1, label: 'LOW', color: '#00ff41' };
  if (mult < 1.8) return { level: 2, label: 'MODERATE', color: '#88ff41' };
  if (mult < 2.5) return { level: 3, label: 'HIGH', color: '#ffaa00' };
  if (mult < 3.2) return { level: 4, label: 'EXTREME', color: '#ff4141' };
  return { level: 5, label: 'CRITICAL', color: '#ff00ff' };
}

export class World {
  entities: GameEntity[] = [];
  private visitedChunks = new Set<string>();

  /** Spawn entities around a position if new chunks are entered */
  updateSpawning(playerX: number, playerY: number): void {
    const cx = Math.floor(playerX / CHUNK_SIZE);
    const cy = Math.floor(playerY / CHUNK_SIZE);

    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const key = `${cx + dx},${cy + dy}`;
        if (this.visitedChunks.has(key)) continue;
        this.visitedChunks.add(key);

        const chunkX = (cx + dx) * CHUNK_SIZE;
        const chunkY = (cy + dy) * CHUNK_SIZE;
        const chunkCenterX = chunkX + CHUNK_SIZE / 2;
        const chunkCenterY = chunkY + CHUNK_SIZE / 2;
        const difficulty = getDifficultyMultiplier(chunkCenterX, chunkCenterY);

        // Resources (slightly more at higher difficulty to compensate)
        const resourceCount = Math.floor(BASE_RESOURCES_PER_CHUNK + difficulty * 0.5);
        for (let i = 0; i < resourceCount; i++) {
          this.entities.push(
            createResource(
              chunkX + Math.random() * CHUNK_SIZE,
              chunkY + Math.random() * CHUNK_SIZE
            )
          );
        }

        // Enemies (more at higher difficulty)
        const enemyCount = Math.floor(BASE_ENEMIES_PER_CHUNK * difficulty);
        for (let i = 0; i < enemyCount; i++) {
          const enemy = createEnemy(
            chunkX + Math.random() * CHUNK_SIZE,
            chunkY + Math.random() * CHUNK_SIZE
          );
          // Scale enemy stats by difficulty
          this.scaleEnemy(enemy, difficulty);
          this.entities.push(enemy);
        }

        // Allies
        if (Math.random() < ALLIES_PER_CHUNK) {
          this.entities.push(
            createAlly(
              chunkX + Math.random() * CHUNK_SIZE,
              chunkY + Math.random() * CHUNK_SIZE
            )
          );
        }
      }
    }
  }

  private scaleEnemy(enemy: Enemy, difficulty: number): void {
    const scale = difficulty;
    enemy.health = Math.floor(enemy.health * scale);
    enemy.maxHealth = enemy.health;
    enemy.damage = Math.floor(enemy.damage * scale);
    enemy.energyDrop = Math.floor(enemy.energyDrop * scale);
    enemy.speed = Math.floor(enemy.speed * (1 + (scale - 1) * 0.3)); // Speed scales less aggressively
  }

  /** Remove inactive entities that are far from the player */
  cleanup(playerX: number, playerY: number, maxDist: number = 2000): void {
    this.entities = this.entities.filter((e) => {
      if (!e.active) return false;
      const dx = e.x - playerX;
      const dy = e.y - playerY;
      return dx * dx + dy * dy < maxDist * maxDist;
    });
  }

  getActiveEntities(): GameEntity[] {
    return this.entities.filter((e) => e.active);
  }
}
