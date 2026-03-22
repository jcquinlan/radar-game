import { getTheme } from '../themes/theme';

export interface PauseMenuCallbacks {
  onResume: () => void;
  onRestart: () => void;
  onToggleShaders: () => void;
  onToggle3D: () => void;
  onCycleTheme: () => void;
  onOpenKeybinds: () => void;
  isShaderEnabled: () => boolean;
  is3DEnabled: () => boolean;
  getThemeName: () => string;
}

interface ButtonDef {
  label: string;
  action: () => void;
  /** Dynamic label function — overrides label if provided */
  dynamicLabel?: () => string;
}

export class PauseMenu {
  private visible = false;
  private callbacks: PauseMenuCallbacks | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private buttonRects: { x: number; y: number; w: number; h: number }[] = [];

  get isOpen(): boolean {
    return this.visible;
  }

  open(canvas: HTMLCanvasElement, callbacks: PauseMenuCallbacks): void {
    if (this.visible) return;
    this.visible = true;
    this.callbacks = callbacks;

    this.clickHandler = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const buttons = this.getButtons();
      for (let i = 0; i < this.buttonRects.length; i++) {
        const b = this.buttonRects[i];
        if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
          buttons[i].action();
          return;
        }
      }
    };

    canvas.addEventListener('click', this.clickHandler);
  }

  close(canvas: HTMLCanvasElement): void {
    this.visible = false;
    if (this.clickHandler) {
      canvas.removeEventListener('click', this.clickHandler);
      this.clickHandler = null;
    }
  }

  private getButtons(): ButtonDef[] {
    if (!this.callbacks) return [];
    const cb = this.callbacks;
    return [
      { label: 'RESUME', action: () => cb.onResume() },
      {
        label: '',
        dynamicLabel: () => `3D: ${cb.is3DEnabled() ? 'ON' : 'OFF'}`,
        action: () => cb.onToggle3D(),
      },
      {
        label: '',
        dynamicLabel: () => `SHADERS: ${cb.isShaderEnabled() ? 'ON' : 'OFF'}`,
        action: () => cb.onToggleShaders(),
      },
      {
        label: '',
        dynamicLabel: () => `THEME: ${cb.getThemeName().toUpperCase()}`,
        action: () => cb.onCycleTheme(),
      },
      { label: 'KEY BINDINGS', action: () => cb.onOpenKeybinds() },
      { label: 'RESTART', action: () => cb.onRestart() },
    ];
  }

  render(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    if (!this.visible) return;

    const buttons = this.getButtons();

    const theme = getTheme();

    ctx.save();

    // Dim overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const cx = canvasWidth / 2;
    const panelWidth = 300;
    const btnHeight = 44;
    const btnGap = 12;
    const panelHeight = 80 + buttons.length * (btnHeight + btnGap);
    const panelX = cx - panelWidth / 2;
    const panelY = (canvasHeight - panelHeight) / 2;

    // Panel background
    ctx.fillStyle = theme.ui.panelBackgroundSolid;
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

    // Border
    ctx.strokeStyle = theme.ui.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    // Title
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = theme.ui.textPrimary;
    ctx.shadowColor = theme.ui.textPrimary;
    ctx.shadowBlur = 8;
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', cx, panelY + 35);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.font = '10px monospace';
    ctx.fillStyle = theme.ui.textSecondary;
    ctx.fillText('ESC to resume', cx, panelY + 52);

    // Buttons
    this.buttonRects = [];
    const btnWidth = panelWidth - 40;
    let by = panelY + 70;

    for (const btn of buttons) {
      const bx = cx - btnWidth / 2;
      this.buttonRects.push({ x: bx, y: by, w: btnWidth, h: btnHeight });

      // Button background
      ctx.fillStyle = theme.ui.highlightSubtle;
      ctx.fillRect(bx, by, btnWidth, btnHeight);

      // Button border
      ctx.strokeStyle = theme.ui.borderDim;
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, btnWidth, btnHeight);

      // Button text
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = theme.ui.textPrimary;
      ctx.textAlign = 'center';
      const label = btn.dynamicLabel ? btn.dynamicLabel() : btn.label;
      ctx.fillText(label, cx, by + btnHeight / 2 + 5);

      by += btnHeight + btnGap;
    }

    ctx.textAlign = 'left';
    ctx.restore();
  }
}
