import { GameEntity, Resource, Enemy, Ally } from '../entities/Entity';
import { Player } from '../entities/Player';

export interface SweepEvent {
  entity: GameEntity;
  type: 'collect' | 'damage' | 'heal' | 'shield';
  value: number;
}

export class SweepSystem {
  private lastSweepAngle = 0;
  private events: SweepEvent[] = [];
  private gameTime = 0;

  /**
   * Check which entities the sweep line has passed over since the last update.
   * Returns sweep events for this frame.
   */
  update(
    sweepAngle: number,
    entities: GameEntity[],
    player: Player,
    radarRadius: number,
    dt: number
  ): SweepEvent[] {
    this.events.length = 0;
    this.gameTime += dt;

    // Detect when sweep completes a full rotation to reset pingedThisWave flags
    if (this.lastSweepAngle > sweepAngle + Math.PI) {
      // Wrapped around 2*PI -> 0
      for (const entity of entities) {
        entity.pingedThisWave = false;
      }
    }

    for (const entity of entities) {
      if (!entity.active || entity.pingedThisWave) continue;

      // Get entity angle relative to player
      const relX = entity.x - player.x;
      const relY = entity.y - player.y;
      const dist = Math.sqrt(relX * relX + relY * relY);

      // Skip if out of radar range
      if (dist > radarRadius) continue;

      let entityAngle = Math.atan2(relY, relX);
      if (entityAngle < 0) entityAngle += Math.PI * 2;

      // Check if sweep line passed over this entity
      if (this.isAngleBetween(entityAngle, this.lastSweepAngle, sweepAngle)) {
        entity.pingedThisWave = true;
        const event = this.processInteraction(entity, player);
        if (event) {
          this.events.push(event);
        }
      }
    }

    this.lastSweepAngle = sweepAngle;
    return this.events;
  }

  private isAngleBetween(angle: number, start: number, end: number): boolean {
    // Normalize all angles to [0, 2PI)
    const TWO_PI = Math.PI * 2;
    angle = ((angle % TWO_PI) + TWO_PI) % TWO_PI;
    start = ((start % TWO_PI) + TWO_PI) % TWO_PI;
    end = ((end % TWO_PI) + TWO_PI) % TWO_PI;

    if (start <= end) {
      return angle >= start && angle <= end;
    }
    // Wraps around 0
    return angle >= start || angle <= end;
  }

  private processInteraction(entity: GameEntity, player: Player): SweepEvent | null {
    switch (entity.type) {
      case 'resource':
        return this.collectResource(entity as Resource, player);
      case 'enemy':
        return this.damageEnemy(entity as Enemy, player);
      case 'ally':
        return this.healFromAlly(entity as Ally, player);
    }
  }

  private collectResource(resource: Resource, player: Player): SweepEvent {
    player.addEnergy(resource.energyValue);
    resource.active = false;
    return { entity: resource, type: 'collect', value: resource.energyValue };
  }

  private damageEnemy(enemy: Enemy, player: Player): SweepEvent {
    const damage = player.sweepDamage;
    enemy.health -= damage;
    if (enemy.health <= 0) {
      enemy.active = false;
      player.addEnergy(enemy.energyDrop);
    }
    return { entity: enemy, type: 'damage', value: damage };
  }

  private healFromAlly(ally: Ally, player: Player): SweepEvent | null {
    if (ally.cooldown > 0 && this.gameTime - ally.lastHealTime < ally.cooldown) {
      return null; // On cooldown
    }
    ally.lastHealTime = this.gameTime;

    switch (ally.subtype) {
      case 'healer':
        player.heal(ally.healAmount);
        return { entity: ally, type: 'heal', value: ally.healAmount };
      case 'shield':
        player.applyShield(ally.shieldReduction, ally.shieldDuration);
        return { entity: ally, type: 'shield', value: ally.shieldDuration };
      case 'beacon':
        // Beacons work passively, but sweeping gives a small energy bonus
        player.addEnergy(5);
        return { entity: ally, type: 'collect', value: 5 };
      default:
        player.heal(ally.healAmount);
        return { entity: ally, type: 'heal', value: ally.healAmount };
    }
  }
}
