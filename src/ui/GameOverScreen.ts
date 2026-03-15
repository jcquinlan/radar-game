import { Player } from '../entities/Player';
import { getTheme } from '../themes/theme';

export class GameOverScreen {
  private visible = false;
  private onRestart: (() => void) | null = null;
  private buttonBounds = { x: 0, y: 0, width: 0, height: 0 };
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private player: Player | null = null;

  show(canvas: HTMLCanvasElement, player: Player, onRestart: () => void): void {
    this.visible = true;
    this.onRestart = onRestart;
    this.player = player;

    this.clickHandler = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (
        mx >= this.buttonBounds.x &&
        mx <= this.buttonBounds.x + this.buttonBounds.width &&
        my >= this.buttonBounds.y &&
        my <= this.buttonBounds.y + this.buttonBounds.height
      ) {
        this.hide(canvas);
        onRestart();
      }
    };

    canvas.addEventListener('click', this.clickHandler);
  }

  hide(canvas: HTMLCanvasElement): void {
    this.visible = false;
    if (this.clickHandler) {
      canvas.removeEventListener('click', this.clickHandler);
      this.clickHandler = null;
    }
  }

  isVisible(): boolean {
    return this.visible;
  }

  render(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    if (!this.visible || !this.player) return;

    // Dim overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;

    const theme = getTheme();

    ctx.save();

    // Game Over text
    ctx.shadowColor = theme.entities.enemy;
    ctx.shadowBlur = 20;
    ctx.font = 'bold 48px monospace';
    ctx.fillStyle = theme.entities.enemy;
    ctx.textAlign = 'center';
    ctx.fillText('SIGNAL LOST', cx, cy - 120);
    ctx.shadowBlur = 0;

    // Stats
    const stats = this.player;
    const minutes = Math.floor(stats.survivalTime / 60);
    const seconds = Math.floor(stats.survivalTime % 60);

    ctx.font = '18px monospace';
    ctx.fillStyle = theme.ui.textPrimary;
    ctx.shadowColor = theme.ui.textPrimary;
    ctx.shadowBlur = 3;
    ctx.fillText(`FINAL SCORE: ${Math.floor(stats.score)}`, cx, cy - 70);
    ctx.shadowBlur = 0;

    ctx.font = '14px monospace';
    ctx.fillStyle = theme.ui.statsText;
    const lineH = 24;
    let y = cy - 40;
    ctx.fillText(`Enemies Destroyed: ${stats.kills}`, cx, y); y += lineH;
    ctx.fillText(`Energy Collected: ${Math.floor(stats.totalEnergyCollected)}`, cx, y); y += lineH;
    ctx.fillText(`Distance Traveled: ${Math.floor(stats.distanceTraveled)}m`, cx, y); y += lineH;
    ctx.fillText(`Time Survived: ${minutes}:${seconds.toString().padStart(2, '0')}`, cx, y); y += lineH;

    const maxDist = Math.floor(Math.sqrt(stats.x * stats.x + stats.y * stats.y));
    ctx.fillText(`Max Range: ${maxDist}m`, cx, y);

    // Restart button
    const btnWidth = 200;
    const btnHeight = 50;
    const btnX = cx - btnWidth / 2;
    const btnY = cy + 80;
    this.buttonBounds = { x: btnX, y: btnY, width: btnWidth, height: btnHeight };

    ctx.strokeStyle = theme.ui.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(btnX, btnY, btnWidth, btnHeight);

    ctx.font = '20px monospace';
    ctx.fillStyle = theme.ui.textPrimary;
    ctx.fillText('RESTART', cx, btnY + 32);

    ctx.restore();
  }
}
