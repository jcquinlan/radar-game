import { Player } from '../entities/Player';
import { GameEntity, Enemy } from '../entities/Entity';
import { getTheme } from '../themes/theme';

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
  /** Max charges (1 = no charge system, behaves like a normal cooldown) */
  maxCharges: number;
  /** Current available charges */
  charges: number;
}

export interface Drone {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  damage: number;
  lifetime: number;
  active: boolean;
  friction: number;
}

export interface Missile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  damage: number;
  lifetime: number;
  turnRate: number;
  active: boolean;
}

export class AbilitySystem {
  abilities: Ability[];
  drones: Drone[] = [];
  missiles: Missile[] = [];
  private player: Player;

  constructor(player: Player) {
    this.player = player;
    this.abilities = [
      {
        id: 'damage_blast',
        name: 'Blast',
        keybind: '1',
        cooldown: 6,
        cooldownRemaining: 0,
        duration: 0,
        durationRemaining: 0,
        active: false,
        maxCharges: 1,
        charges: 1,
      },
      {
        id: 'heal_over_time',
        name: 'Regen',
        keybind: '2',
        cooldown: 10,
        cooldownRemaining: 0,
        duration: 4,
        durationRemaining: 0,
        active: false,
        maxCharges: 1,
        charges: 1,
      },
      {
        id: 'helper_drone',
        name: 'Drone',
        keybind: '3',
        cooldown: 15,
        cooldownRemaining: 0,
        duration: 10,
        durationRemaining: 0,
        active: false,
        maxCharges: 1,
        charges: 1,
      },
      {
        id: 'dash',
        name: 'Dash',
        keybind: '4',
        cooldown: 5,
        cooldownRemaining: 0,
        duration: 1.5,
        durationRemaining: 0,
        active: false,
        maxCharges: 2,
        charges: 2,
      },
      {
        id: 'homing_missile',
        name: 'Missile',
        keybind: '5',
        cooldown: 1, // TODO: restore to 8 after testing
        cooldownRemaining: 0,
        duration: 0,
        durationRemaining: 0,
        active: false,
        maxCharges: 1,
        charges: 1,
      },
    ];
  }

  getAbility(id: string): Ability | undefined {
    return this.abilities.find((a) => a.id === id);
  }

  isDashing(): boolean {
    const dash = this.getAbility('dash');
    return dash !== undefined && dash.active && dash.durationRemaining > 0;
  }

  activate(
    id: string,
    entities: GameEntity[],
    addFloatingText: FloatingTextCallback,
  ): boolean {
    const ability = this.getAbility(id);
    if (!ability || ability.charges <= 0) return false;

    ability.charges--;
    // Start cooldown to regenerate a charge (only if not already ticking)
    if (ability.cooldownRemaining <= 0) {
      ability.cooldownRemaining = ability.cooldown;
    }

    if (id === 'damage_blast') {
      this.activateBlast(entities, addFloatingText);
    } else if (id === 'heal_over_time') {
      ability.active = true;
      ability.durationRemaining = ability.duration;
    } else if (id === 'helper_drone') {
      ability.active = true;
      ability.durationRemaining = ability.duration;
      this.spawnDrone();
    } else if (id === 'dash') {
      this.activateDash();
      ability.active = true;
      ability.durationRemaining = ability.duration;
    } else if (id === 'homing_missile') {
      this.spawnMissile(entities);
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
        // Regenerate a charge when cooldown expires
        if (ability.cooldownRemaining <= 0 && ability.charges < ability.maxCharges) {
          ability.charges++;
          // If still not full, start another cooldown cycle
          if (ability.charges < ability.maxCharges) {
            ability.cooldownRemaining = ability.cooldown;
          }
        }
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

    // Update missiles
    this.updateMissiles(dt, entities, addFloatingText);
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
        addFloatingText(`-${blastDamage}`, enemy.x, enemy.y, getTheme().events.damage);

        if (enemy.health <= 0) {
          enemy.active = false;
          this.player.addEnergy(enemy.energyDrop);
          this.player.kills++;
          this.player.score += 50;
          addFloatingText('+50', enemy.x, enemy.y - 15, getTheme().entities.salvage);
        }
      }
    }
  }

  private activateDash(): void {
    const dashSpeed = this.player.speed * 3;
    // Dash forward in the direction the ship is facing
    this.player.vx = Math.cos(this.player.heading) * dashSpeed;
    this.player.vy = Math.sin(this.player.heading) * dashSpeed;
  }

  private spawnDrone(): void {
    this.drones.push({
      x: this.player.x,
      y: this.player.y,
      vx: 0,
      vy: 0,
      speed: 120,
      damage: 5,
      lifetime: 10,
      active: true,
      friction: 2.0,
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

      // Chase nearest enemy with inertia
      if (nearest) {
        const dx = nearest.x - drone.x;
        const dy = nearest.y - drone.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          const droneAccel = drone.speed * drone.friction;
          drone.vx += (dx / dist) * droneAccel * dt;
          drone.vy += (dy / dist) * droneAccel * dt;
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
            addFloatingText('+50', nearest.x, nearest.y - 15, getTheme().entities.salvage);
          }
        }
      }

      // Apply exponential friction and update position
      const droneDecay = Math.exp(-drone.friction * dt);
      drone.vx *= droneDecay;
      drone.vy *= droneDecay;
      drone.x += drone.vx * dt;
      drone.y += drone.vy * dt;
    }

    // Clean up dead drones (backward splice avoids .filter() allocation)
    for (let i = this.drones.length - 1; i >= 0; i--) {
      if (!this.drones[i].active) this.drones.splice(i, 1);
    }
  }

  private spawnMissile(entities: GameEntity[]): void {
    // Check if any visible enemies exist to target
    const hasTarget = entities.some(
      (e) => e.active && e.type === 'enemy' && e.visible,
    );

    // With a target: random spread for arcing trajectory
    // Without: fire straight ahead from the ship
    const launchSpread = hasTarget
      ? (Math.random() - 0.5) * Math.PI * 1.2 // ±108° spread
      : 0;
    const launchAngle = this.player.heading + launchSpread;
    const launchSpeed = hasTarget ? 60 : 220; // Full speed ahead if no target

    this.missiles.push({
      x: this.player.x,
      y: this.player.y,
      vx: Math.cos(launchAngle) * launchSpeed,
      vy: Math.sin(launchAngle) * launchSpeed,
      speed: 220,
      damage: 5, // TODO: restore to 25 after testing
      lifetime: 4,
      turnRate: 3.5, // radians/sec — slightly higher to compensate for random launch
      active: true,
    });
  }

  private updateMissiles(
    dt: number,
    entities: GameEntity[],
    addFloatingText: FloatingTextCallback,
  ): void {
    for (const missile of this.missiles) {
      if (!missile.active) continue;

      missile.lifetime -= dt;
      if (missile.lifetime <= 0) {
        missile.active = false;
        continue;
      }

      // Single pass: find nearest visible enemy to steer toward + check collision
      let nearest: Enemy | null = null;
      let nearestDistSq = 400 * 400; // 400px tracking range
      let hitEnemy: Enemy | null = null;

      for (const entity of entities) {
        if (!entity.active || entity.type !== 'enemy') continue;
        const enemy = entity as Enemy;
        const dx = enemy.x - missile.x;
        const dy = enemy.y - missile.y;
        const distSq = dx * dx + dy * dy;

        // Collision check (hit radius 15px)
        if (distSq < 15 * 15) {
          hitEnemy = enemy;
          break;
        }

        // Steering: only track visible enemies
        if (enemy.visible && distSq < nearestDistSq) {
          nearestDistSq = distSq;
          nearest = enemy;
        }
      }

      // Handle collision
      if (hitEnemy) {
        hitEnemy.health -= missile.damage;
        addFloatingText(`-${missile.damage}`, hitEnemy.x, hitEnemy.y, getTheme().effects.missile);
        missile.active = false;

        if (hitEnemy.health <= 0 && hitEnemy.active) {
          hitEnemy.active = false;
          this.player.addEnergy(hitEnemy.energyDrop);
          this.player.kills++;
          this.player.score += 50;
          addFloatingText('+50', hitEnemy.x, hitEnemy.y - 15, getTheme().entities.salvage);
        }
        continue;
      }

      // Accelerate toward target speed (launches slow, ramps up)
      const currentSpeed = Math.sqrt(missile.vx * missile.vx + missile.vy * missile.vy);
      const currentAngle = Math.atan2(missile.vy, missile.vx);

      // Steer toward target by rotating velocity vector
      let newAngle = currentAngle;
      if (nearest) {
        const desiredAngle = Math.atan2(
          nearest.y - missile.y,
          nearest.x - missile.x,
        );

        // Shortest angular difference
        let angleDiff = desiredAngle - currentAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // Clamp turn to turnRate * dt
        const maxTurn = missile.turnRate * dt;
        const turn = Math.max(-maxTurn, Math.min(maxTurn, angleDiff));
        newAngle = currentAngle + turn;
      }

      // Ramp speed toward target — accelerates at 400 px/s²
      const newSpeed = Math.min(missile.speed, currentSpeed + 400 * dt);
      missile.vx = Math.cos(newAngle) * newSpeed;
      missile.vy = Math.sin(newAngle) * newSpeed;

      // Move
      missile.x += missile.vx * dt;
      missile.y += missile.vy * dt;
    }

    // Clean up dead missiles (backward splice avoids .filter() allocation)
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      if (!this.missiles[i].active) this.missiles.splice(i, 1);
    }
  }
}
