import { Enemy, GameEntity, Projectile } from '../entities/Entity';
import { Player } from '../entities/Player';
import { getTheme } from '../themes/theme';

type FloatingTextCallback = (text: string, x: number, y: number, color: string) => void;
type DeathCallback = (x: number, y: number, sourceX: number, sourceY: number, color: string) => void;

export class CombatSystem {
  projectiles: Projectile[] = [];
  private gameTime = 0;
  private ramHitEnemies: Set<Enemy> = new Set();
  private wasRamActive = false;

  /**
   * Update enemy AI, projectiles, and handle contact damage.
   * Returns true if the player is still alive.
   */
  update(
    entities: GameEntity[],
    player: Player,
    dt: number,
    ramActive: boolean = false,
    ramDamage: number = 15,
    addFloatingText: FloatingTextCallback = () => {},
    onDeath: DeathCallback = () => {},
  ): boolean {
    this.gameTime += dt;

    // Clear ram hit tracking when a new dash starts
    if (ramActive && !this.wasRamActive) {
      this.ramHitEnemies.clear();
    }
    this.wasRamActive = ramActive;

    for (const entity of entities) {
      if (!entity.active || entity.type !== 'enemy') continue;

      const enemy = entity as Enemy;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distSq = dx * dx + dy * dy;

      // Chase the player if within range (scouts and brutes)
      // Stop at standoff distance instead of stacking on top of the player
      const standoffDist = enemy.subtype === 'brute' ? 20 : 25;
      const enemyAccel = enemy.speed * enemy.friction;
      const inChaseRange = distSq < enemy.chaseRange * enemy.chaseRange;

      if (enemy.subtype !== 'ranged' && inChaseRange && distSq > standoffDist * standoffDist) {
        const dist = Math.sqrt(distSq);
        enemy.vx += (dx / dist) * enemyAccel * dt;
        enemy.vy += (dy / dist) * enemyAccel * dt;
      }

      // Ranged enemies: maintain distance and fire
      if (enemy.subtype === 'ranged' && inChaseRange) {
        const dist = Math.sqrt(distSq);
        // Back away if too close
        if (dist < 100 && dist > 0) {
          enemy.vx -= (dx / dist) * enemyAccel * dt;
          enemy.vy -= (dy / dist) * enemyAccel * dt;
        }

        // Fire projectile
        if (this.gameTime - enemy.lastFireTime >= enemy.fireRate && dist > 0) {
          enemy.lastFireTime = this.gameTime;
          this.projectiles.push({
            x: enemy.x,
            y: enemy.y,
            vx: (dx / dist) * enemy.projectileSpeed,
            vy: (dy / dist) * enemy.projectileSpeed,
            damage: 8,
            active: true,
            lifetime: 3,
          });
        }
      }

      // Idle wandering when outside chase range
      if (!inChaseRange) {
        enemy.wanderTimer -= dt;
        if (enemy.wanderTimer <= 0) {
          enemy.wanderAngle = Math.random() * Math.PI * 2;
          enemy.wanderTimer = 2 + Math.random();
        }
        const wanderAccel = enemyAccel * 0.2;
        enemy.vx += Math.cos(enemy.wanderAngle) * wanderAccel * dt;
        enemy.vy += Math.sin(enemy.wanderAngle) * wanderAccel * dt;
      }

      // Apply exponential friction and update position
      const enemyDecay = Math.exp(-enemy.friction * dt);
      enemy.vx *= enemyDecay;
      enemy.vy *= enemyDecay;
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;

      // Contact damage — range matches standoff distance
      // Recalculate distance after movement
      const postDx = player.x - enemy.x;
      const postDy = player.y - enemy.y;
      const postDistSq = postDx * postDx + postDy * postDy;
      if (postDistSq < 30 * 30) {
        if (ramActive && !this.ramHitEnemies.has(enemy)) {
          // Ram: one hit per enemy per dash
          this.ramHitEnemies.add(enemy);
          enemy.health -= ramDamage;
          addFloatingText(`-${ramDamage}`, enemy.x, enemy.y, getTheme().effects.missile);
          // Knockback: blend player movement direction with player→enemy direction
          // so enemies deflect outward to whichever side they're on
          const playerSpeed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
          const toEnemyDx = enemy.x - player.x;
          const toEnemyDy = enemy.y - player.y;
          const toEnemyDist = Math.sqrt(toEnemyDx * toEnemyDx + toEnemyDy * toEnemyDy);
          if (playerSpeed > 1 && toEnemyDist > 0) {
            const knockback = 200;
            // 50% player direction + 50% outward from player to enemy
            const kx = 0.5 * (player.vx / playerSpeed) + 0.5 * (toEnemyDx / toEnemyDist);
            const ky = 0.5 * (player.vy / playerSpeed) + 0.5 * (toEnemyDy / toEnemyDist);
            const kLen = Math.sqrt(kx * kx + ky * ky);
            enemy.vx += (kx / kLen) * knockback;
            enemy.vy += (ky / kLen) * knockback;
          }
          if (enemy.health <= 0 && enemy.active) {
            enemy.active = false;
            const deathColor = enemy.subtype === 'ranged' ? getTheme().entities.enemyRanged : getTheme().entities.enemy;
            onDeath(enemy.x, enemy.y, player.x, player.y, deathColor);
            player.addEnergy(enemy.energyDrop);
            player.kills++;
            player.score += 50;
            addFloatingText('+50', enemy.x, enemy.y - 15, getTheme().entities.salvage);
          }
        } else if (enemy.subtype !== 'ranged') {
          // Normal: enemy damages player (melee only)
          player.takeDamage(enemy.damage * dt);
        }
      }
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p.active) {
        this.projectiles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.lifetime -= dt;

      if (p.lifetime <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Check collision with player
      const pdx = p.x - player.x;
      const pdy = p.y - player.y;
      if (pdx * pdx + pdy * pdy < 20 * 20) {
        player.takeDamage(p.damage);
        this.projectiles.splice(i, 1);
      }
    }

    return player.isAlive();
  }
}
