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

export interface Ally extends Entity {
  type: 'ally';
  healAmount: number;
  cooldown: number;
  lastHealTime: number;
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
  return {
    x,
    y,
    type: 'enemy',
    active: true,
    sweptThisRotation: false,
    health: 20 + Math.floor(Math.random() * 30),
    maxHealth: 50,
    damage: 5 + Math.floor(Math.random() * 5),
    speed: 40 + Math.random() * 40,
    chaseRange: 250,
    energyDrop: 10 + Math.floor(Math.random() * 15),
  };
}

export function createAlly(x: number, y: number): Ally {
  return {
    x,
    y,
    type: 'ally',
    active: true,
    sweptThisRotation: false,
    healAmount: 5 + Math.floor(Math.random() * 10),
    cooldown: 3, // seconds between heals
    lastHealTime: -Infinity,
  };
}
