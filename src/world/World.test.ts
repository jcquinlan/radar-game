import { describe, it, expect } from 'vitest';
import { World, getThreatLevel } from './World';
import { Enemy } from '../entities/Entity';

describe('World', () => {
  it('spawns entities when visiting new chunks', () => {
    const world = new World();
    expect(world.entities).toHaveLength(0);
    world.updateSpawning(0, 0);
    expect(world.entities.length).toBeGreaterThan(0);
  });

  it('does not re-spawn entities in already visited chunks', () => {
    const world = new World();
    world.updateSpawning(0, 0);
    const countAfterFirst = world.entities.length;
    world.updateSpawning(0, 0);
    expect(world.entities.length).toBe(countAfterFirst);
  });

  it('spawns new entities when moving to unexplored areas', () => {
    const world = new World();
    world.updateSpawning(0, 0);
    const countNearOrigin = world.entities.length;
    world.updateSpawning(5000, 5000);
    expect(world.entities.length).toBeGreaterThan(countNearOrigin);
  });

  it('cleans up inactive entities far from the player', () => {
    const world = new World();
    world.updateSpawning(0, 0);
    world.entities[0].active = false;
    const activeCount = world.entities.filter((e) => e.active).length;
    world.cleanup(0, 0);
    expect(world.entities.length).toBe(activeCount);
  });

  it('enemies spawned further from origin are stronger', () => {
    const world = new World();

    // Spawn near origin
    world.updateSpawning(0, 0);
    const nearEnemies = world.entities.filter(
      (e) => e.type === 'enemy'
    ) as Enemy[];

    // Spawn far away
    world.updateSpawning(5000, 5000);
    const farEnemies = world.entities.filter(
      (e) => e.type === 'enemy' && !nearEnemies.includes(e as Enemy)
    ) as Enemy[];

    if (nearEnemies.length > 0 && farEnemies.length > 0) {
      const avgNearHealth = nearEnemies.reduce((s, e) => s + e.maxHealth, 0) / nearEnemies.length;
      const avgFarHealth = farEnemies.reduce((s, e) => s + e.maxHealth, 0) / farEnemies.length;
      expect(avgFarHealth).toBeGreaterThan(avgNearHealth);
    }
  });
});

describe('getThreatLevel', () => {
  it('returns LOW at origin', () => {
    expect(getThreatLevel(0, 0).label).toBe('LOW');
  });

  it('returns higher threat levels at greater distances', () => {
    const nearThreat = getThreatLevel(0, 0).level;
    const farThreat = getThreatLevel(5000, 5000).level;
    expect(farThreat).toBeGreaterThan(nearThreat);
  });
});
