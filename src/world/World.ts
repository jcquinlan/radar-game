import {
  GameEntity,
  Enemy,
  Resource,
  createResource,
  createEnemy,
  createAlly,
} from '../entities/Entity';

const CHUNK_SIZE = 400;
const BASE_RESOURCES_PER_CHUNK = 3;
const BASE_ENEMIES_PER_CHUNK = 2;
const ALLIES_PER_CHUNK = 0.6;

/** Radius (in pixels) around a pack center within which pack members scatter */
const PACK_SCATTER_RADIUS = 80;
/** Fraction of enemies that spawn in packs vs. fully random */
const PACK_FRACTION = 0.6;
/** Min/max enemies per pack */
const PACK_SIZE_MIN = 2;
const PACK_SIZE_MAX = 4;

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
        // Skip enemy spawning in the inner 3x3 chunks around the player so
        // nothing starts within aggro range (max chase range is 300px)
        const isNearPlayer = Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
        const enemyCount = isNearPlayer ? 0 : Math.floor(BASE_ENEMIES_PER_CHUNK * difficulty);

        // Split enemies between packs and solo stragglers
        const packEnemyBudget = Math.floor(enemyCount * PACK_FRACTION);
        const soloEnemyCount = enemyCount - packEnemyBudget;

        // Spawn packs: pick a cluster center, scatter members around it
        let packBudgetRemaining = packEnemyBudget;
        while (packBudgetRemaining > 0) {
          const packSize = Math.min(
            packBudgetRemaining,
            PACK_SIZE_MIN + Math.floor(Math.random() * (PACK_SIZE_MAX - PACK_SIZE_MIN + 1))
          );
          // Pack center — random point within the chunk, with padding so members stay in-bounds
          const centerX = chunkX + PACK_SCATTER_RADIUS + Math.random() * (CHUNK_SIZE - PACK_SCATTER_RADIUS * 2);
          const centerY = chunkY + PACK_SCATTER_RADIUS + Math.random() * (CHUNK_SIZE - PACK_SCATTER_RADIUS * 2);

          for (let i = 0; i < packSize; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * PACK_SCATTER_RADIUS;
            const enemy = createEnemy(centerX + Math.cos(angle) * dist, centerY + Math.sin(angle) * dist);
            this.scaleEnemy(enemy, difficulty);
            this.entities.push(enemy);
          }
          packBudgetRemaining -= packSize;
        }

        // Spawn solo stragglers randomly across the chunk
        for (let i = 0; i < soloEnemyCount; i++) {
          const enemy = createEnemy(
            chunkX + Math.random() * CHUNK_SIZE,
            chunkY + Math.random() * CHUNK_SIZE
          );
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
      // Keep towed resources regardless of distance
      if (e.type === 'resource' && (e as Resource).towedByPlayer) return true;
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
