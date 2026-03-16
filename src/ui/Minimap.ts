import { Player } from '../entities/Player';
import { GameEntity, HomeBase } from '../entities/Entity';
import { getTheme } from '../themes/theme';

// Collapsed constants
const COLLAPSED_SIZE = 160;
const COLLAPSED_WORLD_RADIUS = 2000;
const COLLAPSED_DOT_RADIUS = 3;
const EXPANDED_DOT_RADIUS = 5;
const EXPANDED_WORLD_RADIUS = 4000;
const PADDING = 20;
const PLAYER_DOT_RADIUS = 4;
const HEADING_LINE_LENGTH = 12;
const ANIM_RATE = 5; // 1/0.2s = 5 per second
const DISTANCE_RING_INTERVAL = 500; // world-space px

function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Label for entity type shown in expanded view */
function entityLabel(type: string): string {
  switch (type) {
    case 'resource': return 'RES';
    case 'asteroid': return 'AST';
    case 'enemy': return 'ENEMY';
    case 'ally': return 'ALLY';
    case 'salvage': return 'SALVAGE';
    case 'dropoff': return 'DROP';
    default: return '';
  }
}


export class Minimap {
  private _targetExpanded = false;
  private _animProgress = 0; // 0 = collapsed, 1 = expanded
  // Cached interpolated values (reused each frame, no alloc)
  private _currentSize = COLLAPSED_SIZE;
  private _currentX = PADDING;
  private _currentY = 0; // Set properly on first render
  private _currentWorldRadius = COLLAPSED_WORLD_RADIUS;
  private _currentDotRadius = COLLAPSED_DOT_RADIUS;
  private _boundsInitialized = false;

  getSize(): number {
    return COLLAPSED_SIZE;
  }

  /** Current animated size (for hit-testing from outside) */
  getCurrentSize(): number {
    return this._currentSize;
  }

  /** Current animated top-left X */
  getCurrentX(): number {
    return this._currentX;
  }

  /** Current animated top-left Y */
  getCurrentY(): number {
    return this._currentY;
  }

  get animProgress(): number {
    return this._animProgress;
  }

  isExpanded(): boolean {
    return this._animProgress > 0.5;
  }

  toggle(): void {
    this._targetExpanded = !this._targetExpanded;
  }

  collapse(): void {
    this._targetExpanded = false;
  }

  expand(): void {
    this._targetExpanded = true;
  }

  /** Initialize cached bounds without rendering (useful for hit-testing before first render) */
  initBounds(canvasWidth: number, canvasHeight: number): void {
    if (!this._boundsInitialized) {
      this._currentX = PADDING;
      this._currentY = canvasHeight - PADDING - COLLAPSED_SIZE;
      this._boundsInitialized = true;
    }
  }

  /** Check if a screen-space point is inside the current minimap bounds */
  hitTest(screenX: number, screenY: number): boolean {
    return (
      screenX >= this._currentX &&
      screenX <= this._currentX + this._currentSize &&
      screenY >= this._currentY &&
      screenY <= this._currentY + this._currentSize
    );
  }

  update(dt: number): void {
    const target = this._targetExpanded ? 1 : 0;
    if (this._animProgress === target) return;

    if (this._animProgress < target) {
      this._animProgress = Math.min(target, this._animProgress + ANIM_RATE * dt);
    } else {
      this._animProgress = Math.max(target, this._animProgress - ANIM_RATE * dt);
    }
  }

  getVisibleEntities(entities: GameEntity[]): GameEntity[] {
    const expanded = this._animProgress > 0.5;
    return entities.filter((e) => {
      if (!e.active) return false;
      if (expanded) {
        // Show all major entity types when expanded
        return e.type === 'dropoff' || e.type === 'resource' || e.type === 'asteroid' || e.type === 'enemy' || e.type === 'ally' || e.type === 'salvage';
      }
      return e.type === 'dropoff';
    });
  }

  getEntityColor(entity: GameEntity): string {
    const e = getTheme().entities;
    return entity.type === 'dropoff' ? e.dropoff
      : entity.type === 'ally' ? e.ally
      : entity.type === 'enemy' ? e.enemy
      : entity.type === 'salvage' ? e.salvage
      : entity.type === 'resource' ? e.resource
      : entity.type === 'asteroid' ? e.asteroid
      : '#ffffff';
  }

  worldToMinimap(
    worldX: number,
    worldY: number,
    player: Player,
    canvasWidth: number,
    canvasHeight: number,
  ): { x: number; y: number; centerX: number; centerY: number } {
    const size = this._currentSize;
    const worldRadius = this._currentWorldRadius;
    const centerX = this._currentX + size / 2;
    const centerY = this._currentY + size / 2;

    const dx = worldX - player.x;
    const dy = worldY - player.y;

    const dist = Math.sqrt(dx * dx + dy * dy);
    const scale = size / 2 / worldRadius;
    let mx: number, my: number;

    if (dist > worldRadius) {
      const clampedDx = (dx / dist) * worldRadius;
      const clampedDy = (dy / dist) * worldRadius;
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
    zoomLevel?: number,
  ): void {
    const t = easeInOutCubic(this._animProgress);
    const expanded = this._animProgress > 0.5;

    // Compute interpolated values
    const expandedSize = Math.min(canvasWidth, canvasHeight) * 0.8;
    const size = lerp(COLLAPSED_SIZE, expandedSize, t);
    // When expanded, divide world radius by zoom so zooming out shows more area on the minimap
    const effectiveZoom = zoomLevel ?? 1;
    const expandedRadius = EXPANDED_WORLD_RADIUS / effectiveZoom;
    const worldRadius = lerp(COLLAPSED_WORLD_RADIUS, expandedRadius, t);
    const dotRadius = lerp(COLLAPSED_DOT_RADIUS, EXPANDED_DOT_RADIUS, t);

    // Position: collapsed = bottom-left, expanded = centered
    const collapsedX = PADDING;
    const collapsedY = canvasHeight - PADDING - COLLAPSED_SIZE;
    const expandedX = (canvasWidth - expandedSize) / 2;
    const expandedY = (canvasHeight - expandedSize) / 2;
    const x = lerp(collapsedX, expandedX, t);
    const y = lerp(collapsedY, expandedY, t);

    // Cache for hit-testing and worldToMinimap
    this._currentSize = size;
    this._currentX = x;
    this._currentY = y;
    this._currentWorldRadius = worldRadius;
    this._currentDotRadius = dotRadius;

    const theme = getTheme();

    // Dark overlay behind expanded map
    if (this._animProgress > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, ' + (0.6 * t) + ')';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.restore();
    }

    ctx.save();

    // Background
    ctx.fillStyle = theme.ui.panelBackground;
    ctx.fillRect(x, y, size, size);

    // Border
    ctx.strokeStyle = theme.ui.borderDim;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, size, size);
    ctx.globalAlpha = 1;

    // Clip to minimap area
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.clip();

    const centerX = x + size / 2;
    const centerY = y + size / 2;

    // Distance rings (expanded only)
    if (expanded) {
      const scale = size / 2 / worldRadius;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      for (let r = DISTANCE_RING_INTERVAL; r <= worldRadius; r += DISTANCE_RING_INTERVAL) {
        const ringRadius = r * scale;
        ctx.beginPath();
        ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Home base marker
    if (homeBase) {
      const basePos = this.worldToMinimap(homeBase.x, homeBase.y, player, canvasWidth, canvasHeight);
      const scale = size / 2 / worldRadius;
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

      // Home base label (expanded only)
      if (expanded) {
        ctx.font = '10px monospace';
        ctx.fillStyle = '#64dcff';
        ctx.textAlign = 'center';
        ctx.fillText('HOME', basePos.x, basePos.y - 6);
      }
    }

    // Entity dots
    const visible = this.getVisibleEntities(entities);
    for (const entity of visible) {
      const pos = this.worldToMinimap(entity.x, entity.y, player, canvasWidth, canvasHeight);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = this.getEntityColor(entity);
      ctx.fill();

      // Entity labels (expanded only)
      if (expanded) {
        const label = entityLabel(entity.type);
        if (label) {
          ctx.font = '8px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(label, pos.x + dotRadius + 2, pos.y + 3);
        }
      }
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
