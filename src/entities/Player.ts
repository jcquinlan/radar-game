export interface PlayerStats {
  maxHealth: number;
  speed: number;
}

export class Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  health: number;
  maxHealth: number;
  energy: number;
  speed: number;
  baseSpeed: number;
  armor: number;
  magnetRange: number;
  friction: number;
  heading: number;
  turnSpeed: number;
  turnVelocity: number;
  turnFriction: number;

  // Shield buff
  shieldActive: boolean;
  shieldReduction: number;
  shieldTimeRemaining: number;

  // Stats tracking
  score: number;
  kills: number;
  totalEnergyCollected: number;
  salvageDeposited: number;
  distanceTraveled: number;
  survivalTime: number;

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.friction = 5.0;
    this.heading = -Math.PI / 2; // Start facing up
    this.turnSpeed = 4.5; // Radians per second
    this.turnVelocity = 0;
    this.turnFriction = 6.0; // Snappy turning — minimal drift after releasing key
    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.energy = 0;
    this.baseSpeed = 115;
    this.speed = 115;
    this.armor = 0;
    this.magnetRange = 0;
    this.shieldActive = false;
    this.shieldReduction = 0;
    this.shieldTimeRemaining = 0;
    this.score = 0;
    this.kills = 0;
    this.totalEnergyCollected = 0;
    this.salvageDeposited = 0;
    this.distanceTraveled = 0;
    this.survivalTime = 0;
  }

  takeDamage(amount: number): void {
    let effectiveAmount = Math.max(0, amount - this.armor);
    if (this.shieldActive) {
      effectiveAmount *= (1 - this.shieldReduction);
    }
    this.health = Math.max(0, this.health - effectiveAmount);
  }

  applyShield(reduction: number, duration: number): void {
    this.shieldActive = true;
    this.shieldReduction = reduction;
    this.shieldTimeRemaining = duration;
  }

  updateShield(dt: number): void {
    if (this.shieldActive) {
      this.shieldTimeRemaining -= dt;
      if (this.shieldTimeRemaining <= 0) {
        this.shieldActive = false;
        this.shieldReduction = 0;
        this.shieldTimeRemaining = 0;
      }
    }
  }

  heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  addEnergy(amount: number): void {
    this.energy += amount;
  }

  spendEnergy(amount: number): boolean {
    if (this.energy < amount) return false;
    this.energy -= amount;
    return true;
  }

  isAlive(): boolean {
    return this.health > 0;
  }
}
