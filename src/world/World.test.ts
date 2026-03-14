import { describe, it, expect } from 'vitest';
import { World, getThreatLevel } from './World';
import { Enemy, createSalvage } from '../entities/Entity';

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

  it('preserves towed salvage during cleanup regardless of distance', () => {
    const world = new World();
    const towedSalvage = createSalvage(9999, 9999); // Far from player
    towedSalvage.towedByPlayer = true;
    world.entities.push(towedSalvage);

    world.cleanup(0, 0); // Player is at origin, salvage is very far

    expect(world.entities).toContain(towedSalvage);
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

  it('does not spawn enemies in the inner 3x3 safe zone', () => {
    // Run multiple times since spawning is probabilistic
    for (let trial = 0; trial < 10; trial++) {
      const world = new World();
      world.updateSpawning(0, 0);

      // Inner 3x3 chunks: chunk coords (-1,-1) to (1,1) → world coords (-400,-400) to (800,800)
      const safeMinX = -1 * 400;
      const safeMaxX = 2 * 400;
      const safeMinY = -1 * 400;
      const safeMaxY = 2 * 400;

      const enemiesInSafeZone = world.entities.filter(
        (e) =>
          e.type === 'enemy' &&
          e.x >= safeMinX && e.x <= safeMaxX &&
          e.y >= safeMinY && e.y <= safeMaxY
      );
      expect(enemiesInSafeZone).toHaveLength(0);
    }
  });

  it('spawns a mix of entity types across many chunks', () => {
    const world = new World();
    // Spawn far from origin to get POIs with enemies
    world.updateSpawning(3000, 3000);

    const resources = world.entities.filter((e) => e.type === 'resource');
    const enemies = world.entities.filter((e) => e.type === 'enemy');

    // Should have both resources and enemies in the world
    expect(resources.length).toBeGreaterThan(0);
    expect(enemies.length).toBeGreaterThan(0);
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
