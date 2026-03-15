import {
  GameEntity,
  Salvage,
  createEnemy,
  createSalvage,
  EnemySubtype,
} from '../entities/Entity';
import { selectPOI, spawnResourceVein, scaleEnemy } from './POIGenerator';
import { getTheme } from '../themes/theme';
import { LevelConfig } from '../levels/LevelConfig';

const CHUNK_SIZE = 400;
/** Probability of a salvage item spawning in any given chunk */
const SALVAGE_CHANCE_PER_CHUNK = 0.15;

/** Returns a difficulty multiplier based on distance from origin */
function getDifficultyMultiplier(x: number, y: number): number {
  const dist = Math.sqrt(x * x + y * y);
  // Gradual scaling: 1.0 at origin, ~2.0 at 2000px, ~3.0 at 5000px
  return 1 + Math.log2(1 + dist / 1000);
}

/** Returns a threat level label for HUD display */
export function getThreatLevel(x: number, y: number): { level: number; label: string; color: string } {
  const mult = getDifficultyMultiplier(x, y);
  const threats = getTheme().threats;
  if (mult < 1.3) return { level: 1, label: 'LOW', color: threats.low };
  if (mult < 1.8) return { level: 2, label: 'MODERATE', color: threats.moderate };
  if (mult < 2.5) return { level: 3, label: 'HIGH', color: threats.high };
  if (mult < 3.2) return { level: 4, label: 'EXTREME', color: threats.extreme };
  return { level: 5, label: 'CRITICAL', color: threats.critical };
}

/** Chance of a solo enemy in non-POI chunks (per chunk) */
const AMBIENT_SOLO_ENEMY_CHANCE = 0.3;

export class World {
  entities: GameEntity[] = [];
  private visitedChunks = new Set<string>();
  private levelConfig: LevelConfig | null = null;

  setLevelConfig(config: LevelConfig | null): void {
    this.levelConfig = config;
  }

  getChunkCount(): number {
    return this.visitedChunks.size;
  }

  /** Spawn entities around a position if new chunks are entered */
  updateSpawning(playerX: number, playerY: number): void {
    const cx = Math.floor(playerX / CHUNK_SIZE);
    const cy = Math.floor(playerY / CHUNK_SIZE);

    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const key = `${cx + dx},${cy + dy}`;
        if (this.visitedChunks.has(key)) continue;

        // Respect level chunk limit
        if (this.levelConfig?.world.maxChunks != null &&
            this.visitedChunks.size >= this.levelConfig.world.maxChunks) {
          continue;
        }

        this.visitedChunks.add(key);

        const chunkX = (cx + dx) * CHUNK_SIZE;
        const chunkY = (cy + dy) * CHUNK_SIZE;
        const chunkCenterX = chunkX + CHUNK_SIZE / 2;
        const chunkCenterY = chunkY + CHUNK_SIZE / 2;

        let difficulty = getDifficultyMultiplier(chunkCenterX, chunkCenterY);
        if (this.levelConfig?.world.difficultyMultiplier != null) {
          difficulty = this.levelConfig.world.difficultyMultiplier;
        }

        // Safe zone: no enemies in the inner 3x3 chunks around the player
        const isNearPlayer = Math.abs(dx) <= 1 && Math.abs(dy) <= 1;

        // Skip enemy/ally spawning based on level config
        const spawnEnemies = this.levelConfig?.world.spawnEnemies ?? true;
        const spawnAllies = this.levelConfig?.world.spawnAllies ?? true;

        // Try to place a POI in this chunk
        const poi = (isNearPlayer || (!spawnEnemies && !spawnAllies)) ? null : selectPOI(chunkCenterX, chunkCenterY);

        if (poi) {
          // POI chunk — use structured spawning
          const poiEntities = poi.spawn(chunkCenterX, chunkCenterY, difficulty);
          // Filter out enemies/allies if level config disables them
          const filtered = poiEntities.filter(e => {
            if (e.type === 'enemy' && !spawnEnemies) return false;
            if (e.type === 'ally' && !spawnAllies) return false;
            return true;
          });
          this.entities.push(...filtered);
        } else {
          // Non-POI chunk — ambient resources as veins + occasional solo enemies
          this.spawnAmbient(chunkX, chunkY, difficulty, isNearPlayer || !spawnEnemies);
        }

        // Salvage (rare towable items) — only if level enables salvage
        const spawnSalvage = this.levelConfig?.features.salvage ?? true;
        if (spawnSalvage && Math.random() < SALVAGE_CHANCE_PER_CHUNK) {
          this.entities.push(
            createSalvage(
              chunkX + Math.random() * CHUNK_SIZE,
              chunkY + Math.random() * CHUNK_SIZE
            )
          );
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
      // Keep towed salvage regardless of distance
      if (e.type === 'salvage' && (e as Salvage).towedByPlayer) return true;
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
