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

export interface Enemy extends Entity {
  type: 'enemy';
  health: number;
  maxHealth: number;
  damage: number;
  speed: number;
  chaseRange: number;
  energyDrop: number;
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

export function createEnemy(x: number, y: number): Enemy {
  const health = 20 + Math.floor(Math.random() * 30);
  return {
    x,
    y,
    type: 'enemy',
    active: true,
    sweptThisRotation: false,
    health,
    maxHealth: health,
    damage: 5 + Math.floor(Math.random() * 5),
    speed: 40 + Math.random() * 40,
    chaseRange: 250,
    energyDrop: 10 + Math.floor(Math.random() * 15),
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
