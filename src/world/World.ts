import {
  GameEntity,
  createEnemy,
  EnemySubtype,
} from '../entities/Entity';
import { selectPOI, spawnResourceVein, scaleEnemy } from './POIGenerator';

const CHUNK_SIZE = 400;

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

/** Chance of a solo enemy in non-POI chunks (per chunk) */
const AMBIENT_SOLO_ENEMY_CHANCE = 0.3;

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

        // Safe zone: no enemies in the inner 3x3 chunks around the player
        const isNearPlayer = Math.abs(dx) <= 1 && Math.abs(dy) <= 1;

        // Try to place a POI in this chunk
        const poi = isNearPlayer ? null : selectPOI(chunkCenterX, chunkCenterY);

        if (poi) {
          // POI chunk — use structured spawning
          const poiEntities = poi.spawn(chunkCenterX, chunkCenterY, difficulty);
          this.entities.push(...poiEntities);
        } else {
          // Non-POI chunk — ambient resources as veins + occasional solo enemies
          this.spawnAmbient(chunkX, chunkY, difficulty, isNearPlayer);
        }
      }
    }
  }

  /** Spawn ambient resources (as veins) and occasional solo enemies in non-POI chunks */
  private spawnAmbient(
    chunkX: number,
    chunkY: number,
    difficulty: number,
    isNearPlayer: boolean
  ): void {
    // 1-2 resource veins per chunk
    const veinCount = 1 + (Math.random() < 0.4 ? 1 : 0);
    for (let v = 0; v < veinCount; v++) {
      const veinCenterX = chunkX + 60 + Math.random() * (CHUNK_SIZE - 120);
      const veinCenterY = chunkY + 60 + Math.random() * (CHUNK_SIZE - 120);
      const vein = spawnResourceVein(veinCenterX, veinCenterY);
      this.entities.push(...vein);
    }

    // Occasional solo enemy (not in safe zone)
    if (!isNearPlayer && Math.random() < AMBIENT_SOLO_ENEMY_CHANCE) {
      const subtypes: EnemySubtype[] = ['scout', 'brute', 'ranged'];
      const subtype = subtypes[Math.floor(Math.random() * subtypes.length)];
      const enemy = createEnemy(
        chunkX + Math.random() * CHUNK_SIZE,
        chunkY + Math.random() * CHUNK_SIZE,
        subtype
      );
      scaleEnemy(enemy, difficulty);
      this.entities.push(enemy);
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
