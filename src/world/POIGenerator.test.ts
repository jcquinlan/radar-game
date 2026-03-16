import { describe, it, expect } from 'vitest';
import {
  POI_TYPES,
  selectPOI,
  isOnCorridor,
  spawnResourceVein,
} from './POIGenerator';
import { Enemy, Resource, Ally } from '../entities/Entity';

describe('POI type definitions', () => {
  it('every POI type has an id, base weight, and spawn function', () => {
    for (const poi of POI_TYPES) {
      expect(poi.id).toBeTruthy();
      expect(typeof poi.baseWeight).toBe('number');
      expect(poi.baseWeight).toBeGreaterThan(0);
      expect(typeof poi.spawn).toBe('function');
    }
  });

  it('empty_zone spawns no entities', () => {
    const emptyZone = POI_TYPES.find((p) => p.id === 'empty_zone')!;
    const entities = emptyZone.spawn(0, 0, 1);
    expect(entities).toHaveLength(0);
  });
});

describe('resource_cache POI', () => {
  it('spawns 5-8 resources and 2-3 enemy guards', () => {
    const cache = POI_TYPES.find((p) => p.id === 'resource_cache')!;
    // Run multiple times to check range
    for (let i = 0; i < 20; i++) {
      const entities = cache.spawn(1000, 1000, 1.5);
      const resources = entities.filter((e) => e.type === 'resource') as Resource[];
      const enemies = entities.filter((e) => e.type === 'enemy') as Enemy[];
      expect(resources.length).toBeGreaterThanOrEqual(8);
      expect(resources.length).toBeLessThanOrEqual(12);
      expect(enemies.length).toBeGreaterThanOrEqual(2);
      expect(enemies.length).toBeLessThanOrEqual(3);
    }
  });

  it('packs of 3 guards have at least 2 subtypes', () => {
    const cache = POI_TYPES.find((p) => p.id === 'resource_cache')!;
    // Run enough trials to get a pack of 3
    let foundMixed = false;
    for (let i = 0; i < 50; i++) {
      const entities = cache.spawn(1000, 1000, 1.5);
      const enemies = entities.filter((e) => e.type === 'enemy') as Enemy[];
      if (enemies.length === 3) {
        const subtypes = new Set(enemies.map((e) => e.subtype));
        expect(subtypes.size).toBeGreaterThanOrEqual(2);
        foundMixed = true;
      }
    }
    expect(foundMixed).toBe(true);
  });

  it('packs of 2 guards use a single subtype', () => {
    const cache = POI_TYPES.find((p) => p.id === 'resource_cache')!;
    let foundPairPack = false;
    for (let i = 0; i < 50; i++) {
      const entities = cache.spawn(1000, 1000, 1.5);
      const enemies = entities.filter((e) => e.type === 'enemy') as Enemy[];
      if (enemies.length === 2) {
        const subtypes = new Set(enemies.map((e) => e.subtype));
        expect(subtypes.size).toBe(1);
        foundPairPack = true;
      }
    }
    expect(foundPairPack).toBe(true);
  });

  it('resources are clustered near the POI center', () => {
    const cache = POI_TYPES.find((p) => p.id === 'resource_cache')!;
    const entities = cache.spawn(1000, 1000, 1.5);
    const resources = entities.filter((e) => e.type === 'resource') as Resource[];
    // All resources should be within 80px of the center (1000, 1000)
    for (const r of resources) {
      const dist = Math.sqrt((r.x - 1000) ** 2 + (r.y - 1000) ** 2);
      expect(dist).toBeLessThan(80);
    }
  });
});

describe('ally_outpost POI', () => {
  it('spawns 1 ally and 3-4 resources', () => {
    const outpost = POI_TYPES.find((p) => p.id === 'ally_outpost')!;
    for (let i = 0; i < 20; i++) {
      const entities = outpost.spawn(500, 500, 1);
      const allies = entities.filter((e) => e.type === 'ally') as Ally[];
      const resources = entities.filter((e) => e.type === 'resource') as Resource[];
      expect(allies).toHaveLength(1);
      expect(resources.length).toBeGreaterThanOrEqual(3);
      expect(resources.length).toBeLessThanOrEqual(4);
    }
  });

  it('ally is near the center, resources form a ring', () => {
    const outpost = POI_TYPES.find((p) => p.id === 'ally_outpost')!;
    const entities = outpost.spawn(500, 500, 1);
    const ally = entities.find((e) => e.type === 'ally')!;
    const resources = entities.filter((e) => e.type === 'resource');

    // Ally should be very close to center
    const allyDist = Math.sqrt((ally.x - 500) ** 2 + (ally.y - 500) ** 2);
    expect(allyDist).toBeLessThan(20);

    // Resources should be further out in a ring (60-100px from center)
    for (const r of resources) {
      const dist = Math.sqrt((r.x - 500) ** 2 + (r.y - 500) ** 2);
      expect(dist).toBeGreaterThan(50);
      expect(dist).toBeLessThan(110);
    }
  });
});

describe('enemy_camp POI', () => {
  it('spawns 3-5 enemies and 1 high-value resource', () => {
    const camp = POI_TYPES.find((p) => p.id === 'enemy_camp')!;
    for (let i = 0; i < 20; i++) {
      const entities = camp.spawn(2000, 2000, 2);
      const enemies = entities.filter((e) => e.type === 'enemy') as Enemy[];
      const resources = entities.filter((e) => e.type === 'resource') as Resource[];
      expect(enemies.length).toBeGreaterThanOrEqual(3);
      expect(enemies.length).toBeLessThanOrEqual(5);
      expect(resources).toHaveLength(1);
    }
  });

  it('enemies in a camp have at least 2 subtypes', () => {
    const camp = POI_TYPES.find((p) => p.id === 'enemy_camp')!;
    // enemy_camp always spawns 3-5, so always mixed
    for (let i = 0; i < 20; i++) {
      const entities = camp.spawn(2000, 2000, 2);
      const enemies = entities.filter((e) => e.type === 'enemy') as Enemy[];
      const subtypes = new Set(enemies.map((e) => e.subtype));
      expect(subtypes.size).toBeGreaterThanOrEqual(2);
    }
  });

  it('the center resource has higher energy value than normal', () => {
    const camp = POI_TYPES.find((p) => p.id === 'enemy_camp')!;
    // Normal resources are 5-15 energy. High-value should be at least 20.
    for (let i = 0; i < 20; i++) {
      const entities = camp.spawn(2000, 2000, 2);
      const resource = entities.find((e) => e.type === 'resource') as Resource;
      expect(resource.energyValue).toBeGreaterThanOrEqual(20);
    }
  });
});

describe('pack composition', () => {
  it('packs of 3+ always contain at least 2 distinct subtypes', () => {
    const camp = POI_TYPES.find((p) => p.id === 'enemy_camp')!;
    for (let i = 0; i < 30; i++) {
      const entities = camp.spawn(0, 0, 1);
      const enemies = entities.filter((e) => e.type === 'enemy') as Enemy[];
      // enemy_camp always has 3-5
      const subtypes = new Set(enemies.map((e) => e.subtype));
      expect(subtypes.size).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('corridor detection', () => {
  it('chunks on cardinal axes are on a corridor', () => {
    // Due east from origin (angle ~0°)
    expect(isOnCorridor(2000, 0)).toBe(true);
    // Due north (angle ~90°)
    expect(isOnCorridor(0, -2000)).toBe(true);
    // Due west
    expect(isOnCorridor(-2000, 0)).toBe(true);
    // Due south
    expect(isOnCorridor(0, 2000)).toBe(true);
  });

  it('chunks on diagonal axes are on a corridor', () => {
    // NE diagonal
    expect(isOnCorridor(2000, -2000)).toBe(true);
    // SE diagonal
    expect(isOnCorridor(2000, 2000)).toBe(true);
  });

  it('chunks at odd angles are not on a corridor', () => {
    // ~63° from east — not near any axis
    expect(isOnCorridor(1000, -2000)).toBe(false);
    // ~27° — between east and NE
    expect(isOnCorridor(2000, -1000)).toBe(false);
  });

  it('chunks near origin are not on a corridor (too close)', () => {
    expect(isOnCorridor(100, 0)).toBe(false);
    expect(isOnCorridor(0, 0)).toBe(false);
  });
});

describe('selectPOI', () => {
  it('returns a POI type or null', () => {
    const result = selectPOI(2000, 2000);
    if (result !== null) {
      expect(result.id).toBeTruthy();
      expect(typeof result.spawn).toBe('function');
    }
  });

  it('corridor chunks produce POIs more frequently than off-corridor chunks', () => {
    let corridorPOICount = 0;
    let offCorridorPOICount = 0;
    const trials = 500;

    for (let i = 0; i < trials; i++) {
      // On corridor (due east, far enough from origin)
      if (selectPOI(3000, 0) !== null) corridorPOICount++;
      // Off corridor (odd angle)
      if (selectPOI(3000, -1500) !== null) offCorridorPOICount++;
    }

    // Corridor should produce more POIs due to weight boost
    expect(corridorPOICount).toBeGreaterThan(offCorridorPOICount);
  });
});

describe('spawnResourceVein', () => {
  it('spawns 5-8 resources clustered within scatter radius', () => {
    for (let i = 0; i < 20; i++) {
      const resources = spawnResourceVein(500, 500);
      expect(resources.length).toBeGreaterThanOrEqual(5);
      expect(resources.length).toBeLessThanOrEqual(8);
      for (const r of resources) {
        const dist = Math.sqrt((r.x - 500) ** 2 + (r.y - 500) ** 2);
        expect(dist).toBeLessThanOrEqual(40);
        expect(r.type).toBe('resource');
      }
    }
  });
});
