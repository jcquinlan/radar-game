import { Player } from '../entities/Player';
import { Asteroid, Enemy, GameEntity } from '../entities/Entity';

export type FloatingTextCallback = (text: string, x: number, y: number, color: string) => void;

export const enum MiningBotState {
  Deploying = 0,
  Mining = 1,
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
  /** BotSlotSystem slot index assigned to this bot (-1 if unassigned) */
  slotIndex: number;
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

// Mining duration (seconds)
const MINING_DURATION = 30;

// Aggro
const AGGRO_CHECK_INTERVAL = 5;
const AGGRO_CHANCE = 0.3;
const AGGRO_RANGE_SQ = 400 * 400;

// Floating text
const ENERGY_TEXT_INTERVAL = 2;

// Deploy range — max distance from click to asteroid (default, overridden by upgrades)
const DEFAULT_DEPLOY_RANGE = 100;

// Launch spread — missile-style punchy launch
const LAUNCH_SPEED = 60;
const CLOSE_SPREAD = Math.PI * (30 / 180);   // ±30° half-spread at close range
const FAR_SPREAD = Math.PI * 1.2 * 0.5;      // ±108° half-spread at far range
const CLOSE_DIST = 80;
const FAR_DIST = 250;

export class MiningBotSystem {
  private bots: MiningBot[] = [];
  /** Multiplier applied to mining rate — increased by mining speed upgrade */
  miningRateMultiplier = 1;
  /** Max deploy distance from click to asteroid — increased by mining range upgrade */
  deployRange = DEFAULT_DEPLOY_RANGE;
  /** Callback invoked with slot index when a bot becomes inactive */
  onSlotRelease: ((slotIndex: number) => void) | null = null;
  /** Screen shake callback — wired up by main.ts */
  onShake: (intensity: number) => void = () => {};

  constructor() {
    // No pre-allocation — bots are added dynamically via deployBot
  }

  /**
   * Try to deploy a mining bot near the given world coordinates.
   * Finds the nearest active asteroid within deployRange of the click.
   * Caller must have already acquired a slot from BotSlotSystem.
   * Returns true if deployment succeeded (asteroid found within range).
   */
  deployBot(worldX: number, worldY: number, entities: GameEntity[], player: Player, slotIndex: number): boolean {
    // Find nearest asteroid within range
    let nearest: Asteroid | null = null;
    let nearestDistSq = this.deployRange * this.deployRange;

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

    // Compute missile-style launch angle with distance-scaled spread
    const dx = nearest.x - player.x;
    const dy = nearest.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const directAngle = Math.atan2(dy, dx);
    const spreadT = Math.min(1, Math.max(0, (dist - CLOSE_DIST) / (FAR_DIST - CLOSE_DIST)));
    const halfSpread = CLOSE_SPREAD + (FAR_SPREAD - CLOSE_SPREAD) * spreadT;
    const launchAngle = directAngle + (Math.random() - 0.5) * 2 * halfSpread;

    // Create and activate the bot
    const bot: MiningBot = {
      x: player.x,
      y: player.y,
      vx: Math.cos(launchAngle) * LAUNCH_SPEED,
      vy: Math.sin(launchAngle) * LAUNCH_SPEED,
      angle: 0,
      targetAsteroid: nearest,
      state: MiningBotState.Deploying,
      miningProgress: 0,
      miningRate: (nearest.energyValue / MINING_DURATION) * this.miningRateMultiplier,
      lifetime: 0,
      active: true,
      aggroTimer: AGGRO_CHECK_INTERVAL,
      energyAccum: 0,
      energyTextTimer: 0,
      slotIndex,
    };

    this.bots.push(bot);
    this.onShake(5);

    return true;
  }

  update(
    dt: number,
    player: Player,
    entities: GameEntity[],
    addFloatingText: FloatingTextCallback,
  ): void {
    for (let i = this.bots.length - 1; i >= 0; i--) {
      const bot = this.bots[i];
      if (!bot.active) continue;

      switch (bot.state) {
        case MiningBotState.Deploying:
          this.updateDeploying(bot, dt);
          break;
        case MiningBotState.Mining:
          this.updateMining(bot, dt, player, entities, addFloatingText);
          break;
      }

      // Apply friction and move
      const decay = Math.exp(-BOT_FRICTION * dt);
      bot.vx *= decay;
      bot.vy *= decay;
      bot.x += bot.vx * dt;
      bot.y += bot.vy * dt;

      // If bot became inactive this frame, release slot and remove from array
      if (!bot.active) {
        if (this.onSlotRelease && bot.slotIndex >= 0) {
          this.onSlotRelease(bot.slotIndex);
        }
        this.bots.splice(i, 1);
      }
    }
  }

  private updateDeploying(bot: MiningBot, dt: number): void {
    const target = bot.targetAsteroid;
    if (!target || !target.active) {
      // Target gone — deactivate in place
      bot.active = false;
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
      // Asteroid gone — deactivate in place
      bot.active = false;
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
      bot.active = false;
      bot.targetAsteroid = null;
      return;
    }

    // Check mining duration complete
    if (bot.miningProgress >= 1) {
      target.miningActive = false;
      bot.active = false;
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

  /** Get all active bots — used for rendering */
  getBots(): readonly MiningBot[] {
    return this.bots;
  }

  /** Number of currently deployed (active) bots */
  getActiveCount(): number {
    return this.bots.length;
  }

  /** Reset all bots — releases slots and clears array */
  reset(): void {
    if (this.onSlotRelease) {
      for (let i = 0; i < this.bots.length; i++) {
        const bot = this.bots[i];
        if (bot.slotIndex >= 0) {
          this.onSlotRelease(bot.slotIndex);
        }
      }
    }
    this.bots.length = 0;
  }
}
