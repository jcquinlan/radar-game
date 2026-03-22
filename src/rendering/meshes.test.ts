import { describe, it, expect } from 'vitest';
import {
  createAsteroidMesh,
  createPlayerMesh,
  createScoutMesh,
  createBruteMesh,
  createRangedMesh,
  createBossMesh,
  createMiningBotMesh,
  createCombatBotMesh,
  createSalvageMesh,
  createHomeBaseMesh,
  createProjectileMesh,
} from './meshes';
import type { Mesh } from './Renderer3D';

/** Validate that a mesh has structurally valid geometry */
function validateMesh(mesh: Mesh, label: string) {
  const vertexCount = mesh.positions.length / 3;

  // Typed arrays of correct types
  expect(mesh.positions).toBeInstanceOf(Float32Array);
  expect(mesh.normals).toBeInstanceOf(Float32Array);
  expect(mesh.colors).toBeInstanceOf(Float32Array);
  expect(mesh.indices).toBeInstanceOf(Uint16Array);

  // Consistent vertex count across all attribute arrays
  expect(mesh.normals.length).toBe(mesh.positions.length);
  expect(mesh.colors.length).toBe(mesh.positions.length);

  // Under 200 vertices
  expect(vertexCount).toBeLessThan(200);

  // At least one triangle
  expect(mesh.indices.length).toBeGreaterThanOrEqual(3);
  expect(mesh.indices.length % 3).toBe(0);

  // All indices within bounds
  for (let i = 0; i < mesh.indices.length; i++) {
    expect(mesh.indices[i]).toBeLessThan(vertexCount);
  }

  // All normals are approximately unit vectors
  for (let i = 0; i < mesh.normals.length; i += 3) {
    const nx = mesh.normals[i];
    const ny = mesh.normals[i + 1];
    const nz = mesh.normals[i + 2];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    expect(len).toBeCloseTo(1.0, 1);
  }

  // Colors are in valid range [0, 1]
  for (let i = 0; i < mesh.colors.length; i++) {
    expect(mesh.colors[i]).toBeGreaterThanOrEqual(0);
    expect(mesh.colors[i]).toBeLessThanOrEqual(1);
  }
}

describe('createAsteroidMesh', () => {
  it('generates valid geometry for small asteroids', () => {
    const mesh = createAsteroidMesh('small', 42);
    validateMesh(mesh, 'asteroid-small');
  });

  it('generates valid geometry for medium asteroids', () => {
    const mesh = createAsteroidMesh('medium', 42);
    validateMesh(mesh, 'asteroid-medium');
  });

  it('generates valid geometry for large asteroids', () => {
    const mesh = createAsteroidMesh('large', 42);
    validateMesh(mesh, 'asteroid-large');
  });

  it('produces spatially larger meshes for larger sizes', () => {
    const small = createAsteroidMesh('small', 1);
    const medium = createAsteroidMesh('medium', 1);
    const large = createAsteroidMesh('large', 1);
    // Measure max extent from origin
    function maxExtent(mesh: Mesh): number {
      let max = 0;
      for (let i = 0; i < mesh.positions.length; i += 3) {
        const x = mesh.positions[i], y = mesh.positions[i+1], z = mesh.positions[i+2];
        const d = Math.sqrt(x*x + y*y + z*z);
        if (d > max) max = d;
      }
      return max;
    }
    expect(maxExtent(medium)).toBeGreaterThan(maxExtent(small));
    expect(maxExtent(large)).toBeGreaterThan(maxExtent(medium));
  });

  it('produces different geometry for different seeds', () => {
    const a = createAsteroidMesh('medium', 1);
    const b = createAsteroidMesh('medium', 999);
    // Positions should differ due to vertex displacement
    let same = true;
    for (let i = 0; i < a.positions.length; i++) {
      if (Math.abs(a.positions[i] - b.positions[i]) > 0.001) { same = false; break; }
    }
    expect(same).toBe(false);
  });

  it('accepts a custom color parameter', () => {
    const mesh = createAsteroidMesh('small', 1, [1, 0, 0]);
    // Colors should be close to red (with some variation)
    const avgR = mesh.colors.filter((_, i) => i % 3 === 0).reduce((s, v) => s + v, 0) / (mesh.colors.length / 3);
    expect(avgR).toBeGreaterThan(0.5);
  });
});

describe('createPlayerMesh', () => {
  it('generates valid geometry', () => {
    validateMesh(createPlayerMesh(), 'player');
  });

  it('accepts a custom color', () => {
    const mesh = createPlayerMesh([1, 0, 0]);
    validateMesh(mesh, 'player-red');
  });
});

describe('createScoutMesh', () => {
  it('generates valid geometry', () => {
    validateMesh(createScoutMesh(), 'scout');
  });
});

describe('createBruteMesh', () => {
  it('generates valid geometry', () => {
    validateMesh(createBruteMesh(), 'brute');
  });
});

describe('createRangedMesh', () => {
  it('generates valid geometry', () => {
    validateMesh(createRangedMesh(), 'ranged');
  });
});

describe('createBossMesh', () => {
  it('generates valid geometry', () => {
    validateMesh(createBossMesh(), 'boss');
  });
});

describe('createMiningBotMesh', () => {
  it('generates valid geometry', () => {
    validateMesh(createMiningBotMesh(), 'mining-bot');
  });
});

describe('createCombatBotMesh', () => {
  it('generates valid geometry', () => {
    validateMesh(createCombatBotMesh(), 'combat-bot');
  });
});

describe('createSalvageMesh', () => {
  it('generates valid geometry', () => {
    validateMesh(createSalvageMesh(), 'salvage');
  });
});

describe('createHomeBaseMesh', () => {
  it('generates valid geometry', () => {
    validateMesh(createHomeBaseMesh(), 'home-base');
  });
});

describe('createProjectileMesh', () => {
  it('generates valid geometry', () => {
    validateMesh(createProjectileMesh(), 'projectile');
  });
});
