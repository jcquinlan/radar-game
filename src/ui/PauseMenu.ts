import { getTheme } from '../themes/theme';

export interface ShaderSliderDef {
  label: string;
  getValue: () => number;
  setValue: (v: number) => void;
  min: number;
  max: number;
  step: number;
}

export interface PauseMenuCallbacks {
  onResume: () => void;
  onRestart: () => void;
  onToggleShaders: () => void;
  onCycleTheme: () => void;
  onOpenKeybinds: () => void;
  isShaderEnabled: () => boolean;
  getThemeName: () => string;
  getShaderSliders?: () => ShaderSliderDef[];
}

interface ButtonDef {
  label: string;
  action: () => void;
  /** Dynamic label function — overrides label if provided */
  dynamicLabel?: () => string;
}

const STORAGE_KEY = 'radar-game-shader-settings';

function loadShaderSettings(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveShaderSettings(settings: Record<string, number>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

export function loadAndApplyShaderSettings(sliders: ShaderSliderDef[]): void {
  const saved = loadShaderSettings();
  for (const s of sliders) {
    if (s.label in saved) {
      s.setValue(saved[s.label]);
    }
  }
}

export class PauseMenu {
  private visible = false;
  private callbacks: PauseMenuCallbacks | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private buttonRects: { x: number; y: number; w: number; h: number }[] = [];
  private sliderRects: { x: number; y: number; w: number; h: number; slider: ShaderSliderDef }[] = [];

  get isOpen(): boolean {
    return this.visible;
  }

  open(canvas: HTMLCanvasElement, callbacks: PauseMenuCallbacks): void {
    if (this.visible) return;
    this.visible = true;
    this.callbacks = callbacks;

    this.clickHandler = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      // Check buttons
      const buttons = this.getButtons();
      for (let i = 0; i < this.buttonRects.length; i++) {
        const b = this.buttonRects[i];
        if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
          buttons[i].action();
          return;
        }
      }

      // Check sliders
      for (const sr of this.sliderRects) {
        if (mx >= sr.x && mx <= sr.x + sr.w && my >= sr.y && my <= sr.y + sr.h) {
          this.handleSliderClick(sr, mx, canvas);
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

  private handleSliderClick(
    sr: { x: number; y: number; w: number; h: number; slider: ShaderSliderDef },
    mx: number,
    _canvas: HTMLCanvasElement,
  ): void {
    const trackX = sr.x + 8;
    const trackW = sr.w - 16;
    const ratio = Math.max(0, Math.min(1, (mx - trackX) / trackW));
    const raw = sr.slider.min + ratio * (sr.slider.max - sr.slider.min);
    // Snap to step
    const snapped = Math.round(raw / sr.slider.step) * sr.slider.step;
    sr.slider.setValue(Math.max(sr.slider.min, Math.min(sr.slider.max, snapped)));

    // Persist all slider values
    const saved = loadShaderSettings();
    if (this.callbacks?.getShaderSliders) {
      for (const s of this.callbacks.getShaderSliders()) {
        saved[s.label] = s.getValue();
      }
    }
    saveShaderSettings(saved);
  }

  private getButtons(): ButtonDef[] {
    if (!this.callbacks) return [];
    const cb = this.callbacks;
    return [
      { label: 'RESUME', action: () => cb.onResume() },
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
    const sliders = (this.callbacks?.isShaderEnabled() && this.callbacks?.getShaderSliders)
      ? this.callbacks.getShaderSliders()
      : [];

    const theme = getTheme();

    ctx.save();

    // Dim overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const cx = canvasWidth / 2;
    const panelWidth = 300;
    const btnHeight = 44;
    const btnGap = 12;
    const sliderHeight = 36;
    const sliderGap = 8;
    const sliderSectionHeight = sliders.length > 0
      ? 30 + sliders.length * (sliderHeight + sliderGap)
      : 0;
    const panelHeight = 80 + buttons.length * (btnHeight + btnGap) + sliderSectionHeight;
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

    // Shader sliders section
    if (sliders.length > 0) {
      this.sliderRects = [];

      // Section header
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = theme.ui.textSecondary;
      ctx.textAlign = 'center';
      ctx.fillText('SHADER SETTINGS', cx, by + 18);
      by += 30;

      const sliderWidth = btnWidth;

      for (const slider of sliders) {
        const sx = cx - sliderWidth / 2;
        this.sliderRects.push({ x: sx, y: by, w: sliderWidth, h: sliderHeight, slider });

        // Label + value
        ctx.font = '11px monospace';
        ctx.fillStyle = theme.ui.textSecondary;
        ctx.textAlign = 'left';
        ctx.fillText(slider.label.toUpperCase(), sx + 4, by + 12);
        ctx.textAlign = 'right';
        const pct = Math.round((slider.getValue() / slider.max) * 100);
        ctx.fillText(`${pct}%`, sx + sliderWidth - 4, by + 12);

        // Track background
        const trackX = sx + 8;
        const trackW = sliderWidth - 16;
        const trackY = by + 18;
        const trackH = 10;

        ctx.fillStyle = theme.ui.highlightSubtle;
        ctx.fillRect(trackX, trackY, trackW, trackH);
        ctx.strokeStyle = theme.ui.borderDim;
        ctx.lineWidth = 1;
        ctx.strokeRect(trackX, trackY, trackW, trackH);

        // Filled portion
        const ratio = (slider.getValue() - slider.min) / (slider.max - slider.min);
        ctx.fillStyle = theme.ui.border;
        ctx.globalAlpha = 0.4;
        ctx.fillRect(trackX, trackY, trackW * ratio, trackH);
        ctx.globalAlpha = 1.0;

        // Thumb
        const thumbX = trackX + trackW * ratio;
        ctx.fillStyle = theme.ui.textPrimary;
        ctx.fillRect(thumbX - 3, trackY - 2, 6, trackH + 4);

        by += sliderHeight + sliderGap;
      }
    } else {
      this.sliderRects = [];
    }

    ctx.textAlign = 'left';
    ctx.restore();
  }
}
