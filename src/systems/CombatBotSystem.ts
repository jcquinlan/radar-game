import { Enemy, GameEntity, Projectile } from '../entities/Entity';
import { Player } from '../entities/Player';
import { getTheme } from '../themes/theme';

type FloatingTextCallback = (text: string, x: number, y: number, color: string) => void;
type DeathCallback = (x: number, y: number, sourceX: number, sourceY: number, color: string) => void;

export const enum CombatBotState {
  FlyingToTarget = 0,
  SeekingEnemy = 1,
  ChasingEnemy = 2,
  OrbitingEnemy = 3,
}

export interface CombatBot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  state: CombatBotState;
  targetEnemy: Enemy | null;
  /** World position the bot was sent to (click location) */
  targetX: number;
  targetY: number;
  health: number;
  maxHealth: number;
  damage: number;
  fireRate: number;
  fireTimer: number;
  range: number;
  lifetime: number;
  maxLifetime: number;
  active: boolean;
  /** BotSlotSystem slot index assigned to this bot (-1 if unassigned) */
  slotIndex: number;
}

// Combat bot stats
const BOT_HEALTH = 30;
const BOT_DAMAGE = 4;
const BOT_RANGE = 200;
const BOT_FIRE_RATE = 1.5;
const BOT_LIFETIME = 20;

// Movement — inertia model
const BOT_SPEED = 140;
const BOT_FRICTION = 2.5;
const BOT_ACCEL = BOT_SPEED * BOT_FRICTION;

// Orbit
const ENEMY_ORBIT_RADIUS = 50;
const ORBIT_ARRIVAL_THRESHOLD = 15;
const ORBIT_ANGULAR_SPEED = 2.4;

// Arrival at click target
const TARGET_ARRIVAL_RADIUS = 30;
const TARGET_ARRIVAL_RADIUS_SQ = TARGET_ARRIVAL_RADIUS * TARGET_ARRIVAL_RADIUS;

// Detection range for auto-aggro
const DETECTION_RANGE = 250;
const DETECTION_RANGE_SQ = DETECTION_RANGE * DETECTION_RANGE;

// Projectile config
const PROJECTILE_SPEED = 180;
const PROJECTILE_LIFETIME = 2;
const PROJECTILE_HIT_RANGE = 15;
const PROJECTILE_HIT_RANGE_SQ = PROJECTILE_HIT_RANGE * PROJECTILE_HIT_RANGE;
const MAX_PROJECTILES = 16;

// Contact damage
const CONTACT_RANGE = 25;
const CONTACT_RANGE_SQ = CONTACT_RANGE * CONTACT_RANGE;

// Launch spread — missile-style punchy launch
const LAUNCH_SPEED = 60;
const CLOSE_SPREAD = Math.PI * (30 / 180);   // ±30° half-spread at close range
const FAR_SPREAD = Math.PI * 1.2 * 0.5;      // ±108° half-spread at far range
const CLOSE_DIST = 80;
const FAR_DIST = 250;

export class CombatBotSystem {
  bots: CombatBot[] = [];
  botProjectiles: Projectile[] = [];
  /** Base damage per bot — increased by combat damage upgrade */
  baseDamage = BOT_DAMAGE;
  /** Base lifetime per bot — increased by combat lifetime upgrade */
  baseLifetime = BOT_LIFETIME;
  /** Callback invoked with slot index when a bot becomes inactive */
  onSlotRelease: ((slotIndex: number) => void) | null = null;
  /** Screen shake callback — wired up by main.ts */
  onShake: (intensity: number) => void = () => {};

  constructor() {
    // Pre-allocate projectile pool
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      this.botProjectiles.push({
        x: 0, y: 0, vx: 0, vy: 0,
        damage: 0, active: false, lifetime: 0,
      });
    }
  }

  /**
   * Deploy a combat bot from the player's position toward a target world position.
   * Caller must have already acquired a slot from BotSlotSystem.
   */
  deployBot(targetX: number, targetY: number, player: Player, slotIndex: number): void {
    // Compute missile-style launch angle with distance-scaled spread
    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const directAngle = Math.atan2(dy, dx);
    const spreadT = Math.min(1, Math.max(0, (dist - CLOSE_DIST) / (FAR_DIST - CLOSE_DIST)));
    const halfSpread = CLOSE_SPREAD + (FAR_SPREAD - CLOSE_SPREAD) * spreadT;
    const launchAngle = directAngle + (Math.random() - 0.5) * 2 * halfSpread;

    const bot: CombatBot = {
      x: player.x,
      y: player.y,
      vx: Math.cos(launchAngle) * LAUNCH_SPEED,
      vy: Math.sin(launchAngle) * LAUNCH_SPEED,
      angle: 0,
      state: CombatBotState.FlyingToTarget,
      targetEnemy: null,
      targetX,
      targetY,
      health: BOT_HEALTH,
      maxHealth: BOT_HEALTH,
      damage: this.baseDamage,
      fireRate: BOT_FIRE_RATE,
      fireTimer: 0,
      range: BOT_RANGE,
      lifetime: this.baseLifetime,
      maxLifetime: this.baseLifetime,
      active: true,
      slotIndex,
    };

    this.bots.push(bot);
    this.onShake(5);
  }

  private releaseBotSlot(bot: CombatBot): void {
    if (this.onSlotRelease && bot.slotIndex >= 0) {
      this.onSlotRelease(bot.slotIndex);
    }
  }

  /** Reset all bots — releases slots and clears array. Call on new run. */
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
    for (let i = 0; i < this.botProjectiles.length; i++) {
      this.botProjectiles[i].active = false;
    }
  }

  update(
    dt: number,
    entities: GameEntity[],
    addFloatingText: FloatingTextCallback,
    onDeath: DeathCallback,
    onImpact: DeathCallback,
    player?: Player,
  ): void {
    for (let bi = this.bots.length - 1; bi >= 0; bi--) {
      const bot = this.bots[bi];
      if (!bot.active) continue;

      // Decrement lifetime
      bot.lifetime -= dt;
      if (bot.lifetime <= 0) {
        bot.active = false;
        this.releaseBotSlot(bot);
        this.bots.splice(bi, 1);
        continue;
      }

      // State machine
      switch (bot.state) {
        case CombatBotState.FlyingToTarget:
          this.flyToTarget(bot, dt);
          // Check for enemies while flying — auto-aggro
          this.checkForEnemyAggro(bot, entities);
          break;

        case CombatBotState.SeekingEnemy:
          this.checkForEnemyAggro(bot, entities);
          break;

        case CombatBotState.ChasingEnemy:
          if (!bot.targetEnemy || !bot.targetEnemy.active) {
            bot.targetEnemy = null;
            bot.state = CombatBotState.SeekingEnemy;
            break;
          }
          this.chaseEnemy(bot, dt);
          break;

        case CombatBotState.OrbitingEnemy:
          if (!bot.targetEnemy || !bot.targetEnemy.active) {
            bot.targetEnemy = null;
            bot.state = CombatBotState.SeekingEnemy;
            break;
          }
          this.orbitEnemy(bot, dt);
          this.fireAtTarget(bot, dt);
          break;
      }

      // Apply friction and move
      const decay = Math.exp(-BOT_FRICTION * dt);
      bot.vx *= decay;
      bot.vy *= decay;
      bot.x += bot.vx * dt;
      bot.y += bot.vy * dt;

      // Enemy contact damage to bot
      for (let ei = 0; ei < entities.length; ei++) {
        const e = entities[ei];
        if (!e.active || e.type !== 'enemy') continue;
        const enemy = e as Enemy;
        // Only melee enemies deal contact damage (not ranged)
        if (enemy.subtype === 'ranged') continue;
        const dx = enemy.x - bot.x;
        const dy = enemy.y - bot.y;
        if (dx * dx + dy * dy < CONTACT_RANGE_SQ) {
          bot.health -= enemy.damage * dt;
          if (bot.health <= 0) {
            bot.health = 0;
            bot.active = false;
            this.releaseBotSlot(bot);
            onDeath(bot.x, bot.y, enemy.x, enemy.y, '#ff8844');
            addFloatingText('BOT DESTROYED', bot.x, bot.y, '#ff8844');
            this.bots.splice(bi, 1);
            break;
          }
        }
      }
    }

    // Update projectiles
    this.updateProjectiles(dt, entities, addFloatingText, onDeath, onImpact, player);
  }

  private flyToTarget(bot: CombatBot, dt: number): void {
    const dx = bot.targetX - bot.x;
    const dy = bot.targetY - bot.y;
    const distSq = dx * dx + dy * dy;

    if (distSq < TARGET_ARRIVAL_RADIUS_SQ) {
      // Arrived at click location — start seeking enemies
      bot.state = CombatBotState.SeekingEnemy;
      return;
    }

    // Steer toward target
    const dist = Math.sqrt(distSq);
    if (dist > 0) {
      bot.vx += (dx / dist) * BOT_ACCEL * dt;
      bot.vy += (dy / dist) * BOT_ACCEL * dt;
    }
  }

  private checkForEnemyAggro(bot: CombatBot, entities: GameEntity[]): void {
    let nearest: Enemy | null = null;
    let nearestDistSq = DETECTION_RANGE_SQ;

    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!e.active || e.type !== 'enemy') continue;
      const dx = e.x - bot.x;
      const dy = e.y - bot.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = e as Enemy;
      }
    }

    if (nearest) {
      bot.targetEnemy = nearest;
      bot.state = CombatBotState.ChasingEnemy;
    }
  }

  private chaseEnemy(bot: CombatBot, dt: number): void {
    const target = bot.targetEnemy!;
    const dx = target.x - bot.x;
    const dy = target.y - bot.y;
    const distSq = dx * dx + dy * dy;

    const arrivalDist = ENEMY_ORBIT_RADIUS + ORBIT_ARRIVAL_THRESHOLD;
    if (distSq < arrivalDist * arrivalDist) {
      // Close enough — start orbiting
      bot.state = CombatBotState.OrbitingEnemy;
      bot.angle = Math.atan2(bot.y - target.y, bot.x - target.x);
      return;
    }

    // Steer toward enemy
    const dist = Math.sqrt(distSq);
    if (dist > 0) {
      bot.vx += (dx / dist) * BOT_ACCEL * dt;
      bot.vy += (dy / dist) * BOT_ACCEL * dt;
    }
  }

  private orbitEnemy(bot: CombatBot, dt: number): void {
    const target = bot.targetEnemy!;
    bot.angle += ORBIT_ANGULAR_SPEED * dt;

    // Target position on the orbit circle
    const orbitX = target.x + Math.cos(bot.angle) * ENEMY_ORBIT_RADIUS;
    const orbitY = target.y + Math.sin(bot.angle) * ENEMY_ORBIT_RADIUS;

    // Steer toward orbit position
    const dx = orbitX - bot.x;
    const dy = orbitY - bot.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 1) {
      const steerStrength = Math.min(dist / ENEMY_ORBIT_RADIUS, 2.0);
      bot.vx += (dx / dist) * BOT_ACCEL * steerStrength * dt;
      bot.vy += (dy / dist) * BOT_ACCEL * steerStrength * dt;
    }
  }

  private fireAtTarget(bot: CombatBot, dt: number): void {
    const target = bot.targetEnemy;
    if (!target || !target.active) return;

    bot.fireTimer -= dt;
    if (bot.fireTimer > 0) return;
    bot.fireTimer = bot.fireRate;

    this.fireProjectile(bot, target);
  }

  private fireProjectile(bot: CombatBot, target: Enemy): void {
    // Find an inactive projectile slot
    let slot: Projectile | null = null;
    for (let i = 0; i < this.botProjectiles.length; i++) {
      if (!this.botProjectiles[i].active) {
        slot = this.botProjectiles[i];
        break;
      }
    }
    if (!slot) return;

    const dx = target.x - bot.x;
    const dy = target.y - bot.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    slot.x = bot.x;
    slot.y = bot.y;
    slot.vx = (dx / dist) * PROJECTILE_SPEED;
    slot.vy = (dy / dist) * PROJECTILE_SPEED;
    slot.damage = bot.damage;
    slot.lifetime = PROJECTILE_LIFETIME;
    slot.active = true;
  }

  private updateProjectiles(
    dt: number,
    entities: GameEntity[],
    addFloatingText: FloatingTextCallback,
    onDeath: DeathCallback,
    onImpact: DeathCallback,
    player?: Player,
  ): void {
    for (let i = 0; i < this.botProjectiles.length; i++) {
      const p = this.botProjectiles[i];
      if (!p.active) continue;

      // Move
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Lifetime
      p.lifetime -= dt;
      if (p.lifetime <= 0) {
        p.active = false;
        continue;
      }

      // Check collision with enemies
      for (let ei = 0; ei < entities.length; ei++) {
        const e = entities[ei];
        if (!e.active || e.type !== 'enemy') continue;
        const enemy = e as Enemy;
        const dx = p.x - enemy.x;
        const dy = p.y - enemy.y;
        if (dx * dx + dy * dy < PROJECTILE_HIT_RANGE_SQ) {
          enemy.health -= p.damage;
          enemy.aggro = true;
          p.active = false;

          const theme = getTheme();
          addFloatingText(`-${p.damage}`, enemy.x, enemy.y, theme.events.damage);
          onImpact(enemy.x, enemy.y, p.x, p.y, '#ff8844');

          if (enemy.health <= 0 && enemy.active) {
            enemy.active = false;
            const deathColor = enemy.subtype === 'ranged' ? theme.entities.enemyRanged : theme.entities.enemy;
            onDeath(enemy.x, enemy.y, p.x, p.y, deathColor);
            if (player) {
              player.addEnergy(enemy.energyDrop);
              player.kills++;
              player.score += 50;
            }
            addFloatingText('+50', enemy.x, enemy.y - 15, theme.entities.salvage);
          }
          break;
        }
      }
    }
  }
}
