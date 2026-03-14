import { describe, it, expect } from 'vitest';
import { World, getThreatLevel } from './World';
import { Enemy, Resource } from '../entities/Entity';

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

  it('spawns resources in clusters rather than uniformly', () => {
    const world = new World();
    world.updateSpawning(0, 0);

    const resources = world.entities.filter((e) => e.type === 'resource') as Resource[];
    if (resources.length < 6) return; // Not enough to test clustering

    // Check that resources tend to be near other resources (clustered)
    // For each resource, find its nearest neighbor
    const nearestDistances: number[] = [];
    for (const r of resources) {
      let minDist = Infinity;
      for (const other of resources) {
        if (r === other) continue;
        const d = Math.sqrt((r.x - other.x) ** 2 + (r.y - other.y) ** 2);
        if (d < minDist) minDist = d;
      }
      nearestDistances.push(minDist);
    }

    // Average nearest-neighbor distance should be small (< 50px) because of vein clustering
    const avgNearestDist = nearestDistances.reduce((a, b) => a + b, 0) / nearestDistances.length;
    expect(avgNearestDist).toBeLessThan(50);
  });

  it('enemies in POI packs share the same subtype', () => {
    // Spawn far from origin (more POIs with enemies) over many trials
    let foundPack = false;
    for (let trial = 0; trial < 20 && !foundPack; trial++) {
      const world = new World();
      world.updateSpawning(3000, 3000);

      const enemies = world.entities.filter((e) => e.type === 'enemy') as Enemy[];
      if (enemies.length < 2) continue;

      // Find clusters: enemies within 100px of each other
      for (let i = 0; i < enemies.length; i++) {
        const cluster = [enemies[i]];
        for (let j = i + 1; j < enemies.length; j++) {
          const d = Math.sqrt((enemies[i].x - enemies[j].x) ** 2 + (enemies[i].y - enemies[j].y) ** 2);
          if (d < 100) cluster.push(enemies[j]);
        }
        if (cluster.length >= 2) {
          // All enemies in this cluster should share a subtype
          const subtypes = new Set(cluster.map((e) => e.subtype));
          expect(subtypes.size).toBe(1);
          foundPack = true;
          break;
        }
      }
    }
    // We should have found at least one pack across 20 trials
    expect(foundPack).toBe(true);
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
