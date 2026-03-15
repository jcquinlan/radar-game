export type EntityType = 'resource' | 'enemy' | 'ally' | 'salvage' | 'dropoff';

export interface Entity {
  x: number;
  y: number;
  type: EntityType;
  active: boolean;
  /** Whether this entity is currently visible on the radar (enemies start invisible) */
  visible: boolean;
  /** Whether this entity was already interacted with during the current ping wave */
  pingedThisWave: boolean;
}

export interface Resource extends Entity {
  type: 'resource';
  energyValue: number;
}

export type EnemySubtype = 'scout' | 'brute' | 'ranged';

export interface Enemy extends Entity {
  type: 'enemy';
  subtype: EnemySubtype;
  health: number;
  maxHealth: number;
  damage: number;
  speed: number;
  chaseRange: number;
  energyDrop: number;
  /** Ranged enemies: time between shots */
  fireRate: number;
  lastFireTime: number;
  projectileSpeed: number;
  /** Velocity for inertia-based movement */
  vx: number;
  vy: number;
  friction: number;
  /** Ghost marker position (last-known location when ping wore off) */
  ghostX: number | null;
  ghostY: number | null;
  /** Current wander direction (radians) */
  wanderAngle: number;
  /** Time until next wander direction change */
  wanderTimer: number;
}

export type AllySubtype = 'healer' | 'shield' | 'beacon';

export interface Ally extends Entity {
  type: 'ally';
  subtype: AllySubtype;
  healAmount: number;
  cooldown: number;
  lastHealTime: number;
  /** Shield: damage reduction multiplier (0-1), duration in seconds */
  shieldReduction: number;
  shieldDuration: number;
  /** Beacon: energy per second when player is in range */
  energyPerSecond: number;
  beaconRange: number;
}

export interface Salvage extends Entity {
  type: 'salvage';
  /** Whether this salvage is being towed behind the player */
  towedByPlayer: boolean;
  /** Tow physics velocity */
  towVx: number;
  towVy: number;
  /** Randomized rope rest length for this specific item */
  ropeLength: number;
}

export interface Dropoff extends Entity {
  type: 'dropoff';
  /** Radius of the dropoff zone — salvage entering this area is deposited */
  radius: number;
  /** Energy reward per salvage item deposited */
  rewardPerItem: number;
}

export interface HomeBase {
  x: number;
  y: number;
  /** Radius of the base boundary */
  radius: number;
  /** Maximum health of the base */
  maxHealth: number;
  /** Current health of the base */
  health: number;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  active: boolean;
  lifetime: number;
}

export type GameEntity = Resource | Enemy | Ally | Salvage | Dropoff;

export function createResource(x: number, y: number): Resource {
  return {
    x,
    y,
    type: 'resource',
    active: true,
    visible: true,
    pingedThisWave: false,
    energyValue: 5 + Math.floor(Math.random() * 10),
  };
}

export function createEnemy(x: number, y: number, subtype?: EnemySubtype): Enemy {
  const st = subtype ?? (['scout', 'scout', 'brute', 'ranged'][Math.floor(Math.random() * 4)] as EnemySubtype);

  const stats = {
    scout: { health: 15, damage: 3, speed: 90, chaseRange: 200, energyDrop: 5, fireRate: 0, projectileSpeed: 0, friction: 2.5 },
    brute: { health: 80, damage: 12, speed: 25, chaseRange: 180, energyDrop: 25, fireRate: 0, projectileSpeed: 0, friction: 1.2 },
    ranged: { health: 30, damage: 0, speed: 30, chaseRange: 300, energyDrop: 15, fireRate: 2.5, projectileSpeed: 120, friction: 1.8 },
  }[st];

  return {
    x,
    y,
    type: 'enemy',
    subtype: st,
    active: true,
    visible: false,
    pingedThisWave: false,
    health: stats.health,
    maxHealth: stats.health,
    damage: stats.damage,
    speed: stats.speed,
    chaseRange: stats.chaseRange,
    energyDrop: stats.energyDrop,
    fireRate: stats.fireRate,
    projectileSpeed: stats.projectileSpeed,
    lastFireTime: -Infinity,
    vx: 0,
    vy: 0,
    friction: stats.friction,
    ghostX: null,
    ghostY: null,
    wanderAngle: Math.random() * Math.PI * 2,
    wanderTimer: 1 + Math.random() * 2,
  };
}

export function createAlly(x: number, y: number, subtype?: AllySubtype): Ally {
  const st = subtype ?? (['healer', 'shield', 'beacon'][Math.floor(Math.random() * 3)] as AllySubtype);
  return {
    x,
    y,
    type: 'ally',
    subtype: st,
    active: true,
    visible: true,
    pingedThisWave: false,
    healAmount: st === 'healer' ? 8 + Math.floor(Math.random() * 8) : 0,
    cooldown: st === 'healer' ? 3 : st === 'shield' ? 8 : 0,
    lastHealTime: -Infinity,
    shieldReduction: st === 'shield' ? 0.5 : 0,
    shieldDuration: st === 'shield' ? 5 : 0,
    energyPerSecond: st === 'beacon' ? 2 : 0,
    beaconRange: st === 'beacon' ? 150 : 0,
  };
}

/** Min/max rope length for salvage items (randomized per item for visual spread) */
const SALVAGE_ROPE_MIN = 25;
const SALVAGE_ROPE_MAX = 55;

export function createSalvage(x: number, y: number): Salvage {
  return {
    x,
    y,
    type: 'salvage',
    active: true,
    visible: true,
    pingedThisWave: false,
    towedByPlayer: false,
    towVx: 0,
    towVy: 0,
    ropeLength: SALVAGE_ROPE_MIN + Math.random() * (SALVAGE_ROPE_MAX - SALVAGE_ROPE_MIN),
  };
}

export function createDropoff(x: number, y: number): Dropoff {
  return {
    x,
    y,
    type: 'dropoff',
    active: true,
    visible: true,
    pingedThisWave: false,
    radius: 60,
    rewardPerItem: 50,
  };
}

export function createHomeBase(x: number, y: number): HomeBase {
  return {
    x,
    y,
    radius: 150,
    maxHealth: 500,
    health: 500,
  };
}
