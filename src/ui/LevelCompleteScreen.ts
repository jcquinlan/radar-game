import { LevelConfig } from '../levels/LevelConfig';

export class LevelCompleteScreen {
  private visible = false;
  private level: LevelConfig | null = null;
  private hasNext = false;
  private nextButtonBounds = { x: 0, y: 0, width: 0, height: 0 };
  private menuButtonBounds = { x: 0, y: 0, width: 0, height: 0 };
  private clickHandler: ((e: MouseEvent) => void) | null = null;

  show(
    canvas: HTMLCanvasElement,
    level: LevelConfig,
    hasNext: boolean,
    onNext: () => void,
    onMenu: () => void,
  ): void {
    this.visible = true;
    this.level = level;
    this.hasNext = hasNext;

    this.clickHandler = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const inBounds = (b: { x: number; y: number; width: number; height: number }) =>
        mx >= b.x && mx <= b.x + b.width && my >= b.y && my <= b.y + b.height;

      if (hasNext && inBounds(this.nextButtonBounds)) {
        this.hide(canvas);
        onNext();
      } else if (inBounds(this.menuButtonBounds)) {
        this.hide(canvas);
        onMenu();
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
    if (!this.visible || !this.level) return;

    // Dim overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;

    ctx.save();

    // Title
    ctx.shadowColor = '#00ff41';
    ctx.shadowBlur = 20;
    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = '#00ff41';
    ctx.textAlign = 'center';
    ctx.fillText('LEVEL COMPLETE', cx, cy - 60);
    ctx.shadowBlur = 0;

    // Level name
    ctx.font = '18px monospace';
    ctx.fillStyle = '#88aa88';
    ctx.fillText(this.level.name, cx, cy - 20);

    // Buttons
    const btnWidth = 200;
    const btnHeight = 50;

    if (this.hasNext) {
      // Next Level button
      const nextX = cx - btnWidth - 10;
      const nextY = cy + 30;
      this.nextButtonBounds = { x: nextX, y: nextY, width: btnWidth, height: btnHeight };

      ctx.strokeStyle = '#00ff41';
      ctx.lineWidth = 2;
      ctx.strokeRect(nextX, nextY, btnWidth, btnHeight);
      ctx.font = '18px monospace';
      ctx.fillStyle = '#00ff41';
      ctx.fillText('NEXT LEVEL', nextX + btnWidth / 2, nextY + 32);

      // Menu button
      const menuX = cx + 10;
      const menuY = cy + 30;
      this.menuButtonBounds = { x: menuX, y: menuY, width: btnWidth, height: btnHeight };

      ctx.strokeStyle = '#88aa88';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(menuX, menuY, btnWidth, btnHeight);
      ctx.fillStyle = '#88aa88';
      ctx.fillText('MAIN MENU', menuX + btnWidth / 2, menuY + 32);
    } else {
      // Only menu button (centered)
      const menuX = cx - btnWidth / 2;
      const menuY = cy + 30;
      this.menuButtonBounds = { x: menuX, y: menuY, width: btnWidth, height: btnHeight };

      ctx.strokeStyle = '#00ff41';
      ctx.lineWidth = 2;
      ctx.strokeRect(menuX, menuY, btnWidth, btnHeight);
      ctx.font = '18px monospace';
      ctx.fillStyle = '#00ff41';
      ctx.fillText('MAIN MENU', cx, menuY + 32);
    }

    ctx.restore();
  }
}
