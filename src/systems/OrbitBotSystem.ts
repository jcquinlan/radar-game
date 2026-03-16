import { Player } from '../entities/Player';
import { GameEntity, Enemy } from '../entities/Entity';
import { getTheme } from '../themes/theme';

export type FloatingTextCallback = (text: string, x: number, y: number, color: string) => void;
export type DeathCallback = (x: number, y: number, sourceX: number, sourceY: number, color: string) => void;

export const enum OrbitBotState {
  OrbitingPlayer = 0,
  ChasingEnemy = 1,
  OrbitingEnemy = 2,
  Returning = 3,
}

export interface OrbitBot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  state: OrbitBotState;
  targetEnemy: Enemy | null;
  /** Accumulated damage for batched floating text */
  damageAccum: number;
  damageTextTimer: number;
  /** Timer for projectile firing cadence */
  fireTimer: number;
}

export interface BotProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  lifetime: number;
  active: boolean;
}

// Orbit radii
const PLAYER_ORBIT_RADIUS = 50;
const ENEMY_ORBIT_RADIUS = 42;

// Detection / leash
const DETECTION_RANGE = 250;
const DETECTION_RANGE_SQ = DETECTION_RANGE * DETECTION_RANGE;
const LEASH_DISTANCE = 350;
const LEASH_DISTANCE_SQ = LEASH_DISTANCE * LEASH_DISTANCE;

// Movement
const BOT_SPEED = 150;
const BOT_FRICTION = 3.0;
const BOT_ACCEL = BOT_SPEED * BOT_FRICTION;

// Arrival threshold: when bot is "close enough" to orbit center to start orbiting
const ORBIT_ARRIVAL_THRESHOLD = 15;
const PLAYER_ORBIT_ARRIVAL = PLAYER_ORBIT_RADIUS + ORBIT_ARRIVAL_THRESHOLD;

// Projectile combat
const FIRE_INTERVAL = 0.5; // seconds between shots (~2 shots/sec)
const PROJECTILE_SPEED = 200;
const PROJECTILE_DAMAGE = 2;
const PROJECTILE_LIFETIME = 0.5;
const PROJECTILE_HIT_RANGE = 10;
const PROJECTILE_HIT_RANGE_SQ = PROJECTILE_HIT_RANGE * PROJECTILE_HIT_RANGE;
const DAMAGE_TEXT_INTERVAL = 0.5; // batch damage text every 0.5s
const MAX_BOT_PROJECTILES = 8; // pool size (2 shots/sec * 0.5s lifetime = ~1 active, but allow headroom)

export class OrbitBotSystem {
  static readonly PLAYER_ANGULAR_SPEED = 2;
  static readonly ENEMY_ANGULAR_SPEED = 2.8;

  bot: OrbitBot;
  botProjectiles: BotProjectile[];
  private player: Player;

  constructor(player: Player) {
    this.player = player;
    this.bot = {
      x: player.x + PLAYER_ORBIT_RADIUS,
      y: player.y,
      vx: 0,
      vy: 0,
      angle: 0,
      state: OrbitBotState.OrbitingPlayer,
      targetEnemy: null,
      damageAccum: 0,
      damageTextTimer: 0,
      fireTimer: 0,
    };
    // Pre-allocate projectile pool
    this.botProjectiles = [];
    for (let i = 0; i < MAX_BOT_PROJECTILES; i++) {
      this.botProjectiles.push({ x: 0, y: 0, vx: 0, vy: 0, damage: 0, lifetime: 0, active: false });
    }
  }

  reset(): void {
    this.bot.x = this.player.x + PLAYER_ORBIT_RADIUS;
    this.bot.y = this.player.y;
    this.bot.vx = 0;
    this.bot.vy = 0;
    this.bot.angle = 0;
    this.bot.state = OrbitBotState.OrbitingPlayer;
    this.bot.targetEnemy = null;
    this.bot.damageAccum = 0;
    this.bot.damageTextTimer = 0;
    this.bot.fireTimer = 0;
    // Deactivate all projectiles
    for (let i = 0; i < this.botProjectiles.length; i++) {
      this.botProjectiles[i].active = false;
    }
  }

  update(
    dt: number,
    entities: GameEntity[],
    addFloatingText: FloatingTextCallback,
    onDeath: DeathCallback,
  ): void {
    const bot = this.bot;

    // State transitions
    switch (bot.state) {
      case OrbitBotState.OrbitingPlayer:
        this.findTarget(entities);
        this.orbitAround(dt, this.player.x, this.player.y, PLAYER_ORBIT_RADIUS, OrbitBotSystem.PLAYER_ANGULAR_SPEED);
        break;

      case OrbitBotState.ChasingEnemy:
        if (!bot.targetEnemy || !bot.targetEnemy.active) {
          bot.targetEnemy = null;
          bot.state = OrbitBotState.Returning;
          break;
        }
        // Check leash
        if (this.isPlayerTooFar(bot.targetEnemy)) {
          bot.state = OrbitBotState.Returning;
          bot.targetEnemy = null;
          break;
        }
        this.chaseTarget(dt);
        break;

      case OrbitBotState.OrbitingEnemy:
        if (!bot.targetEnemy || !bot.targetEnemy.active) {
          bot.targetEnemy = null;
          bot.state = OrbitBotState.Returning;
          break;
        }
        // Check leash
        if (this.isPlayerTooFar(bot.targetEnemy)) {
          bot.state = OrbitBotState.Returning;
          bot.targetEnemy = null;
          break;
        }
        this.orbitAround(dt, bot.targetEnemy.x, bot.targetEnemy.y, ENEMY_ORBIT_RADIUS, OrbitBotSystem.ENEMY_ANGULAR_SPEED);
        this.fireProjectile(dt);
        break;

      case OrbitBotState.Returning:
        this.returnToPlayer(dt);
        break;
    }

    // Apply friction and move
    const decay = Math.exp(-BOT_FRICTION * dt);
    bot.vx *= decay;
    bot.vy *= decay;
    bot.x += bot.vx * dt;
    bot.y += bot.vy * dt;

    // Update projectiles
    this.updateProjectiles(dt, addFloatingText, onDeath);
  }

  private findTarget(entities: GameEntity[]): void {
    const bot = this.bot;
    let nearest: Enemy | null = null;
    let nearestDistSq = DETECTION_RANGE_SQ;

    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!e.active || e.type !== 'enemy') continue;
      const enemy = e as Enemy;
      // Measure from player position (bot detects enemies near player)
      const dx = enemy.x - this.player.x;
      const dy = enemy.y - this.player.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = enemy;
      }
    }

    if (nearest) {
      bot.targetEnemy = nearest;
      bot.state = OrbitBotState.ChasingEnemy;
    }
  }

  private chaseTarget(dt: number): void {
    const bot = this.bot;
    const target = bot.targetEnemy!;
    const dx = target.x - bot.x;
    const dy = target.y - bot.y;
    const distSq = dx * dx + dy * dy;

    if (distSq < (ENEMY_ORBIT_RADIUS + ORBIT_ARRIVAL_THRESHOLD) * (ENEMY_ORBIT_RADIUS + ORBIT_ARRIVAL_THRESHOLD)) {
      // Close enough — start orbiting
      bot.state = OrbitBotState.OrbitingEnemy;
      // Set initial orbit angle based on current relative position
      bot.angle = Math.atan2(bot.y - target.y, bot.x - target.x);
      return;
    }

    // Steer toward target
    const dist = Math.sqrt(distSq);
    if (dist > 0) {
      bot.vx += (dx / dist) * BOT_ACCEL * dt;
      bot.vy += (dy / dist) * BOT_ACCEL * dt;
    }
  }

  private orbitAround(dt: number, cx: number, cy: number, radius: number, angularSpeed: number): void {
    const bot = this.bot;
    bot.angle += angularSpeed * dt;

    // Target position on the orbit circle
    const targetX = cx + Math.cos(bot.angle) * radius;
    const targetY = cy + Math.sin(bot.angle) * radius;

    // Steer toward orbit position
    const dx = targetX - bot.x;
    const dy = targetY - bot.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 1) {
      // Stronger steering when further from orbit path
      const steerStrength = Math.min(dist / radius, 2.0);
      bot.vx += (dx / dist) * BOT_ACCEL * steerStrength * dt;
      bot.vy += (dy / dist) * BOT_ACCEL * steerStrength * dt;
    }
  }

  private returnToPlayer(dt: number): void {
    const bot = this.bot;
    const dx = this.player.x - bot.x;
    const dy = this.player.y - bot.y;
    const distSq = dx * dx + dy * dy;

    if (distSq < PLAYER_ORBIT_ARRIVAL * PLAYER_ORBIT_ARRIVAL) {
      // Close enough to resume orbiting player
      bot.state = OrbitBotState.OrbitingPlayer;
      bot.angle = Math.atan2(bot.y - this.player.y, bot.x - this.player.x);
      return;
    }

    // Steer toward player
    const dist = Math.sqrt(distSq);
    if (dist > 0) {
      bot.vx += (dx / dist) * BOT_ACCEL * dt;
      bot.vy += (dy / dist) * BOT_ACCEL * dt;
    }
  }

  private isPlayerTooFar(enemy: Enemy): boolean {
    const dx = this.player.x - enemy.x;
    const dy = this.player.y - enemy.y;
    return dx * dx + dy * dy > LEASH_DISTANCE_SQ;
  }

  private fireProjectile(dt: number): void {
    const bot = this.bot;
    const target = bot.targetEnemy;
    if (!target || !target.active) return;

    bot.fireTimer -= dt;
    if (bot.fireTimer > 0) return;

    bot.fireTimer = FIRE_INTERVAL;

    // Find an inactive projectile slot
    let slot: BotProjectile | null = null;
    for (let i = 0; i < this.botProjectiles.length; i++) {
      if (!this.botProjectiles[i].active) {
        slot = this.botProjectiles[i];
        break;
      }
    }
    if (!slot) return; // All slots full, skip this shot

    // Compute direction from bot to enemy
    const dx = target.x - bot.x;
    const dy = target.y - bot.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return; // Too close, skip

    const dirX = dx / dist;
    const dirY = dy / dist;

    // Initialize projectile
    slot.x = bot.x;
    slot.y = bot.y;
    slot.vx = dirX * PROJECTILE_SPEED;
    slot.vy = dirY * PROJECTILE_SPEED;
    slot.damage = PROJECTILE_DAMAGE;
    slot.lifetime = PROJECTILE_LIFETIME;
    slot.active = true;
  }

  private updateProjectiles(
    dt: number,
    addFloatingText: FloatingTextCallback,
    onDeath: DeathCallback,
  ): void {
    const bot = this.bot;
    const target = bot.targetEnemy;

    for (let i = 0; i < this.botProjectiles.length; i++) {
      const p = this.botProjectiles[i];
      if (!p.active) continue;

      // Move
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Decrement lifetime
      p.lifetime -= dt;
      if (p.lifetime <= 0) {
        p.active = false;
        continue;
      }

      // Check collision with target enemy
      if (target && target.active) {
        const dx = p.x - target.x;
        const dy = p.y - target.y;
        if (dx * dx + dy * dy < PROJECTILE_HIT_RANGE_SQ) {
          // Hit!
          target.health -= p.damage;
          target.aggro = true;
          p.active = false;

          // Batch floating text
          bot.damageAccum += p.damage;
          bot.damageTextTimer -= dt;
          if (bot.damageTextTimer <= 0) {
            const shown = Math.round(bot.damageAccum);
            if (shown > 0) {
              addFloatingText(`-${shown}`, target.x, target.y, getTheme().events.damage);
            }
            bot.damageAccum = 0;
            bot.damageTextTimer = DAMAGE_TEXT_INTERVAL;
          }

          // Check kill
          if (target.health <= 0 && target.active) {
            target.active = false;
            const deathColor = target.subtype === 'ranged' ? getTheme().entities.enemyRanged : getTheme().entities.enemy;
            onDeath(target.x, target.y, bot.x, bot.y, deathColor);
            this.player.addEnergy(target.energyDrop);
            this.player.kills++;
            this.player.score += 50;
            addFloatingText('+50', target.x, target.y - 15, getTheme().entities.salvage);

            bot.targetEnemy = null;
            bot.state = OrbitBotState.Returning;
          }
        }
      }
    }
  }
}
