export class GameOverScreen {
  private visible = false;
  private onRestart: (() => void) | null = null;
  private buttonBounds = { x: 0, y: 0, width: 0, height: 0 };
  private clickHandler: ((e: MouseEvent) => void) | null = null;

  show(canvas: HTMLCanvasElement, onRestart: () => void): void {
    this.visible = true;
    this.onRestart = onRestart;

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
    if (!this.visible) return;

    // Dim overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;

    // Game Over text
    ctx.save();
    ctx.shadowColor = '#ff4141';
    ctx.shadowBlur = 20;
    ctx.font = 'bold 48px monospace';
    ctx.fillStyle = '#ff4141';
    ctx.textAlign = 'center';
    ctx.fillText('SIGNAL LOST', cx, cy - 40);
    ctx.shadowBlur = 0;

    // Restart button
    const btnWidth = 200;
    const btnHeight = 50;
    const btnX = cx - btnWidth / 2;
    const btnY = cy + 20;
    this.buttonBounds = { x: btnX, y: btnY, width: btnWidth, height: btnHeight };

    ctx.strokeStyle = '#00ff41';
    ctx.lineWidth = 2;
    ctx.strokeRect(btnX, btnY, btnWidth, btnHeight);

    ctx.font = '20px monospace';
    ctx.fillStyle = '#00ff41';
    ctx.fillText('RESTART', cx, btnY + 32);

    ctx.restore();
  }
}
