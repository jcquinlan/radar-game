import { describe, it, expect } from 'vitest';
import {
  checkAllObjectivesComplete,
  getObjectiveProgress,
  getObjectiveValue,
  ObjectiveStats,
  LevelObjective,
} from './LevelConfig';

function makeStats(overrides: Partial<ObjectiveStats> = {}): ObjectiveStats {
  return {
    totalEnergyCollected: 0,
    kills: 0,
    survivalTime: 0,
    salvageDeposited: 0,
    ...overrides,
  };
}

describe('getObjectiveValue', () => {
  it('returns floored energy for collect_energy', () => {
    expect(getObjectiveValue('collect_energy', makeStats({ totalEnergyCollected: 49.9 }))).toBe(49);
  });

  it('returns kills for kill_enemies', () => {
    expect(getObjectiveValue('kill_enemies', makeStats({ kills: 7 }))).toBe(7);
  });

  it('returns floored time for survive_seconds', () => {
    expect(getObjectiveValue('survive_seconds', makeStats({ survivalTime: 30.8 }))).toBe(30);
  });

  it('returns salvageDeposited for deposit_salvage', () => {
    expect(getObjectiveValue('deposit_salvage', makeStats({ salvageDeposited: 3 }))).toBe(3);
  });
});

describe('checkAllObjectivesComplete', () => {
  it('returns false for empty objectives (endless mode)', () => {
    expect(checkAllObjectivesComplete([], makeStats())).toBe(false);
  });

  it('returns true when single objective is met', () => {
    const objectives: LevelObjective[] = [
      { type: 'collect_energy', target: 50, label: 'Collect 50 energy' },
    ];
    expect(checkAllObjectivesComplete(objectives, makeStats({ totalEnergyCollected: 50 }))).toBe(true);
  });

  it('returns false when single objective is not met', () => {
    const objectives: LevelObjective[] = [
      { type: 'collect_energy', target: 50, label: 'Collect 50 energy' },
    ];
    expect(checkAllObjectivesComplete(objectives, makeStats({ totalEnergyCollected: 49 }))).toBe(false);
  });

  it('requires all objectives to be met', () => {
    const objectives: LevelObjective[] = [
      { type: 'kill_enemies', target: 5, label: 'Kill 5' },
      { type: 'survive_seconds', target: 60, label: 'Survive 60s' },
    ];

    // Only kills met
    expect(checkAllObjectivesComplete(objectives, makeStats({ kills: 5, survivalTime: 30 }))).toBe(false);

    // Only survival met
    expect(checkAllObjectivesComplete(objectives, makeStats({ kills: 3, survivalTime: 60 }))).toBe(false);

    // Both met
    expect(checkAllObjectivesComplete(objectives, makeStats({ kills: 5, survivalTime: 60 }))).toBe(true);
  });

  it('handles deposit_salvage objective', () => {
    const objectives: LevelObjective[] = [
      { type: 'deposit_salvage', target: 3, label: 'Deposit 3 salvage' },
    ];
    expect(checkAllObjectivesComplete(objectives, makeStats({ salvageDeposited: 2 }))).toBe(false);
    expect(checkAllObjectivesComplete(objectives, makeStats({ salvageDeposited: 3 }))).toBe(true);
  });
});

describe('getObjectiveProgress', () => {
  it('returns progress for each objective', () => {
    const objectives: LevelObjective[] = [
      { type: 'collect_energy', target: 50, label: 'Collect 50 energy' },
      { type: 'kill_enemies', target: 5, label: 'Kill 5 enemies' },
    ];
    const stats = makeStats({ totalEnergyCollected: 60, kills: 3 });
    const progress = getObjectiveProgress(objectives, stats);

    expect(progress).toEqual([
      { label: 'Collect 50 energy', current: 60, target: 50, complete: true },
      { label: 'Kill 5 enemies', current: 3, target: 5, complete: false },
    ]);
  });

  it('returns empty array for no objectives', () => {
    expect(getObjectiveProgress([], makeStats())).toEqual([]);
  });

  it('includes deposit_salvage progress', () => {
    const objectives: LevelObjective[] = [
      { type: 'deposit_salvage', target: 2, label: 'Deposit 2' },
    ];
    const progress = getObjectiveProgress(objectives, makeStats({ salvageDeposited: 1 }));
    expect(progress).toEqual([
      { label: 'Deposit 2', current: 1, target: 2, complete: false },
    ]);
  });
});
