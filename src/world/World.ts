import {
  GameEntity,
  createResource,
  createEnemy,
  createAlly,
} from '../entities/Entity';

const SPAWN_RADIUS_MIN = 300;
const SPAWN_RADIUS_MAX = 800;
const CHUNK_SIZE = 400;
const RESOURCES_PER_CHUNK = 3;
const ENEMIES_PER_CHUNK = 1;
const ALLIES_PER_CHUNK = 0.3; // ~1 per 3 chunks

export class World {
  entities: GameEntity[] = [];
  private visitedChunks = new Set<string>();

  /** Spawn entities around a position if new chunks are entered */
  updateSpawning(playerX: number, playerY: number): void {
    const cx = Math.floor(playerX / CHUNK_SIZE);
    const cy = Math.floor(playerY / CHUNK_SIZE);

    // Check surrounding chunks
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const key = `${cx + dx},${cy + dy}`;
        if (this.visitedChunks.has(key)) continue;
        this.visitedChunks.add(key);

        const chunkX = (cx + dx) * CHUNK_SIZE;
        const chunkY = (cy + dy) * CHUNK_SIZE;

        // Spawn resources
        for (let i = 0; i < RESOURCES_PER_CHUNK; i++) {
          this.entities.push(
            createResource(
              chunkX + Math.random() * CHUNK_SIZE,
              chunkY + Math.random() * CHUNK_SIZE
            )
          );
        }

        // Spawn enemies
        for (let i = 0; i < ENEMIES_PER_CHUNK; i++) {
          this.entities.push(
            createEnemy(
              chunkX + Math.random() * CHUNK_SIZE,
              chunkY + Math.random() * CHUNK_SIZE
            )
          );
        }

        // Spawn allies (probabilistic)
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
