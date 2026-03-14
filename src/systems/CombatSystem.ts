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
      if (enemy.subtype !== 'ranged' && dist < enemy.chaseRange && dist > 0) {
        const moveX = (dx / dist) * enemy.speed * dt;
        const moveY = (dy / dist) * enemy.speed * dt;
        enemy.x += moveX;
        enemy.y += moveY;
      }

      // Ranged enemies: maintain distance and fire
      if (enemy.subtype === 'ranged' && dist < enemy.chaseRange) {
        // Back away if too close
        if (dist < 100 && dist > 0) {
          enemy.x -= (dx / dist) * enemy.speed * dt;
          enemy.y -= (dy / dist) * enemy.speed * dt;
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

      // Contact damage (scouts and brutes only)
      if (enemy.subtype !== 'ranged' && dist < 15) {
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
