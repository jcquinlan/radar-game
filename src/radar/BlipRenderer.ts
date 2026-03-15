import { GameEntity, Ally, Enemy, Salvage } from '../entities/Entity';
import { getTheme } from '../themes/theme';

function getBlipColors(): Record<string, string> {
  const t = getTheme().entities;
  return {
    resource: t.resource,
    enemy: t.enemy,
    ally: t.ally,
    salvage: t.salvage,
    dropoff: t.dropoff,
  };
}

function getAllySubtypeColors(): Record<string, string> {
  const t = getTheme().entities;
  return {
    healer: t.allyHealer,
    shield: t.allyShield,
    beacon: t.allyBeacon,
  };
}

const BLIP_SIZES: Record<string, number> = {
  resource: 3,
  enemy: 5,
  ally: 4,
  salvage: 5,
  dropoff: 6,
};

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
    const BLIP_COLORS = getBlipColors();
    const ALLY_SUBTYPE_COLORS = getAllySubtypeColors();
    const enemyRangedColor = getTheme().entities.enemyRanged;

    for (const entity of entities) {
      if (!entity.active) continue;

      // Enemies: render ghost marker if invisible but has last-known position
      if (entity.type === 'enemy') {
        const enemy = entity as Enemy;
        if (!enemy.visible && enemy.ghostX !== null && enemy.ghostY !== null) {
          this.renderGhostBlip(ctx, enemy, playerX, playerY, radarCenterX, radarCenterY, radarRadius);
        }
      }

      if (!entity.visible) continue;

      // Convert world position to radar position
      const relX = entity.x - playerX;
      const relY = entity.y - playerY;

      // Only render if within radar range (squared distance comparison)
      if (relX * relX + relY * relY > radarRadius * radarRadius) continue;

      const screenX = radarCenterX + relX;
      const screenY = radarCenterY + relY;

      let color = BLIP_COLORS[entity.type];
      const size = BLIP_SIZES[entity.type];

      // Ally subtype colors
      if (entity.type === 'ally') {
        color = ALLY_SUBTYPE_COLORS[(entity as Ally).subtype] ?? color;
      }

      ctx.save();

      // Glow effect
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;

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
      if (entity.type === 'dropoff') {
        ctx.restore();
        continue;
      }

      // Salvage: pulsing diamond with aura (skip if already towed — rendered by tow rope system)
      if (entity.type === 'salvage') {
        const salvage = entity as Salvage;
        if (salvage.towedByPlayer) {
          ctx.restore();
          continue;
        }
        const pulse = 1 + Math.sin(this.time * 4) * 0.3;
        const auraSize = currentSize + 8 + Math.sin(this.time * 3) * 3;
        ctx.globalAlpha = 0.12 + Math.sin(this.time * 3) * 0.04;
        ctx.beginPath();
        ctx.arc(screenX, screenY, auraSize, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Diamond shape
        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(Math.PI / 4);
        const s = currentSize * pulse;
        ctx.beginPath();
        ctx.rect(-s, -s, s * 2, s * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(screenX, screenY, currentSize, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      // Resolution upgrade: show type-specific labels at level 2+
      if (resolutionLevel >= 2) {
        ctx.save();
        // Counter-rotate labels so they stay upright
        if (worldRotation) {
          ctx.translate(screenX, screenY);
          ctx.rotate(-worldRotation);
          ctx.translate(-screenX, -screenY);
        }
        ctx.font = '10px monospace';
        ctx.fillStyle = color;
        ctx.shadowBlur = 3;
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

      ctx.restore();
    }
  }

  /** Render a faded ghost blip at the enemy's last-known position */
  private renderGhostBlip(
    ctx: CanvasRenderingContext2D,
    enemy: Enemy,
    playerX: number,
    playerY: number,
    radarCenterX: number,
    radarCenterY: number,
    radarRadius: number
  ): void {
    const relX = enemy.ghostX! - playerX;
    const relY = enemy.ghostY! - playerY;

    if (relX * relX + relY * relY > radarRadius * radarRadius) return;

    const screenX = radarCenterX + relX;
    const screenY = radarCenterY + relY;

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

    // Faded blip fill
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(screenX, screenY, ghostSize, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Ghost label "?"
    ctx.font = '10px monospace';
    ctx.fillStyle = color;
    ctx.shadowBlur = 2;
    ctx.fillText('?', screenX + ghostSize + 2, screenY + 3);

    ctx.restore();
  }
}
