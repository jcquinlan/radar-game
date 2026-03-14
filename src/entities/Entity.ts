export type EntityType = 'resource' | 'enemy' | 'ally';

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
  /** Whether this resource is being towed behind the player */
  towedByPlayer?: boolean;
  /** Tow physics velocity */
  towVx?: number;
  towVy?: number;
  /** Position in the tow chain (0 = closest to player) */
  towChainIndex?: number;
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

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  active: boolean;
  lifetime: number;
}

export type GameEntity = Resource | Enemy | Ally;

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
