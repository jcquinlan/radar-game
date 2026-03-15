export interface LevelObjective {
  type: 'collect_energy' | 'kill_enemies' | 'survive_seconds' | 'deposit_salvage';
  target: number;
  label: string;
}

export interface LevelConfig {
  id: string;
  name: string;
  description: string;

  /** Which game systems are active during this level */
  features: {
    combat: boolean;
    upgrades: boolean;
    abilities: boolean;
    salvage: boolean;
    towRope: boolean;
  };

  /** World generation constraints */
  world: {
    /** Max chunks that can be loaded (null = unlimited) */
    maxChunks: number | null;
    /** Difficulty multiplier override (null = use default distance-based) */
    difficultyMultiplier: number | null;
    /** Whether enemies spawn */
    spawnEnemies: boolean;
    /** Whether allies spawn */
    spawnAllies: boolean;
  };

  /** Objectives to complete this level (empty = endless/no completion) */
  objectives: LevelObjective[];

  /** Tutorial hint lines shown on screen */
  hints: string[];

  /** Player stat overrides applied at level start */
  playerOverrides?: {
    health?: number;
    maxHealth?: number;
    speed?: number;
    energy?: number;
  };
}
