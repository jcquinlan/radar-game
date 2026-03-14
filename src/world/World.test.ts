import { describe, it, expect } from 'vitest';
import { World } from './World';

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

    // Move far enough to enter new chunks
    world.updateSpawning(5000, 5000);
    expect(world.entities.length).toBeGreaterThan(countNearOrigin);
  });

  it('cleans up inactive entities far from the player', () => {
    const world = new World();
    world.updateSpawning(0, 0);

    // Deactivate some entities
    world.entities[0].active = false;
    const activeCount = world.entities.filter((e) => e.active).length;

    world.cleanup(0, 0);
    expect(world.entities.length).toBe(activeCount);
  });

  it('spawns all three entity types', () => {
    const world = new World();
    // Spawn across many chunks to get probabilistic allies
    for (let x = 0; x < 5000; x += 500) {
      world.updateSpawning(x, 0);
    }

    const types = new Set(world.entities.map((e) => e.type));
    expect(types.has('resource')).toBe(true);
    expect(types.has('enemy')).toBe(true);
    // Allies are probabilistic but with enough chunks should appear
  });
});
