import { Enemy, GameEntity } from '../entities/Entity';
import { Player } from '../entities/Player';

export class CombatSystem {
  /**
   * Update enemy AI and handle contact damage.
   * Returns true if the player is still alive.
   */
  update(entities: GameEntity[], player: Player, dt: number): boolean {
    for (const entity of entities) {
      if (!entity.active || entity.type !== 'enemy') continue;

      const enemy = entity as Enemy;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Chase the player if within range
      if (dist < enemy.chaseRange && dist > 0) {
        const moveX = (dx / dist) * enemy.speed * dt;
        const moveY = (dy / dist) * enemy.speed * dt;
        enemy.x += moveX;
        enemy.y += moveY;
      }

      // Contact damage
      if (dist < 15) {
        player.takeDamage(enemy.damage * dt);
      }
    }

    return player.isAlive();
  }
}
