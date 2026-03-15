import { LevelConfig } from '../levels/LevelConfig';

/** Bounds for a clickable button region */
interface ButtonBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class MainMenuScreen {
  private visible = false;
  private levels: LevelConfig[] = [];
  private onSelect: ((index: number) => void) | null = null;
  private onStartGame: (() => void) | null = null;
  private startGameBounds: ButtonBounds | null = null;
  private levelButtonBounds: ButtonBounds[] = [];
  private clickHandler: ((e: MouseEvent) => void) | null = null;

  show(
    canvas: HTMLCanvasElement,
    levels: LevelConfig[],
    onSelect: (index: number) => void,
    onStartGame?: () => void,
  ): void {
    this.visible = true;
    this.levels = levels;
    this.onSelect = onSelect;
    this.onStartGame = onStartGame ?? null;
    this.levelButtonBounds = [];
    this.startGameBounds = null;

    this.clickHandler = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Check Start Game button first
      if (this.startGameBounds && this.onStartGame) {
        const b = this.startGameBounds;
        if (mx >= b.x && mx <= b.x + b.width && my >= b.y && my <= b.y + b.height) {
          this.hide(canvas);
          this.onStartGame();
          return;
        }
      }

      // Check level buttons
      for (let i = 0; i < this.levelButtonBounds.length; i++) {
        const b = this.levelButtonBounds[i];
        if (mx >= b.x && mx <= b.x + b.width && my >= b.y && my <= b.y + b.height) {
          this.hide(canvas);
          onSelect(i);
          break;
        }
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

    // Full black background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const cx = canvasWidth / 2;

    ctx.save();

    // Title
    ctx.shadowColor = '#00ff41';
    ctx.shadowBlur = 20;
    ctx.font = 'bold 48px monospace';
    ctx.fillStyle = '#00ff41';
    ctx.textAlign = 'center';
    ctx.fillText('RADAR', cx, 120);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.font = '16px monospace';
    ctx.fillStyle = '#88aa88';
    ctx.fillText('A radar-themed survival game', cx, 155);

    const btnWidth = 360;
    const gap = 16;
    let currentY = 200;

    // Start Game button (prominent, above level selection)
    if (this.onStartGame) {
      const startBtnHeight = 56;
      const btnX = cx - btnWidth / 2;
      this.startGameBounds = { x: btnX, y: currentY, width: btnWidth, height: startBtnHeight };

      // Filled button with border
      ctx.fillStyle = 'rgba(0, 255, 65, 0.1)';
      ctx.fillRect(btnX, currentY, btnWidth, startBtnHeight);
      ctx.strokeStyle = '#00ff41';
      ctx.lineWidth = 2;
      ctx.strokeRect(btnX, currentY, btnWidth, startBtnHeight);

      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = '#00ff41';
      ctx.textAlign = 'center';
      ctx.fillText('START GAME', cx, currentY + 35);

      currentY += startBtnHeight + gap * 2;

      // Tutorial section header
      ctx.font = '13px monospace';
      ctx.fillStyle = '#666';
      ctx.fillText('— TUTORIALS —', cx, currentY);
      currentY += gap + 8;
    }

    // Level buttons
    const btnHeight = 70;
    this.levelButtonBounds = [];

    for (let i = 0; i < this.levels.length; i++) {
      const level = this.levels[i];
      const btnX = cx - btnWidth / 2;

      this.levelButtonBounds.push({ x: btnX, y: currentY, width: btnWidth, height: btnHeight });

      // Button border
      ctx.strokeStyle = '#00ff41';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(btnX, currentY, btnWidth, btnHeight);

      // Level name
      ctx.font = '18px monospace';
      ctx.fillStyle = '#00ff41';
      ctx.textAlign = 'center';
      ctx.fillText(level.name, cx, currentY + 28);

      // Level description
      ctx.font = '12px monospace';
      ctx.fillStyle = '#88aa88';
      ctx.fillText(level.description, cx, currentY + 50);

      currentY += btnHeight + gap;
    }

    // Footer
    ctx.font = '12px monospace';
    ctx.fillStyle = '#555';
    ctx.fillText('Select an option to begin', cx, canvasHeight - 30);

    ctx.restore();
  }
}
