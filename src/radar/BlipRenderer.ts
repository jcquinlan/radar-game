import { GameEntity, Ally, Enemy } from '../entities/Entity';

const BLIP_COLORS = {
  resource: '#00ff41',
  enemy: '#ff4141',
  ally: '#4488ff',
};

const ALLY_SUBTYPE_COLORS = {
  healer: '#4488ff',
  shield: '#00ffff',
  beacon: '#88ff41',
};

const BLIP_SIZES = {
  resource: 3,
  enemy: 5,
  ally: 4,
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
    resolutionLevel: number
  ): void {
    for (const entity of entities) {
      if (!entity.active) continue;

      // Enemies use ping visibility — only render if recently swept
      if (entity.type === 'enemy') {
        const enemy = entity as Enemy;

        // Render ghost marker at last-known position if ping has worn off
        if (!enemy.pingVisible && enemy.ghostX !== null && enemy.ghostY !== null) {
          this.renderGhostBlip(ctx, enemy, playerX, playerY, radarCenterX, radarCenterY, radarRadius);
        }

        // Skip rendering the live blip if not ping-visible
        if (!enemy.pingVisible) continue;
      }

      // Convert world position to radar position
      const relX = entity.x - playerX;
      const relY = entity.y - playerY;
      const dist = Math.sqrt(relX * relX + relY * relY);

      // Only render if within radar range
      if (dist > radarRadius) continue;

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
          color = '#ff8841';
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

      ctx.beginPath();
      ctx.arc(screenX, screenY, currentSize, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Resolution upgrade: show type-specific labels at level 2+
      if (resolutionLevel >= 2) {
        ctx.font = '10px monospace';
        ctx.fillStyle = color;
        ctx.shadowBlur = 3;
        let label: string;
        if (entity.type === 'resource') {
          label = 'E';
        } else if (entity.type === 'enemy') {
          label = '!';
        } else {
          const ally = entity as Ally;
          label = ally.subtype === 'healer' ? '+' : ally.subtype === 'shield' ? 'S' : 'B';
        }
        ctx.fillText(label, screenX + size + 2, screenY + 3);
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
    const dist = Math.sqrt(relX * relX + relY * relY);

    if (dist > radarRadius) return;

    const screenX = radarCenterX + relX;
    const screenY = radarCenterY + relY;

    ctx.save();
    ctx.globalAlpha = 0.35;

    let color = BLIP_COLORS.enemy;
    let ghostSize = BLIP_SIZES.enemy;

    if (enemy.subtype === 'ranged') {
      color = '#ff8841';
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
