import { Enemy, GameEntity, Projectile } from '../entities/Entity';
import { Player } from '../entities/Player';

export class CombatSystem {
  projectiles: Projectile[] = [];
  private gameTime = 0;

  /**
   * Update enemy AI, projectiles, and handle contact damage.
   * Returns true if the player is still alive.
   */
  update(entities: GameEntity[], player: Player, dt: number): boolean {
    this.gameTime += dt;

    for (const entity of entities) {
      if (!entity.active || entity.type !== 'enemy') continue;

      const enemy = entity as Enemy;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Chase the player if within range (scouts and brutes)
      // Stop at standoff distance instead of stacking on top of the player
      const standoffDist = enemy.subtype === 'brute' ? 20 : 25;
      const accel = enemy.speed * 10;
      if (enemy.subtype !== 'ranged' && dist < enemy.chaseRange && dist > standoffDist) {
        enemy.vx += (dx / dist) * accel * dt;
        enemy.vy += (dy / dist) * accel * dt;
      }

      // Ranged enemies: maintain distance and fire
      if (enemy.subtype === 'ranged' && dist < enemy.chaseRange) {
        // Back away if too close
        if (dist < 100 && dist > 0) {
          enemy.vx -= (dx / dist) * accel * dt;
          enemy.vy -= (dy / dist) * accel * dt;
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

      // Apply friction and velocity to position
      enemy.vx *= Math.pow(1e-4, dt / (1 / enemy.friction));
      enemy.vy *= Math.pow(1e-4, dt / (1 / enemy.friction));
      // Clamp to max speed
      const enemySpeedSq = enemy.vx * enemy.vx + enemy.vy * enemy.vy;
      const maxEnemySpeed = enemy.speed * 1.2;
      if (enemySpeedSq > maxEnemySpeed * maxEnemySpeed) {
        const scale = maxEnemySpeed / Math.sqrt(enemySpeedSq);
        enemy.vx *= scale;
        enemy.vy *= scale;
      }
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;

      // Contact damage (scouts and brutes only) — range matches standoff distance
      // Recalculate distance after movement
      const postDx = player.x - enemy.x;
      const postDy = player.y - enemy.y;
      const postDist = Math.sqrt(postDx * postDx + postDy * postDy);
      if (enemy.subtype !== 'ranged' && postDist < 30) {
        player.takeDamage(enemy.damage * dt);
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
