import { Enemy, GameEntity, Projectile } from '../entities/Entity';
import { Player } from '../entities/Player';
import { getTheme } from '../themes/theme';

type FloatingTextCallback = (text: string, x: number, y: number, color: string) => void;
type DeathCallback = (x: number, y: number, sourceX: number, sourceY: number, color: string) => void;

export interface CombatBot {
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  damage: number;
  fireRate: number;
  fireTimer: number;
  range: number;
  lifetime: number;
  maxLifetime: number;
  active: boolean;
}

// Combat bot stats
const BOT_HEALTH = 30;
const BOT_DAMAGE = 4;
const BOT_RANGE = 200;
const BOT_FIRE_RATE = 0.8;
const BOT_LIFETIME = 20;

// Projectile config
const PROJECTILE_SPEED = 180;
const PROJECTILE_LIFETIME = 2;
const PROJECTILE_HIT_RANGE = 15;
const PROJECTILE_HIT_RANGE_SQ = PROJECTILE_HIT_RANGE * PROJECTILE_HIT_RANGE;
const MAX_PROJECTILES = 16;

// Contact damage
const CONTACT_RANGE = 25;
const CONTACT_RANGE_SQ = CONTACT_RANGE * CONTACT_RANGE;

export class CombatBotSystem {
  bots: CombatBot[] = [];
  botProjectiles: Projectile[] = [];
  maxBots = 2;

  constructor() {
    // Pre-allocate projectile pool
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      this.botProjectiles.push({
        x: 0, y: 0, vx: 0, vy: 0,
        damage: 0, active: false, lifetime: 0,
      });
    }
  }

  /** Returns number of charges currently available for deployment */
  getChargesRemaining(): number {
    const activeBots = this.bots.filter(b => b.active).length;
    return this.maxBots - activeBots;
  }

  /**
   * Deploy a combat bot at the given world coordinates.
   * Returns true if deployed, false if no charges remain.
   */
  deployBot(worldX: number, worldY: number): boolean {
    const activeBots = this.bots.filter(b => b.active).length;
    if (activeBots >= this.maxBots) return false;

    const bot: CombatBot = {
      x: worldX,
      y: worldY,
      health: BOT_HEALTH,
      maxHealth: BOT_HEALTH,
      damage: BOT_DAMAGE,
      fireRate: BOT_FIRE_RATE,
      fireTimer: 0,
      range: BOT_RANGE,
      lifetime: BOT_LIFETIME,
      maxLifetime: BOT_LIFETIME,
      active: true,
    };

    this.bots.push(bot);
    return true;
  }

  /** Reset all bots and charges — call on new run */
  reset(): void {
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
    const rangeSq = BOT_RANGE * BOT_RANGE;

    for (let bi = 0; bi < this.bots.length; bi++) {
      const bot = this.bots[bi];
      if (!bot.active) continue;

      // Decrement lifetime
      bot.lifetime -= dt;
      if (bot.lifetime <= 0) {
        bot.active = false;
        continue;
      }

      // Find nearest enemy within range
      let nearestEnemy: Enemy | null = null;
      let nearestDistSq = rangeSq;

      for (let ei = 0; ei < entities.length; ei++) {
        const e = entities[ei];
        if (!e.active || e.type !== 'enemy') continue;
        const dx = e.x - bot.x;
        const dy = e.y - bot.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < nearestDistSq) {
          nearestDistSq = distSq;
          nearestEnemy = e as Enemy;
        }
      }

      // Fire at nearest enemy
      if (nearestEnemy) {
        bot.fireTimer -= dt;
        if (bot.fireTimer <= 0) {
          bot.fireTimer = bot.fireRate;
          this.fireProjectile(bot, nearestEnemy);
        }
      }

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
            onDeath(bot.x, bot.y, enemy.x, enemy.y, '#ff8844');
            addFloatingText('BOT DESTROYED', bot.x, bot.y, '#ff8844');
            break;
          }
        }
      }
    }

    // Update projectiles
    this.updateProjectiles(dt, entities, addFloatingText, onDeath, onImpact, player);
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
