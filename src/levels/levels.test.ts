import { describe, it, expect } from 'vitest';
import { LEVELS } from './levels';
import { LevelConfig } from './LevelConfig';

describe('Level definitions', () => {
  it('defines at least 3 levels', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(3);
  });

  it('each level has required fields', () => {
    for (const level of LEVELS) {
      expect(level.id).toBeTruthy();
      expect(level.name).toBeTruthy();
      expect(level.description).toBeTruthy();
      expect(level.features).toBeDefined();
      expect(level.world).toBeDefined();
      expect(level.objectives).toBeDefined();
      expect(level.hints).toBeDefined();
    }
  });

  it('tutorial-movement disables combat and has collect_energy objective', () => {
    const level = LEVELS.find(l => l.id === 'tutorial-movement')!;
    expect(level).toBeDefined();
    expect(level.features.combat).toBe(false);
    expect(level.features.upgrades).toBe(false);
    expect(level.features.abilities).toBe(false);
    expect(level.objectives.length).toBeGreaterThan(0);
    expect(level.objectives[0].type).toBe('collect_energy');
  });

  it('tutorial-combat enables combat and has kill_enemies objective', () => {
    const level = LEVELS.find(l => l.id === 'tutorial-combat')!;
    expect(level).toBeDefined();
    expect(level.features.combat).toBe(true);
    expect(level.objectives.length).toBeGreaterThan(0);
    expect(level.objectives[0].type).toBe('kill_enemies');
  });

  it('full-game enables all features and has no objectives', () => {
    const level = LEVELS.find(l => l.id === 'full-game')!;
    expect(level).toBeDefined();
    expect(level.features.combat).toBe(true);
    expect(level.features.upgrades).toBe(true);
    expect(level.features.abilities).toBe(true);
    expect(level.features.salvage).toBe(true);
    expect(level.features.towRope).toBe(true);
    expect(level.objectives).toEqual([]);
  });

  it('tutorial levels constrain the world', () => {
    const tutorials = LEVELS.filter(l => l.id.startsWith('tutorial'));
    for (const level of tutorials) {
      expect(level.world.maxChunks).not.toBeNull();
    }
  });

  it('full-game has unlimited world', () => {
    const level = LEVELS.find(l => l.id === 'full-game')!;
    expect(level.world.maxChunks).toBeNull();
    expect(level.world.difficultyMultiplier).toBeNull();
  });
});
