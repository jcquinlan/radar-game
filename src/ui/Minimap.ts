import { Player } from '../entities/Player';
import { GameEntity, HomeBase } from '../entities/Entity';
import { getTheme } from '../themes/theme';

const SIZE = 160;
const PADDING = 20;
const WORLD_RADIUS = 2000;
const DOT_RADIUS = 3;
const PLAYER_DOT_RADIUS = 4;
const HEADING_LINE_LENGTH = 12;


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
    const e = getTheme().entities;
    return entity.type === 'dropoff' ? e.dropoff
      : entity.type === 'ally' ? e.ally
      : entity.type === 'enemy' ? e.enemy
      : entity.type === 'salvage' ? e.salvage
      : '#ffffff';
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
    homeBase?: HomeBase,
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

    // Home base marker
    if (homeBase) {
      const basePos = this.worldToMinimap(homeBase.x, homeBase.y, player, canvasWidth, canvasHeight);
      // Base radius ring
      const scale = SIZE / 2 / WORLD_RADIUS;
      const baseRadiusOnMap = homeBase.radius * scale;
      ctx.beginPath();
      ctx.arc(basePos.x, basePos.y, Math.max(baseRadiusOnMap, 3), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100, 220, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Base center dot
      ctx.beginPath();
      ctx.arc(basePos.x, basePos.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#64dcff';
      ctx.fill();
    }

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
