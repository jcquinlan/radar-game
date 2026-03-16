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

/** Stats needed for objective evaluation — avoids coupling to the Player class */
export interface ObjectiveStats {
  totalEnergyCollected: number;
  kills: number;
  survivalTime: number;
  salvageDeposited: number;
}

export interface ObjectiveProgress {
  label: string;
  current: number;
  target: number;
  complete: boolean;
}

/** Returns the current value for an objective type given player stats */
export function getObjectiveValue(type: LevelObjective['type'], stats: ObjectiveStats): number {
  switch (type) {
    case 'collect_energy': return Math.floor(stats.totalEnergyCollected);
    case 'kill_enemies': return stats.kills;
    case 'survive_seconds': return Math.floor(stats.survivalTime);
    case 'deposit_salvage': return stats.salvageDeposited;
  }
}

/** Check if all objectives in a level are complete */
export function checkAllObjectivesComplete(objectives: LevelObjective[], stats: ObjectiveStats): boolean {
  if (objectives.length === 0) return false;
  return objectives.every(obj => getObjectiveValue(obj.type, stats) >= obj.target);
}

/** Get progress for each objective */
export function getObjectiveProgress(objectives: LevelObjective[], stats: ObjectiveStats): ObjectiveProgress[] {
  return objectives.map(obj => {
    const current = getObjectiveValue(obj.type, stats);
    return {
      label: obj.label,
      current,
      target: obj.target,
      complete: current >= obj.target,
    };
  });
}
