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
  vx: number;
  vy: number;
  speed: number;
  damage: number;
  lifetime: number;
  active: boolean;
  friction: number;
}

export interface HomingMissile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  damage: number;
  lifetime: number;
  active: boolean;
  friction: number;
  phase: 'launch' | 'homing';
  launchTimer: number;
  target: Enemy | null;
}

export class AbilitySystem {
  abilities: Ability[];
  drones: Drone[] = [];
  missiles: HomingMissile[] = [];
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
      },
      {
        id: 'dash',
        name: 'Dash',
        keybind: '4',
        cooldown: 5,
        cooldownRemaining: 0,
        duration: 0,
        durationRemaining: 0,
        active: false,
      },
      {
        id: 'homing_missile',
        name: 'Missile',
        keybind: '5',
        cooldown: 8,
        cooldownRemaining: 0,
        duration: 0,
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
    } else if (id === 'dash') {
      this.activateDash();
    } else if (id === 'homing_missile') {
      if (!this.spawnMissile(entities)) {
        ability.cooldownRemaining = 0; // Refund cooldown if no target
        return false;
      }
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

  private activateDash(): void {
    const dashSpeed = this.player.speed * 3;
    // Dash in current velocity direction, or do nothing if stationary
    const currentSpeed = Math.sqrt(this.player.vx * this.player.vx + this.player.vy * this.player.vy);
    if (currentSpeed > 1) {
      this.player.vx = (this.player.vx / currentSpeed) * dashSpeed;
      this.player.vy = (this.player.vy / currentSpeed) * dashSpeed;
    }
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
            addFloatingText('+50', nearest.x, nearest.y - 15, '#ffaa00');
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

    // Clean up dead drones
    this.drones = this.drones.filter((d) => d.active);
  }

  private spawnMissile(entities: GameEntity[]): boolean {
    // Find nearest enemy
    let nearest: Enemy | null = null;
    let nearestDistSq = Infinity;

    for (const entity of entities) {
      if (!entity.active || entity.type !== 'enemy') continue;
      const enemy = entity as Enemy;
      const dx = enemy.x - this.player.x;
      const dy = enemy.y - this.player.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = enemy;
      }
    }

    if (!nearest) return false;

    // Launch at player heading + random offset (±30°)
    const randomOffset = (Math.random() - 0.5) * (Math.PI / 3);
    const launchAngle = this.player.heading + randomOffset;
    const launchSpeed = 300;

    this.missiles.push({
      x: this.player.x,
      y: this.player.y,
      vx: Math.cos(launchAngle) * launchSpeed,
      vy: Math.sin(launchAngle) * launchSpeed,
      speed: 400,
      damage: 35,
      lifetime: 6,
      active: true,
      friction: 1.5,
      phase: 'launch',
      launchTimer: 0.3,
      target: nearest,
    });

    return true;
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

      // Phase management
      if (missile.phase === 'launch') {
        missile.launchTimer -= dt;
        if (missile.launchTimer <= 0) {
          missile.phase = 'homing';
        }
      }

      // Homing steering — only when in homing phase and target is alive
      if (missile.phase === 'homing' && missile.target && missile.target.active) {
        const dx = missile.target.x - missile.x;
        const dy = missile.target.y - missile.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          const accel = missile.speed * missile.friction;
          missile.vx += (dx / dist) * accel * dt;
          missile.vy += (dy / dist) * accel * dt;
        }
      }
      // If target is dead, missile goes ballistic (no steering, just friction decay)

      // Apply friction and update position
      const decay = Math.exp(-missile.friction * dt);
      missile.vx *= decay;
      missile.vy *= decay;
      missile.x += missile.vx * dt;
      missile.y += missile.vy * dt;

      // Collision check against all enemies
      for (const entity of entities) {
        if (!entity.active || entity.type !== 'enemy') continue;
        const enemy = entity as Enemy;
        const dx = enemy.x - missile.x;
        const dy = enemy.y - missile.y;
        if (dx * dx + dy * dy < 15 * 15) {
          enemy.health -= missile.damage;
          addFloatingText(`-${missile.damage}`, enemy.x, enemy.y, '#ff8800');
          missile.active = false;

          if (enemy.health <= 0) {
            enemy.active = false;
            this.player.addEnergy(enemy.energyDrop);
            this.player.kills++;
            this.player.score += 50;
            addFloatingText('+50', enemy.x, enemy.y - 15, '#ffaa00');
          }
          break;
        }
      }
    }

    // Clean up dead missiles
    this.missiles = this.missiles.filter((m) => m.active);
  }
}
