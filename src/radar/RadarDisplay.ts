import { PingState } from '../systems/PingSystem';

export interface RadarConfig {
  /** Radar radius in pixels */
  radius: number;
  /** Number of range rings */
  ringCount: number;
  /** Green color for the CRT aesthetic */
  color: string;
  /** Dim green for grid/rings */
  dimColor: string;
  /** Background color */
  bgColor: string;
}

export const DEFAULT_RADAR_CONFIG: RadarConfig = {
  radius: 340,
  ringCount: 4,
  color: '#00ff41',
  dimColor: '#003b0f',
  bgColor: '#0a0a0a',
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

  render(ctx: CanvasRenderingContext2D, centerX: number, centerY: number): void {
    const { radius, color } = this.config;

    // Ping ring (expanding circle with fade) — rendered without clip, can extend beyond radar
    if (this.pingState && this.pingState.active && this.pingState.radius > 0) {
      const pingRadius = Math.min(this.pingState.radius, radius);
      const alpha = this.pingState.alpha;

      // Filled area behind the ping (faint glow showing what's been scanned)
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, pingRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 255, 65, ${alpha * 0.03})`;
      ctx.fill();
      ctx.restore();

      // Main ping ring with glow
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(centerX, centerY, pingRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 255, 65, ${alpha * 0.9})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Secondary inner ring (trailing echo)
      if (pingRadius > 20) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, pingRadius - 10, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 255, 65, ${alpha * 0.3})`;
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

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    for (let y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1);
    }
    ctx.restore();
  }
}
