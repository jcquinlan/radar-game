import { Player } from '../entities/Player';
import { Asteroid, Enemy, GameEntity } from '../entities/Entity';

export type FloatingTextCallback = (text: string, x: number, y: number, color: string) => void;

export const enum MiningBotState {
  Deploying = 0,
  Mining = 1,
  Returning = 2,
}

export interface MiningBot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  targetAsteroid: Asteroid | null;
  state: MiningBotState;
  miningProgress: number;
  miningRate: number;
  lifetime: number;
  active: boolean;
  /** Timer for enemy aggro checks (counts down from 5s) */
  aggroTimer: number;
  /** Accumulated energy for batched floating text */
  energyAccum: number;
  energyTextTimer: number;
}

// Movement
const BOT_SPEED = 120;
const BOT_FRICTION = 3.0;
const BOT_ACCEL = BOT_SPEED * BOT_FRICTION;

// Orbit
const ORBIT_RADIUS = 30;
const ORBIT_ANGULAR_SPEED = 2.5;

// Arrival threshold — close enough to start orbiting
const ARRIVAL_THRESHOLD_SQ = 45 * 45;

// Return despawn threshold
const DESPAWN_THRESHOLD_SQ = 30 * 30;

// Mining duration (seconds)
const MINING_DURATION = 30;

// Aggro
const AGGRO_CHECK_INTERVAL = 5;
const AGGRO_CHANCE = 0.3;
const AGGRO_RANGE_SQ = 400 * 400;

// Floating text
const ENERGY_TEXT_INTERVAL = 2;

// Deploy range — max distance from click to asteroid
const DEPLOY_RANGE_SQ = 100 * 100;

export class MiningBotSystem {
  private bots: MiningBot[];
  maxBots: number;

  constructor(maxBots = 3) {
    this.maxBots = maxBots;
    // Pre-allocate bot slots
    this.bots = [];
    for (let i = 0; i < maxBots; i++) {
      this.bots.push(this.createInactiveBot());
    }
  }

  private createInactiveBot(): MiningBot {
    return {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      targetAsteroid: null,
      state: MiningBotState.Deploying,
      miningProgress: 0,
      miningRate: 0,
      lifetime: 0,
      active: false,
      aggroTimer: AGGRO_CHECK_INTERVAL,
      energyAccum: 0,
      energyTextTimer: 0,
    };
  }

  /**
   * Try to deploy a mining bot near the given world coordinates.
   * Finds the nearest active asteroid within 100px of the click.
   * Returns true if deployment succeeded.
   */
  deployBot(worldX: number, worldY: number, entities: GameEntity[], player: Player): boolean {
    // Check for available charge
    const slot = this.findInactiveSlot();
    if (!slot) return false;

    // Find nearest asteroid within range
    let nearest: Asteroid | null = null;
    let nearestDistSq = DEPLOY_RANGE_SQ;

    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!e.active || e.type !== 'asteroid') continue;
      const asteroid = e as Asteroid;
      const dx = asteroid.x - worldX;
      const dy = asteroid.y - worldY;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = asteroid;
      }
    }

    if (!nearest) return false;

    // Activate the bot
    slot.x = player.x;
    slot.y = player.y;
    slot.vx = 0;
    slot.vy = 0;
    slot.angle = 0;
    slot.targetAsteroid = nearest;
    slot.state = MiningBotState.Deploying;
    slot.miningProgress = 0;
    slot.miningRate = nearest.energyValue / MINING_DURATION;
    slot.lifetime = 0;
    slot.active = true;
    slot.aggroTimer = AGGRO_CHECK_INTERVAL;
    slot.energyAccum = 0;
    slot.energyTextTimer = 0;

    return true;
  }

  update(
    dt: number,
    player: Player,
    entities: GameEntity[],
    addFloatingText: FloatingTextCallback,
  ): void {
    for (let i = 0; i < this.bots.length; i++) {
      const bot = this.bots[i];
      if (!bot.active) continue;

      switch (bot.state) {
        case MiningBotState.Deploying:
          this.updateDeploying(bot, dt);
          break;
        case MiningBotState.Mining:
          this.updateMining(bot, dt, player, entities, addFloatingText);
          break;
        case MiningBotState.Returning:
          this.updateReturning(bot, dt, player);
          break;
      }

      // Apply friction and move
      const decay = Math.exp(-BOT_FRICTION * dt);
      bot.vx *= decay;
      bot.vy *= decay;
      bot.x += bot.vx * dt;
      bot.y += bot.vy * dt;
    }
  }

  private updateDeploying(bot: MiningBot, dt: number): void {
    const target = bot.targetAsteroid;
    if (!target || !target.active) {
      // Target gone, return
      bot.state = MiningBotState.Returning;
      bot.targetAsteroid = null;
      return;
    }

    const dx = target.x - bot.x;
    const dy = target.y - bot.y;
    const distSq = dx * dx + dy * dy;

    if (distSq < ARRIVAL_THRESHOLD_SQ) {
      // Arrived — start mining
      bot.state = MiningBotState.Mining;
      bot.angle = Math.atan2(bot.y - target.y, bot.x - target.x);
      target.miningActive = true;
      return;
    }

    // Steer toward asteroid
    const dist = Math.sqrt(distSq);
    if (dist > 0) {
      bot.vx += (dx / dist) * BOT_ACCEL * dt;
      bot.vy += (dy / dist) * BOT_ACCEL * dt;
    }
  }

  private updateMining(
    bot: MiningBot,
    dt: number,
    player: Player,
    entities: GameEntity[],
    addFloatingText: FloatingTextCallback,
  ): void {
    const target = bot.targetAsteroid;
    if (!target || !target.active) {
      // Asteroid gone
      bot.state = MiningBotState.Returning;
      bot.targetAsteroid = null;
      return;
    }

    // Orbit the asteroid
    bot.angle += ORBIT_ANGULAR_SPEED * dt;
    const targetX = target.x + Math.cos(bot.angle) * ORBIT_RADIUS;
    const targetY = target.y + Math.sin(bot.angle) * ORBIT_RADIUS;

    const dx = targetX - bot.x;
    const dy = targetY - bot.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1) {
      const steerStrength = Math.min(dist / ORBIT_RADIUS, 2.0);
      bot.vx += (dx / dist) * BOT_ACCEL * steerStrength * dt;
      bot.vy += (dy / dist) * BOT_ACCEL * steerStrength * dt;
    }

    // Extract energy
    const energyThisFrame = bot.miningRate * dt;
    const hpDrain = (target.maxHp / MINING_DURATION) * dt;

    target.hp -= hpDrain;
    bot.miningProgress += dt / MINING_DURATION;
    player.addEnergy(energyThisFrame);
    player.totalEnergyCollected += energyThisFrame;

    // Batched floating text
    bot.energyAccum += energyThisFrame;
    bot.energyTextTimer -= dt;
    if (bot.energyTextTimer <= 0) {
      const shown = Math.round(bot.energyAccum);
      if (shown > 0) {
        addFloatingText(`+${shown}E`, target.x, target.y - 20, '#ffaa00');
      }
      bot.energyAccum = 0;
      bot.energyTextTimer = ENERGY_TEXT_INTERVAL;
    }

    bot.lifetime += dt;

    // Check asteroid depletion
    if (target.hp <= 0) {
      target.hp = 0;
      target.active = false;
      target.miningActive = false;
      bot.state = MiningBotState.Returning;
      bot.targetAsteroid = null;
      return;
    }

    // Check mining duration complete
    if (bot.miningProgress >= 1) {
      target.miningActive = false;
      bot.state = MiningBotState.Returning;
      bot.targetAsteroid = null;
      return;
    }

    // Enemy aggro check
    bot.aggroTimer -= dt;
    if (bot.aggroTimer <= 0) {
      bot.aggroTimer = AGGRO_CHECK_INTERVAL;
      if (Math.random() < AGGRO_CHANCE) {
        this.aggroNearestEnemy(target.x, target.y, entities);
      }
    }
  }

  private updateReturning(bot: MiningBot, dt: number, player: Player): void {
    const dx = player.x - bot.x;
    const dy = player.y - bot.y;
    const distSq = dx * dx + dy * dy;

    if (distSq < DESPAWN_THRESHOLD_SQ) {
      // Close enough — despawn and restore charge
      bot.active = false;
      bot.targetAsteroid = null;
      return;
    }

    // Steer toward player
    const dist = Math.sqrt(distSq);
    if (dist > 0) {
      bot.vx += (dx / dist) * BOT_ACCEL * dt;
      bot.vy += (dy / dist) * BOT_ACCEL * dt;
    }
  }

  private aggroNearestEnemy(fromX: number, fromY: number, entities: GameEntity[]): void {
    let nearest: Enemy | null = null;
    let nearestDistSq = AGGRO_RANGE_SQ;

    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!e.active || e.type !== 'enemy') continue;
      const enemy = e as Enemy;
      const dx = enemy.x - fromX;
      const dy = enemy.y - fromY;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = enemy;
      }
    }

    if (nearest) {
      nearest.aggro = true;
    }
  }

  private findInactiveSlot(): MiningBot | null {
    for (let i = 0; i < this.bots.length; i++) {
      if (!this.bots[i].active) return this.bots[i];
    }
    return null;
  }

  /** Get all bot slots (including inactive) — used for rendering */
  getBots(): readonly MiningBot[] {
    return this.bots;
  }

  /** Number of currently deployed (active) bots */
  getActiveCount(): number {
    let count = 0;
    for (let i = 0; i < this.bots.length; i++) {
      if (this.bots[i].active) count++;
    }
    return count;
  }

  /** Number of available charges (maxBots - active) */
  getAvailableCharges(): number {
    return this.maxBots - this.getActiveCount();
  }

  /** Reset all bots to inactive state */
  reset(): void {
    for (let i = 0; i < this.bots.length; i++) {
      const bot = this.bots[i];
      bot.active = false;
      bot.targetAsteroid = null;
      bot.state = MiningBotState.Deploying;
      bot.miningProgress = 0;
      bot.lifetime = 0;
      bot.vx = 0;
      bot.vy = 0;
      bot.aggroTimer = AGGRO_CHECK_INTERVAL;
      bot.energyAccum = 0;
      bot.energyTextTimer = 0;
    }
  }
}
