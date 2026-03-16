import { GameEntity, Ally, Enemy, Salvage, Asteroid } from '../entities/Entity';
import { getTheme } from '../themes/theme';


const BLIP_SIZES: Record<string, number> = {
  resource: 3,
  enemy: 5,
  ally: 4,
  salvage: 5,
  dropoff: 6,
  asteroid: 4,
};

/** Glow radius multiplier — the faked glow circle is this much larger than the blip */
const GLOW_RADIUS_MULT = 2.5;
/** Glow alpha — the faked glow circle's opacity */
const GLOW_ALPHA = 0.15;

export class BlipRenderer {
  private time = 0;

  update(dt: number): void {
    this.time += dt;
  }

  renderBlips(
    ctx: CanvasRenderingContext2D,
    entities: GameEntity[],
    playerX: number,
    playerY: number,
    radarCenterX: number,
    radarCenterY: number,
    radarRadius: number,
    resolutionLevel: number,
    worldRotation?: number
  ): void {
    const themeColors = getTheme().entities;
    const enemyRangedColor = themeColors.enemyRanged;
    const radarRadiusSq = radarRadius * radarRadius;

    for (const entity of entities) {
      if (!entity.active) continue;

      // Enemies: render ghost marker if invisible but has last-known position
      if (entity.type === 'enemy') {
        const enemy = entity as Enemy;
        if (!enemy.visible && enemy.ghostX !== null && enemy.ghostY !== null) {
          this.renderGhostBlip(ctx, enemy, playerX, playerY, radarCenterX, radarCenterY, radarRadiusSq);
        }
      }

      if (!entity.visible) continue;

      // Convert world position to radar position
      const relX = entity.x - playerX;
      const relY = entity.y - playerY;

      // Only render if within radar range (squared distance comparison)
      if (relX * relX + relY * relY > radarRadiusSq) continue;

      const screenX = radarCenterX + relX;
      const screenY = radarCenterY + relY;

      let color = entity.type === 'resource' ? themeColors.resource
        : entity.type === 'enemy' ? themeColors.enemy
        : entity.type === 'ally' ? themeColors.ally
        : entity.type === 'salvage' ? themeColors.salvage
        : entity.type === 'asteroid' ? themeColors.asteroid
        : themeColors.dropoff;
      const size = BLIP_SIZES[entity.type];

      // Ally subtype colors
      if (entity.type === 'ally') {
        const subtype = (entity as Ally).subtype;
        color = subtype === 'healer' ? themeColors.allyHealer
          : subtype === 'shield' ? themeColors.allyShield
          : subtype === 'beacon' ? themeColors.allyBeacon
          : color;
      }

      let currentSize = size;

      // Enemy subtype sizes and effects
      if (entity.type === 'enemy') {
        const enemy = entity as Enemy;
        if (enemy.subtype === 'scout') {
          currentSize = 3 + Math.sin(this.time * 6) * 1;
        } else if (enemy.subtype === 'brute') {
          currentSize = 7 + Math.sin(this.time * 2) * 2;
        } else {
          // ranged: steady medium with a different color tint
          currentSize = 4;
          color = enemyRangedColor;
        }
        // Bosses render at 1.5x size
        if (enemy.isBoss) {
          currentSize *= 1.5;
        }
      }

      // Ally gentle pulsing aura
      if (entity.type === 'ally') {
        const auraSize = size + 6 + Math.sin(this.time * 2) * 3;
        ctx.globalAlpha = 0.15 + Math.sin(this.time * 2) * 0.05;
        ctx.beginPath();
        ctx.arc(screenX, screenY, auraSize, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Beacon range indicator
        if ((entity as Ally).subtype === 'beacon') {
          ctx.globalAlpha = 0.06;
          ctx.beginPath();
          ctx.arc(screenX, screenY, (entity as Ally).beaconRange, 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      // Dropoffs are rendered in full by main.ts — skip blip
      if (entity.type === 'dropoff') continue;

      // Asteroids: irregular circle, size varies by asteroid size category
      if (entity.type === 'asteroid') {
        const asteroid = entity as Asteroid;
        const asteroidRadius = asteroid.size === 'small' ? 4
          : asteroid.size === 'medium' ? 7
          : 10;

        // Faked glow behind the asteroid
        ctx.globalAlpha = GLOW_ALPHA;
        ctx.beginPath();
        ctx.arc(screenX, screenY, asteroidRadius * GLOW_RADIUS_MULT, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Irregular polygon shape (6 vertices with jitter based on position for consistency)
        ctx.beginPath();
        const vertices = 6;
        for (let v = 0; v < vertices; v++) {
          const angle = (v / vertices) * Math.PI * 2;
          // Use position-based seed for consistent jitter per asteroid
          const jitter = 0.7 + 0.3 * Math.abs(Math.sin(asteroid.x * 13.7 + asteroid.y * 7.3 + v * 2.1));
          const r = asteroidRadius * jitter;
          const px = screenX + Math.cos(angle) * r;
          const py = screenY + Math.sin(angle) * r;
          if (v === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        // Damage flash overlay
        if (asteroid.damageFlash > 0) {
          ctx.globalAlpha = Math.min(asteroid.damageFlash / 0.15, 1);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // Resolution label for asteroids (S/M/L)
        if (resolutionLevel >= 2) {
          ctx.save();
          if (worldRotation) {
            ctx.translate(screenX, screenY);
            ctx.rotate(-worldRotation);
            ctx.translate(-screenX, -screenY);
          }
          ctx.font = '10px monospace';
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.8;
          const astLabel = asteroid.size === 'small' ? 'S' : asteroid.size === 'medium' ? 'M' : 'L';
          ctx.fillText(astLabel, screenX + asteroidRadius + 2, screenY + 3);
          ctx.restore();
        }
        continue;
      }

      // Salvage: pulsing diamond with aura (skip if already towed — rendered by tow rope system)
      if (entity.type === 'salvage') {
        const salvage = entity as Salvage;
        if (salvage.towedByPlayer) continue;

        const pulse = 1 + Math.sin(this.time * 4) * 0.3;
        const auraSize = currentSize + 8 + Math.sin(this.time * 3) * 3;
        ctx.globalAlpha = 0.12 + Math.sin(this.time * 3) * 0.04;
        ctx.beginPath();
        ctx.arc(screenX, screenY, auraSize, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Faked glow behind the diamond
        ctx.globalAlpha = GLOW_ALPHA;
        ctx.beginPath();
        const glowS = currentSize * pulse * GLOW_RADIUS_MULT;
        ctx.arc(screenX, screenY, glowS, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Diamond shape — needs save/restore for translate+rotate
        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(Math.PI / 4);
        const s = currentSize * pulse;
        ctx.beginPath();
        ctx.rect(-s, -s, s * 2, s * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Damage flash overlay — white flash when recently hit
        if (salvage.damageFlash > 0) {
          ctx.globalAlpha = Math.min(salvage.damageFlash / 0.15, 1);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        ctx.restore();
      } else {
        // Faked glow: larger, lower-alpha circle behind the blip
        ctx.globalAlpha = GLOW_ALPHA;
        ctx.beginPath();
        ctx.arc(screenX, screenY, currentSize * GLOW_RADIUS_MULT, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Main blip
        ctx.beginPath();
        ctx.arc(screenX, screenY, currentSize, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      // Resolution upgrade: show type-specific labels at level 2+
      if (resolutionLevel >= 2) {
        // Labels need save/restore for counter-rotation
        ctx.save();
        if (worldRotation) {
          ctx.translate(screenX, screenY);
          ctx.rotate(-worldRotation);
          ctx.translate(-screenX, -screenY);
        }
        ctx.font = '10px monospace';
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.8;
        let label: string;
        if (entity.type === 'resource') {
          label = 'E';
        } else if (entity.type === 'enemy') {
          label = '!';
        } else if (entity.type === 'salvage') {
          label = 'S';
        } else {
          const ally = entity as Ally;
          label = ally.subtype === 'healer' ? '+' : ally.subtype === 'shield' ? 'S' : 'B';
        }
        ctx.fillText(label, screenX + size + 2, screenY + 3);
        ctx.restore();
      }
    }

    // Reset any state we may have changed
    ctx.globalAlpha = 1;
  }

  /** Render a faded ghost blip at the enemy's last-known position */
  private renderGhostBlip(
    ctx: CanvasRenderingContext2D,
    enemy: Enemy,
    playerX: number,
    playerY: number,
    radarCenterX: number,
    radarCenterY: number,
    radarRadiusSq: number
  ): void {
    const relX = enemy.ghostX! - playerX;
    const relY = enemy.ghostY! - playerY;

    if (relX * relX + relY * relY > radarRadiusSq) return;

    const screenX = radarCenterX + relX;
    const screenY = radarCenterY + relY;

    // Ghost blips use save/restore because they change lineDash (no cheap reset)
    ctx.save();
    ctx.globalAlpha = 0.35;

    const theme = getTheme();
    let color = theme.entities.enemy;
    let ghostSize = BLIP_SIZES.enemy;

    if (enemy.subtype === 'ranged') {
      color = theme.entities.enemyRanged;
      ghostSize = 4;
    } else if (enemy.subtype === 'brute') {
      ghostSize = 7;
    } else {
      ghostSize = 3;
    }

    // Dashed ring outline
    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    ctx.arc(screenX, screenY, ghostSize + 3, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    // Faked glow behind ghost blip
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.arc(screenX, screenY, ghostSize * GLOW_RADIUS_MULT, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Ghost blip fill
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(screenX, screenY, ghostSize, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Ghost label "?"
    ctx.font = '10px monospace';
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3;
    ctx.fillText('?', screenX + ghostSize + 2, screenY + 3);

    ctx.restore();
  }
}
