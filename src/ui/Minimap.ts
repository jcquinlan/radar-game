import { Player } from '../entities/Player';
import { GameEntity } from '../entities/Entity';
import { getTheme } from '../themes/theme';

const SIZE = 160;
const PADDING = 20;
const WORLD_RADIUS = 2000;
const DOT_RADIUS = 3;
const PLAYER_DOT_RADIUS = 4;
const HEADING_LINE_LENGTH = 12;

function getEntityColors(): Record<string, string> {
  const t = getTheme().entities;
  return {
    dropoff: t.dropoff,
    ally: t.ally,
    enemy: t.enemy,
    salvage: t.salvage,
  };
}

export class Minimap {
  getSize(): number {
    return SIZE;
  }

  getVisibleEntities(entities: GameEntity[]): GameEntity[] {
    return entities.filter((e) => {
      if (!e.active) return false;
      return e.type === 'dropoff';
    });
  }

  getEntityColor(entity: GameEntity): string {
    return getEntityColors()[entity.type] ?? '#ffffff';
  }

  worldToMinimap(
    worldX: number,
    worldY: number,
    player: Player,
    canvasWidth: number,
    canvasHeight: number,
  ): { x: number; y: number; centerX: number; centerY: number } {
    const centerX = PADDING + SIZE / 2;
    const centerY = canvasHeight - PADDING - SIZE / 2;

    const dx = worldX - player.x;
    const dy = worldY - player.y;

    // Clamp to world radius
    const dist = Math.sqrt(dx * dx + dy * dy);
    const scale = SIZE / 2 / WORLD_RADIUS;
    let mx: number, my: number;

    if (dist > WORLD_RADIUS) {
      const clampedDx = (dx / dist) * WORLD_RADIUS;
      const clampedDy = (dy / dist) * WORLD_RADIUS;
      mx = centerX + clampedDx * scale;
      my = centerY + clampedDy * scale;
    } else {
      mx = centerX + dx * scale;
      my = centerY + dy * scale;
    }

    return { x: mx, y: my, centerX, centerY };
  }

  render(
    ctx: CanvasRenderingContext2D,
    player: Player,
    entities: GameEntity[],
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    const x = PADDING;
    const y = canvasHeight - PADDING - SIZE;

    const theme = getTheme();

    ctx.save();

    // Background
    ctx.fillStyle = theme.ui.panelBackground;
    ctx.fillRect(x, y, SIZE, SIZE);

    // Border
    ctx.strokeStyle = theme.ui.borderDim;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, SIZE, SIZE);
    ctx.globalAlpha = 1;

    // Clip to minimap area
    ctx.beginPath();
    ctx.rect(x, y, SIZE, SIZE);
    ctx.clip();

    const centerX = x + SIZE / 2;
    const centerY = y + SIZE / 2;

    // Entity dots
    const visible = this.getVisibleEntities(entities);
    for (const entity of visible) {
      const pos = this.worldToMinimap(entity.x, entity.y, player, canvasWidth, canvasHeight);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = this.getEntityColor(entity);
      ctx.fill();
    }

    // Player dot (primary, center)
    ctx.beginPath();
    ctx.arc(centerX, centerY, PLAYER_DOT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = theme.radar.primary;
    ctx.fill();

    // Heading indicator line
    const hx = centerX + Math.cos(player.heading) * HEADING_LINE_LENGTH;
    const hy = centerY + Math.sin(player.heading) * HEADING_LINE_LENGTH;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(hx, hy);
    ctx.strokeStyle = theme.radar.primary;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }
}
