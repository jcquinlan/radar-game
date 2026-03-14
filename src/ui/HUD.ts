import { Player } from '../entities/Player';

export class HUD {
  render(ctx: CanvasRenderingContext2D, player: Player, canvasWidth: number): void {
    const padding = 20;
    const barWidth = 200;
    const barHeight = 16;
    const y = padding;

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
      '#00ff41',
      `HP: ${Math.ceil(player.health)}/${player.maxHealth}`
    );

    // Energy counter
    ctx.fillStyle = '#00ff41';
    ctx.shadowColor = '#00ff41';
    ctx.shadowBlur = 5;
    ctx.fillText(`Energy: ${Math.floor(player.energy)}`, padding, y + barHeight + 24);
    ctx.shadowBlur = 0;

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
    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x, y, width, height);

    // Fill
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(x, y, width * Math.max(0, Math.min(1, fill)), height);
    ctx.globalAlpha = 1;

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);

    // Label
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x + 4, y + height - 3);
  }
}
