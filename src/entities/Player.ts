export interface PlayerStats {
  maxHealth: number;
  speed: number;
  sweepDamage: number;
}

export class Player {
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  energy: number;
  speed: number;
  sweepDamage: number;

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.energy = 0;
    this.speed = 200; // pixels per second
    this.sweepDamage = 10;
  }

  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
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
