/**
 * Procedural mesh generators for all game entity types.
 * Each function returns a Mesh compatible with Renderer3D.uploadMesh().
 * All meshes are low-poly (under 200 verts) and accept a color param for theme tinting.
 *
 * Generate meshes once at init time — never in the hot loop.
 */

import type { Mesh } from './Renderer3D';
import { vec3, Vec3 } from './math3d';

// ─── Seeded PRNG ────────────────────────────────────────────────────────

/** Simple seeded pseudo-random number generator (mulberry32) */
function seededRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Mesh building helpers ──────────────────────────────────────────────

type Color3 = [number, number, number];

/** Compute flat-shading normal for a triangle and push it for all 3 verts */
function pushFlatTriangle(
  positions: number[],
  normals: number[],
  colors: number[],
  indices: number[],
  v0: Vec3,
  v1: Vec3,
  v2: Vec3,
  color: Color3,
): void {
  const baseIndex = positions.length / 3;
  const edge1 = vec3.subtract(v1, v0);
  const edge2 = vec3.subtract(v2, v0);
  const n = vec3.normalize(vec3.cross(edge1, edge2));

  positions.push(v0[0], v0[1], v0[2]);
  positions.push(v1[0], v1[1], v1[2]);
  positions.push(v2[0], v2[1], v2[2]);

  normals.push(n[0], n[1], n[2]);
  normals.push(n[0], n[1], n[2]);
  normals.push(n[0], n[1], n[2]);

  colors.push(color[0], color[1], color[2]);
  colors.push(color[0], color[1], color[2]);
  colors.push(color[0], color[1], color[2]);

  indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
}

/** Push a quad as two triangles (flat shaded) */
function pushFlatQuad(
  positions: number[],
  normals: number[],
  colors: number[],
  indices: number[],
  v0: Vec3,
  v1: Vec3,
  v2: Vec3,
  v3: Vec3,
  color: Color3,
): void {
  pushFlatTriangle(positions, normals, colors, indices, v0, v1, v2, color);
  pushFlatTriangle(positions, normals, colors, indices, v0, v2, v3, color);
}

function buildMesh(positions: number[], normals: number[], colors: number[], indices: number[]): Mesh {
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    indices: new Uint16Array(indices),
  };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function varyColor(base: Color3, amount: number, rng: () => number): Color3 {
  return [
    clamp01(base[0] + (rng() - 0.5) * amount),
    clamp01(base[1] + (rng() - 0.5) * amount),
    clamp01(base[2] + (rng() - 0.5) * amount),
  ];
}

// ─── Asteroid mesh ──────────────────────────────────────────────────────

/**
 * Generate an irregular rocky shape by subdividing an icosahedron and
 * displacing vertices with seeded noise.
 * small: 1 subdivision (~20 faces), medium: 2 subdivisions (~80 faces), large: 2 subdivisions with more displacement
 */
export function createAsteroidMesh(
  size: 'small' | 'medium' | 'large',
  seed: number,
  color: Color3 = [0.55, 0.45, 0.35],
): Mesh {
  const rng = seededRng(seed);

  // Base icosahedron vertices
  const t = (1 + Math.sqrt(5)) / 2;
  const icoVerts: Vec3[] = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map(v => vec3.normalize(v as Vec3));

  const icoFaces: [number, number, number][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  // Small: base icosahedron (20 faces, 60 verts flat-shaded)
  // Medium/Large: same topology, differentiated by scale and displacement
  const subdivisions = 0;
  let verts = [...icoVerts];
  let faces = [...icoFaces];

  const midpointCache = new Map<string, number>();
  function getMidpoint(a: number, b: number): number {
    const key = Math.min(a, b) + '_' + Math.max(a, b);
    const cached = midpointCache.get(key);
    if (cached !== undefined) return cached;
    const mid = vec3.normalize(vec3.scale(vec3.add(verts[a], verts[b]), 0.5));
    const idx = verts.length;
    verts.push(mid);
    midpointCache.set(key, idx);
    return idx;
  }

  for (let s = 0; s < subdivisions; s++) {
    const newFaces: [number, number, number][] = [];
    midpointCache.clear();
    for (const [a, b, c] of faces) {
      const ab = getMidpoint(a, b);
      const bc = getMidpoint(b, c);
      const ca = getMidpoint(c, a);
      newFaces.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = newFaces;
  }

  // Scale and displace
  const scaleMap = { small: 8, medium: 14, large: 22 };
  const displaceMap = { small: 0.3, medium: 0.25, large: 0.35 };
  const baseScale = scaleMap[size];
  const displaceAmount = displaceMap[size];

  const displaced: Vec3[] = verts.map(v => {
    const displace = 1 + (rng() - 0.5) * displaceAmount * 2;
    return vec3.scale(v, baseScale * displace);
  });

  // Build flat-shaded triangles
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (const [a, b, c] of faces) {
    const faceColor = varyColor(color, 0.15, rng);
    pushFlatTriangle(positions, normals, colors, indices,
      displaced[a], displaced[b], displaced[c], faceColor);
  }

  return buildMesh(positions, normals, colors, indices);
}

// ─── Player ship mesh ───────────────────────────────────────────────────

/**
 * Wedge/arrow shape — extruded triangle prism with pointed nose.
 * ~10 triangles.
 */
export function createPlayerMesh(color: Color3 = [0.2, 0.85, 0.7]): Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // Wedge: pointed front (+Z), wide back, slight height
  const nose: Vec3 = [0, 1, 12];
  const backL: Vec3 = [-7, 0, -8];
  const backR: Vec3 = [7, 0, -8];
  const topBack: Vec3 = [0, 3, -5];
  const botL: Vec3 = [-5, -1, -6];
  const botR: Vec3 = [5, -1, -6];

  // Top face
  const topColor: Color3 = [color[0] * 0.9, color[1] * 0.9, color[2] * 0.9];
  pushFlatTriangle(positions, normals, colors, indices, nose, backR, topBack, topColor);
  pushFlatTriangle(positions, normals, colors, indices, nose, topBack, backL, topColor);

  // Bottom face
  const botColor: Color3 = [color[0] * 0.6, color[1] * 0.6, color[2] * 0.6];
  pushFlatTriangle(positions, normals, colors, indices, nose, botL, botR, botColor);

  // Left side
  const sideColor: Color3 = [color[0] * 0.75, color[1] * 0.75, color[2] * 0.75];
  pushFlatTriangle(positions, normals, colors, indices, nose, backL, botL, sideColor);

  // Right side
  pushFlatTriangle(positions, normals, colors, indices, nose, botR, backR, sideColor);

  // Back face
  pushFlatQuad(positions, normals, colors, indices, backL, topBack, backR, botR, color);
  pushFlatTriangle(positions, normals, colors, indices, backL, botR, botL, color);

  return buildMesh(positions, normals, colors, indices);
}

// ─── Enemy scout mesh ───────────────────────────────────────────────────

/**
 * Small pointed triangular prism — fast and pointy.
 */
export function createScoutMesh(color: Color3 = [0.9, 0.2, 0.2]): Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // Elongated triangular prism pointing +Z
  const h = 2; // half height
  const nose: Vec3 = [0, 0, 10];
  const topL: Vec3 = [-4, h, -6];
  const topR: Vec3 = [4, h, -6];
  const botL: Vec3 = [-4, -h, -6];
  const botR: Vec3 = [4, -h, -6];

  const dark: Color3 = [color[0] * 0.7, color[1] * 0.7, color[2] * 0.7];

  // Top
  pushFlatTriangle(positions, normals, colors, indices, nose, topR, topL, color);
  // Bottom
  pushFlatTriangle(positions, normals, colors, indices, nose, botL, botR, dark);
  // Left
  pushFlatTriangle(positions, normals, colors, indices, nose, topL, botL, dark);
  // Right
  pushFlatTriangle(positions, normals, colors, indices, nose, botR, topR, dark);
  // Back
  pushFlatQuad(positions, normals, colors, indices, topL, topR, botR, botL, color);

  return buildMesh(positions, normals, colors, indices);
}

// ─── Enemy brute mesh ───────────────────────────────────────────────────

/**
 * Chunky box shape — slow tank.
 */
export function createBruteMesh(color: Color3 = [0.6, 0.1, 0.1]): Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const sx = 8, sy = 6, sz = 10;

  // 8 corners
  const ftl: Vec3 = [-sx, sy, sz];
  const ftr: Vec3 = [sx, sy, sz];
  const fbl: Vec3 = [-sx, -sy, sz];
  const fbr: Vec3 = [sx, -sy, sz];
  const btl: Vec3 = [-sx, sy, -sz];
  const btr: Vec3 = [sx, sy, -sz];
  const bbl: Vec3 = [-sx, -sy, -sz];
  const bbr: Vec3 = [sx, -sy, -sz];

  const top: Color3 = [color[0] * 1.0, color[1] * 1.0, color[2] * 1.0];
  const side: Color3 = [color[0] * 0.8, color[1] * 0.8, color[2] * 0.8];
  const bot: Color3 = [color[0] * 0.5, color[1] * 0.5, color[2] * 0.5];

  // Front (+Z)
  pushFlatQuad(positions, normals, colors, indices, fbl, fbr, ftr, ftl, side);
  // Back (-Z)
  pushFlatQuad(positions, normals, colors, indices, bbr, bbl, btl, btr, side);
  // Top (+Y)
  pushFlatQuad(positions, normals, colors, indices, ftl, ftr, btr, btl, top);
  // Bottom (-Y)
  pushFlatQuad(positions, normals, colors, indices, bbl, bbr, fbr, fbl, bot);
  // Right (+X)
  pushFlatQuad(positions, normals, colors, indices, fbr, bbr, btr, ftr, side);
  // Left (-X)
  pushFlatQuad(positions, normals, colors, indices, bbl, fbl, ftl, btl, side);

  return buildMesh(positions, normals, colors, indices);
}

// ─── Enemy ranged mesh ──────────────────────────────────────────────────

/**
 * Octahedron (diamond shape).
 */
export function createRangedMesh(color: Color3 = [0.9, 0.5, 0.2]): Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const s = 7;
  const top: Vec3 = [0, s * 1.3, 0];
  const bot: Vec3 = [0, -s * 1.3, 0];
  const front: Vec3 = [0, 0, s];
  const back: Vec3 = [0, 0, -s];
  const left: Vec3 = [-s, 0, 0];
  const right: Vec3 = [s, 0, 0];

  const light: Color3 = color;
  const dark: Color3 = [color[0] * 0.7, color[1] * 0.7, color[2] * 0.7];

  // Upper 4 faces
  pushFlatTriangle(positions, normals, colors, indices, top, front, right, light);
  pushFlatTriangle(positions, normals, colors, indices, top, right, back, light);
  pushFlatTriangle(positions, normals, colors, indices, top, back, left, dark);
  pushFlatTriangle(positions, normals, colors, indices, top, left, front, dark);
  // Lower 4 faces
  pushFlatTriangle(positions, normals, colors, indices, bot, right, front, dark);
  pushFlatTriangle(positions, normals, colors, indices, bot, back, right, dark);
  pushFlatTriangle(positions, normals, colors, indices, bot, left, back, light);
  pushFlatTriangle(positions, normals, colors, indices, bot, front, left, light);

  return buildMesh(positions, normals, colors, indices);
}

// ─── Enemy boss mesh ────────────────────────────────────────────────────

/**
 * Large hexagonal prism.
 */
export function createBossMesh(color: Color3 = [0.7, 0.2, 0.8]): Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const r = 18;
  const h = 8;

  // Generate hex vertices (top and bottom rings)
  const topRing: Vec3[] = [];
  const botRing: Vec3[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    topRing.push([x, h, z]);
    botRing.push([x, -h, z]);
  }

  const topCenter: Vec3 = [0, h, 0];
  const botCenter: Vec3 = [0, -h, 0];

  const topColor: Color3 = color;
  const sideColor: Color3 = [color[0] * 0.75, color[1] * 0.75, color[2] * 0.75];
  const botColor: Color3 = [color[0] * 0.5, color[1] * 0.5, color[2] * 0.5];

  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    // Top face triangle
    pushFlatTriangle(positions, normals, colors, indices,
      topCenter, topRing[i], topRing[next], topColor);
    // Bottom face triangle
    pushFlatTriangle(positions, normals, colors, indices,
      botCenter, botRing[next], botRing[i], botColor);
    // Side quad
    pushFlatQuad(positions, normals, colors, indices,
      botRing[i], botRing[next], topRing[next], topRing[i], sideColor);
  }

  return buildMesh(positions, normals, colors, indices);
}

// ─── Mining bot mesh ────────────────────────────────────────────────────

/**
 * Small icosahedron (sphere-like).
 */
export function createMiningBotMesh(color: Color3 = [0.2, 0.8, 0.9]): Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const t = (1 + Math.sqrt(5)) / 2;
  const s = 4; // scale
  const verts: Vec3[] = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map(v => vec3.scale(vec3.normalize(v as Vec3), s));

  const faces: [number, number, number][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  const light: Color3 = color;
  const dark: Color3 = [color[0] * 0.8, color[1] * 0.8, color[2] * 0.8];

  for (let i = 0; i < faces.length; i++) {
    const [a, b, c] = faces[i];
    const c3 = i % 2 === 0 ? light : dark;
    pushFlatTriangle(positions, normals, colors, indices, verts[a], verts[b], verts[c], c3);
  }

  return buildMesh(positions, normals, colors, indices);
}

// ─── Combat bot mesh ────────────────────────────────────────────────────

/**
 * Chevron/arrow shape — small and aggressive.
 */
export function createCombatBotMesh(color: Color3 = [0.3, 0.5, 0.9]): Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // Chevron shape pointing +Z
  const h = 1.5;
  const nose: Vec3 = [0, 0, 7];
  const wingL: Vec3 = [-6, 0, -4];
  const wingR: Vec3 = [6, 0, -4];
  const notch: Vec3 = [0, 0, -1];
  const topN: Vec3 = [0, h, 0];

  const topC: Color3 = color;
  const sideC: Color3 = [color[0] * 0.7, color[1] * 0.7, color[2] * 0.7];

  // Top surfaces
  pushFlatTriangle(positions, normals, colors, indices, nose, notch, wingL, topC);
  pushFlatTriangle(positions, normals, colors, indices, nose, wingR, notch, topC);
  // Raised center spine
  pushFlatTriangle(positions, normals, colors, indices, nose, wingL, topN, sideC);
  pushFlatTriangle(positions, normals, colors, indices, nose, topN, wingR, sideC);
  // Bottom
  pushFlatTriangle(positions, normals, colors, indices, topN, wingL, notch, sideC);
  pushFlatTriangle(positions, normals, colors, indices, topN, notch, wingR, sideC);

  return buildMesh(positions, normals, colors, indices);
}

// ─── Salvage mesh ───────────────────────────────────────────────────────

/**
 * Small octahedron (diamond) — amber/gold.
 */
export function createSalvageMesh(color: Color3 = [0.9, 0.7, 0.2]): Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const s = 5;
  const top: Vec3 = [0, s * 1.5, 0];
  const bot: Vec3 = [0, -s * 1.5, 0];
  const front: Vec3 = [0, 0, s];
  const back: Vec3 = [0, 0, -s];
  const left: Vec3 = [-s, 0, 0];
  const right: Vec3 = [s, 0, 0];

  const light: Color3 = color;
  const dark: Color3 = [color[0] * 0.75, color[1] * 0.75, color[2] * 0.75];

  // Upper 4 faces
  pushFlatTriangle(positions, normals, colors, indices, top, front, right, light);
  pushFlatTriangle(positions, normals, colors, indices, top, right, back, light);
  pushFlatTriangle(positions, normals, colors, indices, top, back, left, dark);
  pushFlatTriangle(positions, normals, colors, indices, top, left, front, dark);
  // Lower 4 faces
  pushFlatTriangle(positions, normals, colors, indices, bot, right, front, dark);
  pushFlatTriangle(positions, normals, colors, indices, bot, back, right, dark);
  pushFlatTriangle(positions, normals, colors, indices, bot, left, back, light);
  pushFlatTriangle(positions, normals, colors, indices, bot, front, left, light);

  return buildMesh(positions, normals, colors, indices);
}

// ─── Home base mesh ─────────────────────────────────────────────────────

/**
 * Hexagonal platform with slight height.
 */
export function createHomeBaseMesh(color: Color3 = [0.2, 0.6, 0.9]): Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const r = 25;
  const h = 3;

  const topRing: Vec3[] = [];
  const botRing: Vec3[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    topRing.push([x, h, z]);
    botRing.push([x, -h, z]);
  }

  const topCenter: Vec3 = [0, h, 0];
  const botCenter: Vec3 = [0, -h, 0];

  const topColor: Color3 = color;
  const sideColor: Color3 = [color[0] * 0.6, color[1] * 0.6, color[2] * 0.6];
  const botColor: Color3 = [color[0] * 0.3, color[1] * 0.3, color[2] * 0.3];

  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    // Top
    pushFlatTriangle(positions, normals, colors, indices,
      topCenter, topRing[i], topRing[next], topColor);
    // Bottom
    pushFlatTriangle(positions, normals, colors, indices,
      botCenter, botRing[next], botRing[i], botColor);
    // Side
    pushFlatQuad(positions, normals, colors, indices,
      botRing[i], botRing[next], topRing[next], topRing[i], sideColor);
  }

  return buildMesh(positions, normals, colors, indices);
}

// ─── Projectile mesh ────────────────────────────────────────────────────

/**
 * Tiny elongated diamond (4 triangles).
 */
export function createProjectileMesh(color: Color3 = [1.0, 0.6, 0.2]): Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const front: Vec3 = [0, 0, 4];
  const back: Vec3 = [0, 0, -2];
  const top: Vec3 = [0, 1.5, 0];
  const bot: Vec3 = [0, -1.5, 0];
  const left: Vec3 = [-1.5, 0, 0];
  const right: Vec3 = [1.5, 0, 0];

  const light: Color3 = color;
  const dark: Color3 = [color[0] * 0.7, color[1] * 0.7, color[2] * 0.7];

  // Front 4 faces
  pushFlatTriangle(positions, normals, colors, indices, front, top, right, light);
  pushFlatTriangle(positions, normals, colors, indices, front, right, bot, light);
  pushFlatTriangle(positions, normals, colors, indices, front, bot, left, dark);
  pushFlatTriangle(positions, normals, colors, indices, front, left, top, dark);
  // Back 4 faces
  pushFlatTriangle(positions, normals, colors, indices, back, right, top, dark);
  pushFlatTriangle(positions, normals, colors, indices, back, bot, right, dark);
  pushFlatTriangle(positions, normals, colors, indices, back, left, bot, light);
  pushFlatTriangle(positions, normals, colors, indices, back, top, left, light);

  return buildMesh(positions, normals, colors, indices);
}
