import { Enemy, GameEntity, HomeBase, Projectile, Salvage } from '../entities/Entity';
import { Player } from '../entities/Player';
import { getTheme, getEnemyColor } from '../themes/theme';
import type { DeathCallback } from './AbilitySystem';

type FloatingTextCallback = (text: string, x: number, y: number, color: string) => void;

export class CombatSystem {
  projectiles: Projectile[] = [];
  onShake: (intensity: number) => void = () => {};
  private gameTime = 0;
  private ramHitEnemies: Set<Enemy> = new Set();
  private wasRamActive = false;

  /**
   * Update enemy AI, projectiles, and handle contact damage.
   * Returns true if the player is still alive.
   *
   * @param targetPos - Optional override for enemy AI target position. When provided,
   *   enemies chase this point instead of the player. Used during final_wave to direct
   *   enemies toward the home base.
   * @param baseTarget - Optional home base reference. When provided, enemies within 30px
   *   of the base deal contactDamage * dt to it.
   * @param salvage - Optional salvage array. When provided, enemy projectiles and contact
   *   damage can hit salvage items. Destroyed salvage (hp<=0) is set to active=false.
   */
  update(
    entities: GameEntity[],
    player: Player,
    dt: number,
    ramActive: boolean = false,
    ramDamage: number = 15,
    addFloatingText: FloatingTextCallback = () => {},
    onDeath: DeathCallback = () => {},
    onImpact: DeathCallback = () => {},
    targetPos?: { x: number; y: number },
    baseTarget?: HomeBase,
    salvage?: Salvage[],
  ): boolean {
    this.gameTime += dt;

    // AI target: use override if provided, otherwise chase the player
    const aiTargetX = targetPos ? targetPos.x : player.x;
    const aiTargetY = targetPos ? targetPos.y : player.y;

    // Clear ram hit tracking when a new dash starts
    if (ramActive && !this.wasRamActive) {
      this.ramHitEnemies.clear();
    }
    this.wasRamActive = ramActive;

    for (const entity of entities) {
      if (!entity.active || entity.type !== 'enemy') continue;

      const enemy = entity as Enemy;

      // Boss always targets the player directly (not the base)
      const enemyTargetX = enemy.isBoss ? player.x : aiTargetX;
      const enemyTargetY = enemy.isBoss ? player.y : aiTargetY;

      // Distance to AI target (for chase/fire behavior)
      const tdx = enemyTargetX - enemy.x;
      const tdy = enemyTargetY - enemy.y;
      const targetDistSq = tdx * tdx + tdy * tdy;

      // Distance to player (for contact damage — always relevant)
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distSq = dx * dx + dy * dy;

      // Chase the AI target if within range (scouts and brutes)
      // Stop at standoff distance instead of stacking on top of the target
      const standoffDist = enemy.subtype === 'brute' ? 20 : 25;
      const enemyAccel = enemy.speed * enemy.friction;
      // Wave enemies and aggroed enemies always chase; normal enemies use chaseRange
      const inChaseRange = enemy.waveEnemy || enemy.aggro || targetDistSq < enemy.chaseRange * enemy.chaseRange;

      if (enemy.subtype !== 'ranged' && inChaseRange && targetDistSq > standoffDist * standoffDist) {
        const dist = Math.sqrt(targetDistSq);
        enemy.vx += (tdx / dist) * enemyAccel * dt;
        enemy.vy += (tdy / dist) * enemyAccel * dt;
      }

      // Ranged enemies: maintain distance and fire at AI target
      if (enemy.subtype === 'ranged' && inChaseRange) {
        const dist = Math.sqrt(targetDistSq);
        // Back away if too close
        if (dist < 100 && dist > 0) {
          enemy.vx -= (tdx / dist) * enemyAccel * dt;
          enemy.vy -= (tdy / dist) * enemyAccel * dt;
        }

        // Fire projectile toward AI target
        if (this.gameTime - enemy.lastFireTime >= enemy.fireRate && dist > 0) {
          enemy.lastFireTime = this.gameTime;
          this.projectiles.push({
            x: enemy.x,
            y: enemy.y,
            vx: (tdx / dist) * enemy.projectileSpeed,
            vy: (tdy / dist) * enemy.projectileSpeed,
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
          enemy.aggro = true;
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
            onDeath(enemy.x, enemy.y, player.x, player.y, getEnemyColor(enemy));
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

      // Base damage: wave enemies within 30px of the base deal contact damage to it
      if (baseTarget && enemy.waveEnemy) {
        const baseDx = baseTarget.x - enemy.x;
        const baseDy = baseTarget.y - enemy.y;
        if (baseDx * baseDx + baseDy * baseDy < 30 * 30) {
          baseTarget.health -= enemy.damage * dt;
        }
      }

      // Salvage contact damage: enemies within 25px of active salvage deal contact damage
      if (salvage && enemy.subtype !== 'ranged') {
        for (let si = 0; si < salvage.length; si++) {
          const s = salvage[si];
          if (!s.active || s.hp <= 0) continue;
          const sdx = s.x - enemy.x;
          const sdy = s.y - enemy.y;
          if (sdx * sdx + sdy * sdy < 25 * 25) {
            const dmg = enemy.damage * dt;
            s.hp -= dmg;
            s.damageFlash = 0.15;
            if (s.hp <= 0) {
              s.hp = 0;
              s.active = false;
              onDeath(s.x, s.y, enemy.x, enemy.y, getTheme().entities.salvage);
              addFloatingText('DESTROYED', s.x, s.y, getTheme().entities.salvage);
            }
          }
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
        onImpact(player.x, player.y, p.x, p.y, getTheme().effects.projectile);
        this.onShake(6);
        this.projectiles.splice(i, 1);
        continue;
      }

      // Check collision with salvage (15px hit radius — salvage is smaller than player)
      if (salvage) {
        let hitSalvage = false;
        for (let si = 0; si < salvage.length; si++) {
          const s = salvage[si];
          if (!s.active || s.hp <= 0) continue;
          const sdx = p.x - s.x;
          const sdy = p.y - s.y;
          if (sdx * sdx + sdy * sdy < 15 * 15) {
            s.hp -= p.damage;
            s.damageFlash = 0.15;
            addFloatingText(`-${p.damage}`, s.x, s.y, getTheme().entities.salvage);
            onImpact(s.x, s.y, p.x, p.y, getTheme().entities.salvage);
            this.onShake(4);
            if (s.hp <= 0) {
              s.hp = 0;
              s.active = false;
              onDeath(s.x, s.y, p.x, p.y, getTheme().entities.salvage);
              addFloatingText('DESTROYED', s.x, s.y - 15, getTheme().entities.salvage);
            }
            hitSalvage = true;
            break;
          }
        }
        if (hitSalvage) {
          this.projectiles.splice(i, 1);
        }
      }
    }

    return player.isAlive();
  }
}
