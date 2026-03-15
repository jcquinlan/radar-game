import { LevelConfig } from '../levels/LevelConfig';
import { SaveData } from '../systems/SaveData';
import {
  renderBaseUpgradePanel,
  handleBaseUpgradeClick,
  BaseUpgradePanelBounds,
} from './BaseUpgradePanel';

export class MainMenuScreen {
  private visible = false;
  private levels: LevelConfig[] = [];
  private onSelect: ((index: number) => void) | null = null;
  private buttonBounds: Array<{ x: number; y: number; width: number; height: number }> = [];
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private saveData: SaveData | null = null;
  private upgradePanelBounds: BaseUpgradePanelBounds | null = null;

  setSaveData(saveData: SaveData): void {
    this.saveData = saveData;
  }

  show(canvas: HTMLCanvasElement, levels: LevelConfig[], onSelect: (index: number) => void): void {
    this.visible = true;
    this.levels = levels;
    this.onSelect = onSelect;
    this.buttonBounds = [];

    this.clickHandler = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Check base upgrade panel clicks first
      if (this.upgradePanelBounds && this.saveData) {
        if (handleBaseUpgradeClick(mx, my, this.upgradePanelBounds, this.saveData)) {
          return; // Upgrade purchased, don't check level buttons
        }
      }

      for (let i = 0; i < this.buttonBounds.length; i++) {
        const b = this.buttonBounds[i];
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

    // Level buttons
    const btnWidth = 360;
    const btnHeight = 70;
    const gap = 16;
    const startY = 200;

    this.buttonBounds = [];

    for (let i = 0; i < this.levels.length; i++) {
      const level = this.levels[i];
      const btnX = cx - btnWidth / 2;
      const btnY = startY + i * (btnHeight + gap);

      this.buttonBounds.push({ x: btnX, y: btnY, width: btnWidth, height: btnHeight });

      // Button border
      ctx.strokeStyle = '#00ff41';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(btnX, btnY, btnWidth, btnHeight);

      // Level name
      ctx.font = '18px monospace';
      ctx.fillStyle = '#00ff41';
      ctx.textAlign = 'center';
      ctx.fillText(level.name, cx, btnY + 28);

      // Level description
      ctx.font = '12px monospace';
      ctx.fillStyle = '#88aa88';
      ctx.fillText(level.description, cx, btnY + 50);
    }

    // Currency display (prominent, top center)
    if (this.saveData) {
      ctx.font = 'bold 20px monospace';
      ctx.fillStyle = '#ffd700';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.floor(this.saveData.currency)} CREDITS`, cx, 185);
    }

    // Base upgrade panel (right side)
    if (this.saveData) {
      this.upgradePanelBounds = renderBaseUpgradePanel(ctx, this.saveData, canvasWidth, canvasHeight);
    }

    // Footer
    ctx.font = '12px monospace';
    ctx.fillStyle = '#555';
    ctx.textAlign = 'center';
    ctx.fillText('Click a level to begin', cx, canvasHeight - 30);

    ctx.restore();
  }
}
