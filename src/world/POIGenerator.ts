import {
  GameEntity,
  Enemy,
  EnemySubtype,
  Resource,
  createResource,
  createEnemy,
  createAlly,
  createDropoff,
} from '../entities/Entity';

// ---------------------------------------------------------------------------
// POI type interface — add new POI types by adding objects to POI_TYPES
// ---------------------------------------------------------------------------

export interface POIType {
  /** Unique identifier for this POI type */
  id: string;
  /** Base probability weight (higher = more common) */
  baseWeight: number;
  /** Whether this POI gets a corridor weight boost */
  corridorBoost: boolean;
  /** Spawn entities for this POI centered at (cx, cy) with given difficulty */
  spawn: (cx: number, cy: number, difficulty: number) => GameEntity[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_SUBTYPES: EnemySubtype[] = ['scout', 'brute', 'ranged'];

/** Pick a random enemy subtype */
function randomSubtype(): EnemySubtype {
  return ALL_SUBTYPES[Math.floor(Math.random() * ALL_SUBTYPES.length)];
}

/**
 * Assign subtypes for a pack of `count` enemies.
 * Packs of 3+ get at least 2 distinct subtypes (primary + secondary).
 * Packs of 1-2 use a single subtype.
 */
function packSubtypes(count: number): EnemySubtype[] {
  const primary = randomSubtype();
  if (count <= 2) {
    return Array(count).fill(primary);
  }
  // Pick a secondary that differs from primary
  let secondary: EnemySubtype;
  do {
    secondary = randomSubtype();
  } while (secondary === primary);

  // First enemy gets secondary, rest get primary — guarantees at least 2 types
  const subtypes: EnemySubtype[] = [secondary];
  for (let i = 1; i < count; i++) {
    subtypes.push(primary);
  }
  return subtypes;
}

/** Scatter N points around a center within a radius */
function scatterAround(
  cx: number,
  cy: number,
  count: number,
  radius: number
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius;
    points.push({
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
    });
  }
  return points;
}

/** Place N points evenly around a ring at a given radius (with slight jitter) */
function ringAround(
  cx: number,
  cy: number,
  count: number,
  radius: number,
  jitter: number = 10
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const angleStep = (Math.PI * 2) / count;
  const startAngle = Math.random() * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const angle = startAngle + angleStep * i;
    const r = radius + (Math.random() - 0.5) * jitter * 2;
    points.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
    });
  }
  return points;
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Scale an enemy's stats by difficulty */
export function scaleEnemy(enemy: Enemy, difficulty: number): void {
  enemy.health = Math.floor(enemy.health * difficulty);
  enemy.maxHealth = enemy.health;
  enemy.damage = Math.floor(enemy.damage * difficulty);
  enemy.energyDrop = Math.floor(enemy.energyDrop * difficulty);
  enemy.speed = Math.floor(enemy.speed * (1 + (difficulty - 1) * 0.3));
}

// ---------------------------------------------------------------------------
// POI type definitions
// ---------------------------------------------------------------------------

const resourceCache: POIType = {
  id: 'resource_cache',
  baseWeight: 3,
  corridorBoost: true,
  spawn(cx, cy, difficulty) {
    const entities: GameEntity[] = [];

    // 8-12 clustered resources
    const resourceCount = randInt(8, 12);
    for (const pt of scatterAround(cx, cy, resourceCount, 60)) {
      entities.push(createResource(pt.x, pt.y));
    }

    // 2-3 enemy guards (mixed subtypes if 3+)
    const guardCount = randInt(2, 3);
    const guardTypes = packSubtypes(guardCount);
    const guardPositions = scatterAround(cx, cy, guardCount, 70);
    for (let i = 0; i < guardCount; i++) {
      const enemy = createEnemy(guardPositions[i].x, guardPositions[i].y, guardTypes[i]);
      scaleEnemy(enemy, difficulty);
      entities.push(enemy);
    }

    return entities;
  },
};

const allyOutpost: POIType = {
  id: 'ally_outpost',
  baseWeight: 2,
  corridorBoost: false,
  spawn(cx, cy) {
    const entities: GameEntity[] = [];

    // 1 ally near center
    const allyOffset = scatterAround(cx, cy, 1, 15)[0];
    entities.push(createAlly(allyOffset.x, allyOffset.y));

    // 3-4 resources in a ring
    const resourceCount = randInt(3, 4);
    for (const pt of ringAround(cx, cy, resourceCount, 80)) {
      entities.push(createResource(pt.x, pt.y));
    }

    return entities;
  },
};

const enemyCamp: POIType = {
  id: 'enemy_camp',
  baseWeight: 2,
  corridorBoost: true,
  spawn(cx, cy, difficulty) {
    const entities: GameEntity[] = [];

    // 3-5 enemies in tight formation (mixed subtypes)
    const enemyCount = randInt(3, 5);
    const subtypes = packSubtypes(enemyCount);
    const positions = scatterAround(cx, cy, enemyCount, 60);
    for (let i = 0; i < enemyCount; i++) {
      const enemy = createEnemy(positions[i].x, positions[i].y, subtypes[i]);
      scaleEnemy(enemy, difficulty);
      entities.push(enemy);
    }

    // 1 high-value resource at center (2x normal max energy)
    const reward = createResource(cx, cy);
    reward.energyValue = randInt(30, 50);
    entities.push(reward);

    return entities;
  },
};

const salvageDropoff: POIType = {
  id: 'salvage_dropoff',
  baseWeight: 1.5,
  corridorBoost: false,
  spawn(cx, cy) {
    const entities: GameEntity[] = [];

    // Dropoff point at center
    entities.push(createDropoff(cx, cy));

    // A few resources nearby as a lure
    const resourceCount = randInt(2, 3);
    for (const pt of ringAround(cx, cy, resourceCount, 90)) {
      entities.push(createResource(pt.x, pt.y));
    }

    return entities;
  },
};

const emptyZone: POIType = {
  id: 'empty_zone',
  baseWeight: 3,
  corridorBoost: false,
  spawn() {
    return [];
  },
};

// ---------------------------------------------------------------------------
// Registry — add new POI types here
// ---------------------------------------------------------------------------

export const POI_TYPES: POIType[] = [
  resourceCache,
  allyOutpost,
  enemyCamp,
  salvageDropoff,
  emptyZone,
];

// ---------------------------------------------------------------------------
// Corridor detection
// ---------------------------------------------------------------------------

/** Minimum distance from origin for corridor bonus to apply */
const CORRIDOR_MIN_DIST = 800;
/** Half-angle of corridor cone in radians (~15° each side = 30° total) */
const CORRIDOR_HALF_ANGLE = (15 * Math.PI) / 180;

/**
 * Check if a world position is on a "corridor" — within 15° of any
 * cardinal or diagonal axis radiating from the origin.
 * Positions too close to the origin are never on a corridor.
 */
export function isOnCorridor(x: number, y: number): boolean {
  const dist = Math.sqrt(x * x + y * y);
  if (dist < CORRIDOR_MIN_DIST) return false;

  const angle = Math.atan2(y, x); // -π to π

  // Check 8 axes: 0°, 45°, 90°, 135°, 180°, -135°, -90°, -45°
  for (let i = 0; i < 8; i++) {
    const axis = (i * Math.PI) / 4; // 0, π/4, π/2, ...
    // Normalize angular difference to [0, π]
    let diff = ((angle - axis) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff < CORRIDOR_HALF_ANGLE) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// POI selection
// ---------------------------------------------------------------------------

/** Base probability that any given chunk contains a POI */
const BASE_POI_CHANCE = 0.4;
/** Corridor multiplier for POI chance */
const CORRIDOR_POI_CHANCE_BOOST = 1.4;

/**
 * Decide whether a chunk gets a POI, and if so which one.
 * Returns null if the chunk should use ambient spawning instead.
 */
export function selectPOI(
  chunkCenterX: number,
  chunkCenterY: number
): POIType | null {
  const onCorridor = isOnCorridor(chunkCenterX, chunkCenterY);
  const poiChance = onCorridor
    ? BASE_POI_CHANCE * CORRIDOR_POI_CHANCE_BOOST
    : BASE_POI_CHANCE;

  if (Math.random() > poiChance) return null;

  // Build weighted list with corridor boost applied
  const weights = POI_TYPES.map((poi) => ({
    poi,
    weight: poi.baseWeight * (onCorridor && poi.corridorBoost ? 2 : 1),
  }));

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const { poi, weight } of weights) {
    roll -= weight;
    if (roll <= 0) return poi;
  }

  return weights[weights.length - 1].poi;
}

// ---------------------------------------------------------------------------
// Resource vein spawning (used by World.ts for non-POI chunks)
// ---------------------------------------------------------------------------

/**
 * Spawn a cluster of 3-5 resources within 40px of a center point.
 */
export function spawnResourceVein(cx: number, cy: number): Resource[] {
  const count = randInt(5, 8);
  return scatterAround(cx, cy, count, 40).map((pt) =>
    createResource(pt.x, pt.y)
  );
}
