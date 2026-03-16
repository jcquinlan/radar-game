import { Player } from '../entities/Player';
import { HomeBase } from '../entities/Entity';
import { getThreatLevel } from '../world/World';
import { getTheme } from '../themes/theme';

/** Format seconds into MM:SS string. Exported for testing. */
export function formatTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const m = Math.floor(clamped / 60);
  const s = Math.floor(clamped % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export class HUD {
  private fps = 0;
  private frameCount = 0;
  private elapsed = 0;

  update(dt: number): void {
    this.frameCount++;
    this.elapsed += dt;
    if (this.elapsed >= 0.5) {
      this.fps = Math.round(this.frameCount / this.elapsed);
      this.frameCount = 0;
      this.elapsed = 0;
    }
  }

  render(
    ctx: CanvasRenderingContext2D,
    player: Player,
    canvasWidth: number,
    canvasHeight: number,
    runTimer: number = -1,
    homeBase?: HomeBase,
  ): void {
    const padding = 20;
    const barWidth = 200;
    const barHeight = 16;
    const y = padding;

    const theme = getTheme();

    ctx.save();
    ctx.font = '14px monospace';

    // Health bar
    this.renderBar(
      ctx,
      padding,
      y,
      barWidth,
      barHeight,
      player.health / player.maxHealth,
      player.shieldActive ? theme.entities.allyShield : theme.ui.textPrimary,
      `HP: ${Math.ceil(player.health)}/${player.maxHealth}${player.shieldActive ? ' [SHIELD]' : ''}`
    );

    // Base HP bar (below player HP bar)
    if (homeBase) {
      const baseBarY = y + barHeight + 4;
      const baseRatio = homeBase.health / homeBase.maxHealth;
      // Interpolate color from cyan to red based on damage
      const r = Math.round(100 + (255 - 100) * (1 - baseRatio));
      const g = Math.round(220 * baseRatio + 60 * (1 - baseRatio));
      const b = Math.round(255 * baseRatio + 60 * (1 - baseRatio));
      const baseColor = `rgb(${r}, ${g}, ${b})`;
      this.renderBar(
        ctx,
        padding,
        baseBarY,
        barWidth,
        barHeight,
        baseRatio,
        baseColor,
        `BASE: ${Math.ceil(homeBase.health)}/${homeBase.maxHealth}`
      );
    }

    // Offset subsequent elements when base bar is present
    const baseBarOffset = homeBase ? barHeight + 4 : 0;

    // Energy counter
    ctx.fillStyle = theme.ui.textPrimary;
    ctx.shadowColor = theme.ui.textPrimary;
    ctx.shadowBlur = 5;
    ctx.fillText(`Energy: ${Math.floor(player.energy)}`, padding, y + barHeight + baseBarOffset + 24);
    ctx.shadowBlur = 0;

    // Distance from origin
    const dist = Math.floor(Math.sqrt(player.x * player.x + player.y * player.y));
    ctx.fillStyle = theme.ui.textSecondary;
    ctx.fillText(`RANGE: ${dist}m`, padding, y + barHeight + baseBarOffset + 44);

    // Threat level
    const threat = getThreatLevel(player.x, player.y);
    ctx.fillStyle = threat.color;
    ctx.shadowColor = threat.color;
    ctx.shadowBlur = 3;
    ctx.fillText(`THREAT: ${threat.label}`, padding, y + barHeight + baseBarOffset + 64);
    ctx.shadowBlur = 0;

    // Coordinates
    ctx.fillStyle = theme.ui.textTertiary;
    ctx.font = '11px monospace';
    ctx.fillText(
      `POS: ${Math.floor(player.x)}, ${Math.floor(player.y)}`,
      padding,
      y + barHeight + baseBarOffset + 82
    );

    // Run timer (top center) — only shown during timed runs
    if (runTimer >= 0) {
      ctx.save();
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      if (runTimer === 0) {
        // Final wave in progress — show FINAL WAVE instead of 00:00
        const pulse = Math.sin(performance.now() / 400) * 0.5 + 0.5;
        const alpha = 0.6 + pulse * 0.4;
        ctx.fillStyle = `rgba(255, 200, 60, ${alpha})`;
        ctx.shadowColor = 'rgba(255, 200, 60, 0.8)';
        ctx.shadowBlur = 8;
        ctx.fillText('FINAL WAVE', canvasWidth / 2, y + 20);
      } else if (runTimer <= 20) {
        // Pulsing red in the final 20 seconds (wave warning)
        const pulse = Math.sin(performance.now() / 500) * 0.5 + 0.5; // 0..1
        const alpha = 0.5 + pulse * 0.5; // 0.5..1.0
        ctx.fillStyle = `rgba(255, 60, 60, ${alpha})`;
        ctx.shadowColor = 'rgba(255, 60, 60, 0.8)';
        ctx.shadowBlur = 6;
        ctx.fillText(formatTime(runTimer), canvasWidth / 2, y + 20);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 4;
        ctx.fillText(formatTime(runTimer), canvasWidth / 2, y + 20);
      }
      ctx.restore();
    }

    // Score (top right)
    ctx.font = '16px monospace';
    ctx.fillStyle = theme.ui.textPrimary;
    ctx.shadowColor = theme.ui.textPrimary;
    ctx.shadowBlur = 5;
    ctx.textAlign = 'right';
    ctx.fillText(`SCORE: ${Math.floor(player.score)}`, canvasWidth - padding, y + 16);
    ctx.shadowBlur = 0;

    ctx.font = '12px monospace';
    ctx.fillStyle = theme.ui.textSecondary;
    ctx.fillText(`KILLS: ${player.kills}`, canvasWidth - padding, y + 34);

    const minutes = Math.floor(player.survivalTime / 60);
    const seconds = Math.floor(player.survivalTime % 60);
    ctx.fillText(
      `TIME: ${minutes}:${seconds.toString().padStart(2, '0')}`,
      canvasWidth - padding,
      y + 50
    );

    // FPS counter (bottom left, very discreet)
    ctx.textAlign = 'left';
    ctx.font = '10px monospace';
    ctx.fillStyle = theme.ui.textSecondary;
    ctx.globalAlpha = 0.5;
    ctx.fillText(`${this.fps} FPS`, padding, canvasHeight - 10);
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  private renderBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    fill: number,
    color: string,
    label: string
  ): void {
    const theme = getTheme();
    ctx.fillStyle = theme.ui.barBackground;
    ctx.fillRect(x, y, width, height);

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(x, y, width * Math.max(0, Math.min(1, fill)), height);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x + 4, y + height - 3);
  }
}
