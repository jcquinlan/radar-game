export type EntityType = 'resource' | 'enemy' | 'ally';

export interface Entity {
  x: number;
  y: number;
  type: EntityType;
  active: boolean;
  /** Whether this entity was already interacted with during the current sweep rotation */
  sweptThisRotation: boolean;
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
    sweptThisRotation: false,
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
    sweptThisRotation: false,
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
    sweptThisRotation: false,
    healAmount: st === 'healer' ? 8 + Math.floor(Math.random() * 8) : 0,
    cooldown: st === 'healer' ? 3 : st === 'shield' ? 8 : 0,
    lastHealTime: -Infinity,
    shieldReduction: st === 'shield' ? 0.5 : 0,
    shieldDuration: st === 'shield' ? 5 : 0,
    energyPerSecond: st === 'beacon' ? 2 : 0,
    beaconRange: st === 'beacon' ? 150 : 0,
  };
}
