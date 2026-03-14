export interface RadarConfig {
  /** Radar radius in pixels */
  radius: number;
  /** Sweep rotation speed in radians per second */
  sweepSpeed: number;
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
  sweepSpeed: Math.PI * 0.25, // ~8 seconds per full rotation
  ringCount: 4,
  color: '#00ff41',
  dimColor: '#003b0f',
  bgColor: '#0a0a0a',
};

export class RadarDisplay {
  private sweepAngle = 0;
  private config: RadarConfig;

  // Store previous sweep positions for the fading trail
  private trailAngles: number[] = [];
  private readonly trailLength = 60;

  constructor(config: Partial<RadarConfig> = {}) {
    this.config = { ...DEFAULT_RADAR_CONFIG, ...config };
  }

  getConfig(): RadarConfig {
    return this.config;
  }

  getSweepAngle(): number {
    return this.sweepAngle;
  }

  getRadius(): number {
    return this.config.radius;
  }

  setRadius(radius: number): void {
    this.config.radius = radius;
  }

  setSweepSpeed(speed: number): void {
    this.config.sweepSpeed = speed;
  }

  update(dt: number): void {
    this.sweepAngle = (this.sweepAngle + this.config.sweepSpeed * dt) % (Math.PI * 2);
    this.trailAngles.unshift(this.sweepAngle);
    if (this.trailAngles.length > this.trailLength) {
      this.trailAngles.length = this.trailLength;
    }
  }

  /** Render the static radar frame: background, rings, crosshair, border, center dot, scanlines.
   *  Call this BEFORE the rotated entity layer. */
  renderBackground(ctx: CanvasRenderingContext2D, centerX: number, centerY: number): void {
    const { radius, ringCount, color, dimColor, bgColor } = this.config;

    ctx.save();

    // Clip to circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip();

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);

    // Range rings
    for (let i = 1; i <= ringCount; i++) {
      const r = (radius / ringCount) * i;
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      ctx.strokeStyle = dimColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Cross-hair grid lines
    ctx.beginPath();
    ctx.moveTo(centerX - radius, centerY);
    ctx.lineTo(centerX + radius, centerY);
    ctx.moveTo(centerX, centerY - radius);
    ctx.lineTo(centerX, centerY + radius);
    ctx.strokeStyle = dimColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Outer ring (border)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.restore();

    // Scanline overlay (outside clip for full effect)
    this.renderScanlines(ctx, centerX, centerY, radius);
  }

  /** Render the sweep line and trail. Call this AFTER the rotated entity layer
   *  so the sweep is always in screen space and on top of entities. */
  renderSweep(ctx: CanvasRenderingContext2D, centerX: number, centerY: number): void {
    const { radius, color } = this.config;

    ctx.save();

    // Clip to circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip();

    // Sweep trail (fading)
    for (let i = this.trailAngles.length - 1; i >= 0; i--) {
      const alpha = ((this.trailAngles.length - i) / this.trailAngles.length) * 0.3;
      const angle = this.trailAngles[i];
      const endX = centerX + Math.cos(angle) * radius;
      const endY = centerY + Math.sin(angle) * radius;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = `rgba(0, 255, 65, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Main sweep line with glow
    const sweepEndX = centerX + Math.cos(this.sweepAngle) * radius;
    const sweepEndY = centerY + Math.sin(this.sweepAngle) * radius;

    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(sweepEndX, sweepEndY);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  /** @deprecated Use renderBackground() + renderSweep() separately */
  render(ctx: CanvasRenderingContext2D, centerX: number, centerY: number): void {
    this.renderBackground(ctx, centerX, centerY);
    this.renderSweep(ctx, centerX, centerY);
  }

  private renderScanlines(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    for (let y = centerY - radius; y < centerY + radius; y += 3) {
      ctx.fillRect(centerX - radius, y, radius * 2, 1);
    }
    ctx.restore();
  }
}
