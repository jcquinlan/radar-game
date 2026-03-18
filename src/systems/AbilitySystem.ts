import { Player } from '../entities/Player';
import { GameEntity, Enemy } from '../entities/Entity';
import { getTheme, getEnemyColor } from '../themes/theme';

export type FloatingTextCallback = (text: string, x: number, y: number, color: string) => void;
export type DeathCallback = (x: number, y: number, sourceX: number, sourceY: number, color: string) => void;

export interface Ability {
  id: string;
  name: string;
  keybind: string;
  cooldown: number;
  cooldownRemaining: number;
  /** For abilities with duration (HoT, dash) */
  duration: number;
  durationRemaining: number;
  active: boolean;
  /** Max charges (1 = no charge system, behaves like a normal cooldown) */
  maxCharges: number;
  /** Current available charges */
  charges: number;
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
  missiles: Missile[] = [];
  onShake: (intensity: number) => void = () => {};
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
        id: 'dash',
        name: 'Dash',
        keybind: '3',
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
        keybind: '4',
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
    onDeath: DeathCallback = () => {},
  ): boolean {
    const ability = this.getAbility(id);
    if (!ability || ability.charges <= 0) return false;

    ability.charges--;
    // Start cooldown to regenerate a charge (only if not already ticking)
    if (ability.cooldownRemaining <= 0) {
      ability.cooldownRemaining = ability.cooldown;
    }

    if (id === 'damage_blast') {
      this.activateBlast(entities, addFloatingText, onDeath);
    } else if (id === 'heal_over_time') {
      ability.active = true;
      ability.durationRemaining = ability.duration;
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
    onDeath: DeathCallback = () => {},
    onImpact: DeathCallback = () => {},
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

    // Update missiles
    this.updateMissiles(dt, entities, addFloatingText, onDeath, onImpact);
  }

  private activateBlast(
    entities: GameEntity[],
    addFloatingText: FloatingTextCallback,
    onDeath: DeathCallback,
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
        enemy.aggro = true;
        addFloatingText(`-${blastDamage}`, enemy.x, enemy.y, getTheme().events.damage);

        if (enemy.health <= 0) {
          enemy.active = false;
          onDeath(enemy.x, enemy.y, this.player.x, this.player.y, getEnemyColor(enemy));
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

  private spawnMissile(entities: GameEntity[]): void {
    // Find nearest visible enemy and its distance
    let nearestDist = Infinity;
    let hasTarget = false;
    for (const entity of entities) {
      if (!entity.active || entity.type !== 'enemy' || !entity.visible) continue;
      hasTarget = true;
      const dx = entity.x - this.player.x;
      const dy = entity.y - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) nearestDist = dist;
    }

    // Distance-scaled launch spread: close targets get narrow spread, far targets get wide spread
    // ±30° (0.524 rad half-spread) at <80px, ±108° (1.885 rad half-spread) at >250px, smooth lerp between
    let launchSpread = 0;
    if (hasTarget) {
      const closeSpread = Math.PI * (30 / 180);  // ±30° half-spread
      const farSpread = Math.PI * 1.2 * 0.5;     // ±108° half-spread (PI*1.2 total / 2)
      const spreadT = Math.min(1, Math.max(0, (nearestDist - 80) / (250 - 80)));
      const halfSpread = closeSpread + (farSpread - closeSpread) * spreadT;
      launchSpread = (Math.random() - 0.5) * 2 * halfSpread;
    }
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
      turnRate: 3.5, // base turn rate — effective rate scaled by distance in updateMissiles
      active: true,
    });
  }

  private updateMissiles(
    dt: number,
    entities: GameEntity[],
    addFloatingText: FloatingTextCallback,
    onDeath: DeathCallback,
    onImpact: DeathCallback,
  ): void {
    for (const missile of this.missiles) {
      if (!missile.active) continue;

      missile.lifetime -= dt;
      if (missile.lifetime <= 0) {
        missile.active = false;
        onDeath(missile.x, missile.y, NaN, NaN, getTheme().effects.missile);
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
        hitEnemy.aggro = true;
        addFloatingText(`-${missile.damage}`, hitEnemy.x, hitEnemy.y, getTheme().effects.missile);
        onImpact(hitEnemy.x, hitEnemy.y, missile.x, missile.y, getTheme().effects.missile);
        this.onShake(7);
        missile.active = false;

        if (hitEnemy.health <= 0 && hitEnemy.active) {
          hitEnemy.active = false;
          onDeath(hitEnemy.x, hitEnemy.y, missile.x, missile.y, getEnemyColor(hitEnemy));
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

        // Distance-scaled turn rate: close targets get much higher turn rate for direct shots
        // effectiveTurnRate = baseTurnRate * max(1, closeRangeFactor / clamp(dist, minDist, maxDist))
        // At 30px: 3.5 * (175/30) ≈ 20.4 rad/s (nearly instant aim)
        // At 175px: 3.5 * (175/175) = 3.5 rad/s (standard)
        // At 300px+: 3.5 * (175/300) ≈ 2.04 → clamped to 3.5 via max(1,...)
        const dist = Math.sqrt(nearestDistSq);
        const clampedDist = Math.min(300, Math.max(30, dist));
        const effectiveTurnRate = missile.turnRate * Math.max(1, 175 / clampedDist);

        // Clamp turn to effectiveTurnRate * dt
        const maxTurn = effectiveTurnRate * dt;
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
