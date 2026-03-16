import { getTheme } from '../themes/theme';

export interface RunStats {
  salvageDeposited: number;
  enemiesKilled: number;
  baseHpPercent: number;
  currencyEarned: number;
}

export class ResultsScreen {
  private visible = false;
  private failed = false;
  private onContinue: (() => void) | null = null;
  private buttonBounds = { x: 0, y: 0, width: 0, height: 0 };
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private stats: RunStats | null = null;

  show(canvas: HTMLCanvasElement, stats: RunStats, onContinue: () => void, failed = false): void {
    this.visible = true;
    this.failed = failed;
    this.onContinue = onContinue;
    this.stats = stats;

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
        onContinue();
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

  isFailed(): boolean {
    return this.failed;
  }

  getStats(): RunStats | null {
    return this.stats;
  }

  /** Expose button bounds for testing (render sets this normally) */
  setButtonBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    this.buttonBounds = bounds;
  }

  render(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    if (!this.visible || !this.stats) return;

    // Dim overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;

    const theme = getTheme();

    ctx.save();

    // Title
    const titleColor = this.failed ? theme.entities.enemy : theme.radar.primary;
    const titleText = this.failed ? 'RUN FAILED' : 'RUN COMPLETE';
    ctx.shadowColor = titleColor;
    ctx.shadowBlur = 20;
    ctx.font = 'bold 48px monospace';
    ctx.fillStyle = titleColor;
    ctx.textAlign = 'center';
    ctx.fillText(titleText, cx, cy - 130);
    ctx.shadowBlur = 0;

    // Stats
    ctx.font = '16px monospace';
    ctx.fillStyle = theme.ui.statsText;
    const lineH = 28;
    let y = cy - 70;

    ctx.fillText(`Salvage Deposited: ${this.stats.salvageDeposited}`, cx, y);
    y += lineH;
    ctx.fillText(`Enemies Killed: ${this.stats.enemiesKilled}`, cx, y);
    y += lineH;
    ctx.fillText(`Base HP Remaining: ${Math.round(this.stats.baseHpPercent * 100)}%`, cx, y);
    y += lineH;

    // Currency earned (highlighted)
    y += 8;
    const currencyColor = this.failed ? theme.entities.enemy : theme.events.collect;
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = currencyColor;
    ctx.shadowColor = currencyColor;
    ctx.shadowBlur = 6;
    const rewardLabel = this.failed ? 'SALVAGE RECOVERED' : 'CURRENCY EARNED';
    ctx.fillText(`${rewardLabel}: ${this.stats.currencyEarned}`, cx, y);
    ctx.shadowBlur = 0;

    // Continue button
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
    ctx.fillText('CONTINUE', cx, btnY + 32);

    ctx.restore();
  }
}
