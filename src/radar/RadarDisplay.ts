import { PingState } from '../systems/PingSystem';
import { getTheme } from '../themes/theme';

/** Distance threshold — hide the home arrow when player is this close to origin */
const HOME_ARROW_MIN_DISTANCE = 200;

/**
 * Compute the screen-space angle for the home base direction arrow.
 * RadarDisplay renders before the world rotation transform, so we must
 * account for the player heading and the PI/2 offset applied in main.ts.
 */
export function computeHomeArrowAngle(playerX: number, playerY: number, playerHeading: number): number {
  return Math.atan2(-playerY, -playerX) - playerHeading - Math.PI / 2;
}

/** Returns true when the player is far enough from origin to show the arrow */
export function shouldShowHomeArrow(playerX: number, playerY: number): boolean {
  return playerX * playerX + playerY * playerY > HOME_ARROW_MIN_DISTANCE * HOME_ARROW_MIN_DISTANCE;
}

export interface RadarConfig {
  /** Radar radius in pixels */
  radius: number;
  /** Number of range rings */
  ringCount: number;
}

export const DEFAULT_RADAR_CONFIG: RadarConfig = {
  radius: 340,
  ringCount: 4,
};

export class RadarDisplay {
  private config: RadarConfig;
  private pingState: PingState | null = null;

  /** When false, Canvas 2D scanlines are skipped (e.g., when WebGL CRT shader is active) */
  scanlineEnabled = true;

  constructor(config: Partial<RadarConfig> = {}) {
    this.config = { ...DEFAULT_RADAR_CONFIG, ...config };
  }

  getConfig(): RadarConfig {
    return this.config;
  }

  getRadius(): number {
    return this.config.radius;
  }

  setRadius(radius: number): void {
    this.config.radius = radius;
  }

  /** Update the ping state from PingSystem each frame */
  setPingState(state: PingState): void {
    this.pingState = state;
  }

  render(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    playerX = 0,
    playerY = 0,
    playerHeading = 0,
  ): void {
    const { radius } = this.config;
    const theme = getTheme();
    const color = theme.radar.primary;
    const pingRgb = theme.radar.pingRgb;

    // Ping ring (expanding circle with fade) — rendered without clip, can extend beyond radar
    if (this.pingState && this.pingState.active && this.pingState.radius > 0) {
      const pingRadius = Math.min(this.pingState.radius, radius);
      const alpha = this.pingState.alpha;

      // Filled area behind the ping (faint glow showing what's been scanned)
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, pingRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${pingRgb}, ${alpha * 0.03})`;
      ctx.fill();
      ctx.restore();

      // Main ping ring with glow
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(centerX, centerY, pingRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${pingRgb}, ${alpha * 0.9})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Secondary inner ring (trailing echo)
      if (pingRadius > 20) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, pingRadius - 10, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${pingRgb}, ${alpha * 0.3})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
    }

    // Outer ring (border) — subtle visual indicator of ping range
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Home base direction arrow — gold chevron on outer ring pointing toward origin
    if (shouldShowHomeArrow(playerX, playerY)) {
      const arrowAngle = computeHomeArrowAngle(playerX, playerY, playerHeading);
      const arrowX = centerX + Math.cos(arrowAngle) * radius;
      const arrowY = centerY + Math.sin(arrowAngle) * radius;
      const arrowSize = 8;

      ctx.save();
      ctx.translate(arrowX, arrowY);
      ctx.rotate(arrowAngle); // rotate so the chevron points outward from center
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#ffaa00';
      ctx.beginPath();
      // Triangle pointing outward (right along local x-axis after rotation)
      ctx.moveTo(arrowSize, 0);
      ctx.lineTo(-arrowSize * 0.5, -arrowSize * 0.5);
      ctx.lineTo(-arrowSize * 0.5, arrowSize * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Center dot
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Scanline overlay across full screen
    if (this.scanlineEnabled) {
      this.renderScanlines(ctx, centerX, centerY);
    }
  }

  private renderScanlines(
    ctx: CanvasRenderingContext2D,
    _centerX: number,
    _centerY: number,
  ): void {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const theme = getTheme();

    ctx.save();
    ctx.fillStyle = theme.radar.scanline;
    for (let y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1);
    }
    ctx.restore();
  }
}
