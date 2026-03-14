import { Player } from '../entities/Player';
import { GameEntity, Enemy } from '../entities/Entity';

export type FloatingTextCallback = (text: string, x: number, y: number, color: string) => void;

export interface Ability {
  id: string;
  name: string;
  keybind: string;
  cooldown: number;
  cooldownRemaining: number;
  /** For abilities with duration (HoT, drone) */
  duration: number;
  durationRemaining: number;
  active: boolean;
}

export interface Drone {
  x: number;
  y: number;
  speed: number;
  damage: number;
  lifetime: number;
  active: boolean;
}

export class AbilitySystem {
  abilities: Ability[];
  drones: Drone[] = [];
  private player: Player;

  constructor(player: Player) {
    this.player = player;
    this.abilities = [
      {
        id: 'damage_blast',
        name: 'Blast',
        keybind: '1',
        cooldown: 8,
        cooldownRemaining: 0,
        duration: 0,
        durationRemaining: 0,
        active: false,
      },
      {
        id: 'heal_over_time',
        name: 'Regen',
        keybind: '2',
        cooldown: 15,
        cooldownRemaining: 0,
        duration: 4,
        durationRemaining: 0,
        active: false,
      },
      {
        id: 'helper_drone',
        name: 'Drone',
        keybind: '3',
        cooldown: 20,
        cooldownRemaining: 0,
        duration: 10,
        durationRemaining: 0,
        active: false,
      },
    ];
  }

  getAbility(id: string): Ability | undefined {
    return this.abilities.find((a) => a.id === id);
  }

  activate(
    id: string,
    entities: GameEntity[],
    addFloatingText: FloatingTextCallback,
  ): boolean {
    const ability = this.getAbility(id);
    if (!ability || ability.cooldownRemaining > 0) return false;

    ability.cooldownRemaining = ability.cooldown;

    if (id === 'damage_blast') {
      this.activateBlast(entities, addFloatingText);
    } else if (id === 'heal_over_time') {
      ability.active = true;
      ability.durationRemaining = ability.duration;
    } else if (id === 'helper_drone') {
      ability.active = true;
      ability.durationRemaining = ability.duration;
      this.spawnDrone();
    }

    return true;
  }

  update(
    dt: number,
    entities: GameEntity[],
    addFloatingText: FloatingTextCallback,
  ): void {
    for (const ability of this.abilities) {
      if (ability.cooldownRemaining > 0) {
        ability.cooldownRemaining = Math.max(0, ability.cooldownRemaining - dt);
      }

      // Handle active duration abilities
      if (ability.active && ability.durationRemaining > 0) {
        ability.durationRemaining -= dt;

        if (ability.id === 'heal_over_time') {
          const healPerSecond = 5;
          this.player.heal(healPerSecond * dt);
        }

        if (ability.durationRemaining <= 0) {
          ability.active = false;
          ability.durationRemaining = 0;
        }
      }
    }

    // Update drones
    this.updateDrones(dt, entities, addFloatingText);
  }

  private activateBlast(
    entities: GameEntity[],
    addFloatingText: FloatingTextCallback,
  ): void {
    const blastRadius = 200;
    const blastDamage = 20;

    for (const entity of entities) {
      if (!entity.active || entity.type !== 'enemy') continue;
      const enemy = entity as Enemy;

      const dx = enemy.x - this.player.x;
      const dy = enemy.y - this.player.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < blastRadius * blastRadius) {
        enemy.health -= blastDamage;
        addFloatingText(`-${blastDamage}`, enemy.x, enemy.y, '#ff4141');

        if (enemy.health <= 0) {
          enemy.active = false;
          this.player.addEnergy(enemy.energyDrop);
          this.player.kills++;
          this.player.score += 50;
          addFloatingText('+50', enemy.x, enemy.y - 15, '#ffaa00');
        }
      }
    }
  }

  private spawnDrone(): void {
    this.drones.push({
      x: this.player.x,
      y: this.player.y,
      speed: 120,
      damage: 5,
      lifetime: 10,
      active: true,
    });
  }

  private updateDrones(
    dt: number,
    entities: GameEntity[],
    addFloatingText: FloatingTextCallback,
  ): void {
    for (const drone of this.drones) {
      if (!drone.active) continue;

      drone.lifetime -= dt;
      if (drone.lifetime <= 0) {
        drone.active = false;
        continue;
      }

      // Find nearest enemy
      let nearest: Enemy | null = null;
      let nearestDistSq = 300 * 300; // 300px chase range

      for (const entity of entities) {
        if (!entity.active || entity.type !== 'enemy') continue;
        const enemy = entity as Enemy;
        const dx = enemy.x - drone.x;
        const dy = enemy.y - drone.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < nearestDistSq) {
          nearestDistSq = distSq;
          nearest = enemy;
        }
      }

      // Chase nearest enemy
      if (nearest) {
        const dx = nearest.x - drone.x;
        const dy = nearest.y - drone.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          drone.x += (dx / dist) * drone.speed * dt;
          drone.y += (dy / dist) * drone.speed * dt;
        }

        // Contact damage
        if (dist < 20) {
          const dmg = drone.damage * dt;
          nearest.health -= dmg;
          if (nearest.health <= 0 && nearest.active) {
            nearest.active = false;
            this.player.addEnergy(nearest.energyDrop);
            this.player.kills++;
            this.player.score += 50;
            addFloatingText('+50', nearest.x, nearest.y - 15, '#ffaa00');
          }
        }
      }
    }

    // Clean up dead drones
    this.drones = this.drones.filter((d) => d.active);
  }
}
