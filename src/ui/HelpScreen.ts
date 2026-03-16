import { getTheme } from '../themes/theme';

const SECTIONS: { title: string; lines: string[] }[] = [
  {
    title: 'THE BASICS',
    lines: [
      'W/S or Up/Down — thrust forward/backward',
      'A/D or Left/Right — turn',
      'Radar ping auto-fires — it reveals and collects',
      'Fly over green blips to collect energy',
    ],
  },
  {
    title: 'THE RUN',
    lines: [
      'Each run lasts 10 minutes',
      'Explore, collect salvage, and prepare your base',
      'When the timer hits 0, a wave attacks your base',
      'Survive the wave → earn currency → upgrade → repeat',
    ],
  },
  {
    title: 'SALVAGE & DROPOFFS',
    lines: [
      'Fly near amber diamonds to tow them',
      'Drag salvage to dropoff zones or your base for energy',
      'Salvage deposited also counts toward end-of-run currency',
    ],
  },
  {
    title: 'DEFENSES',
    lines: [
      '[T] Place turret (100 energy) — auto-shoots enemies',
      '[R] Place repair station (75 energy) — heals you nearby',
      'Must be near home base, max 3 slots (upgradeable)',
    ],
  },
  {
    title: 'ABILITIES (1-4)',
    lines: [
      '[1] Blast — AoE damage around you',
      '[2] Regen — heal over time',
      '[3] Drone — spawns a helper that chases enemies',
      '[4] Dash — burst of speed in current direction',
    ],
  },
  {
    title: 'COMBOS',
    lines: [
      'Use two abilities within 3s for a bonus:',
      'Blast → Drone = drone deals 2x damage',
      'Regen → Dash = 50% longer dash',
      'Dash → Blast = 50% larger blast radius',
    ],
  },
  {
    title: 'BASE UPGRADES (between runs)',
    lines: [
      'Spend currency in base mode before starting a run:',
      'Reinforced Hull — +100 base HP per level',
      'Cargo Hold — +2 tow capacity per level',
      'Energy Reserves — +25 starting energy per level',
      'Defense Slots — +1 defense slot per level',
    ],
  },
  {
    title: 'CONTROLS',
    lines: [
      '[E] Upgrades panel  [K] Rebind keys',
      '[H] This help screen  [Esc] Pause',
    ],
  },
];

export class HelpScreen {
  private visible = false;
  private scrollY = 0;

  toggle(): void {
    this.visible = !this.visible;
    this.scrollY = 0;
  }

  isVisible(): boolean {
    return this.visible;
  }

  scroll(delta: number): void {
    this.scrollY += delta;
    if (this.scrollY > 0) this.scrollY = 0;
  }

  render(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    if (!this.visible) return;

    const theme = getTheme();

    ctx.save();

    // Dim overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const panelWidth = Math.min(420, canvasWidth - 40);
    const panelX = (canvasWidth - panelWidth) / 2;
    const panelTop = 30;
    const panelBottom = canvasHeight - 30;
    const panelHeight = panelBottom - panelTop;

    // Panel background
    ctx.fillStyle = theme.ui.panelBackgroundSolid;
    ctx.fillRect(panelX, panelTop, panelWidth, panelHeight);

    // Border
    ctx.strokeStyle = theme.ui.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelTop, panelWidth, panelHeight);

    // Title
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = theme.ui.textPrimary;
    ctx.shadowColor = theme.ui.textPrimary;
    ctx.shadowBlur = 8;
    ctx.textAlign = 'center';
    ctx.fillText('HOW TO PLAY', canvasWidth / 2, panelTop + 28);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.font = '10px monospace';
    ctx.fillStyle = theme.ui.textSecondary;
    ctx.fillText('Press H to close  ·  Scroll to see more', canvasWidth / 2, panelTop + 44);

    // Clip content area
    const contentTop = panelTop + 56;
    const contentHeight = panelHeight - 66;
    ctx.beginPath();
    ctx.rect(panelX, contentTop, panelWidth, contentHeight);
    ctx.clip();

    // Draw sections
    ctx.textAlign = 'left';
    let y = contentTop + 10 + this.scrollY;
    const leftMargin = panelX + 18;
    const maxTextWidth = panelWidth - 36;

    // Calculate total content height for scroll clamping
    let totalHeight = 10;
    for (const section of SECTIONS) {
      totalHeight += 22 + section.lines.length * 16 + 14;
    }
    const minScroll = Math.min(0, -(totalHeight - contentHeight + 10));
    if (this.scrollY < minScroll) this.scrollY = minScroll;

    for (const section of SECTIONS) {
      // Section title
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = theme.ui.textPrimary;
      ctx.fillText(section.title, leftMargin, y);
      y += 6;

      // Underline
      ctx.strokeStyle = theme.ui.borderDim;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(leftMargin, y);
      ctx.lineTo(leftMargin + maxTextWidth, y);
      ctx.stroke();
      y += 14;

      // Lines
      ctx.font = '12px monospace';
      ctx.fillStyle = theme.ui.textSecondary;
      for (const line of section.lines) {
        ctx.fillText(line, leftMargin, y);
        y += 16;
      }

      y += 14; // gap between sections
    }

    // Scroll indicator if content overflows
    if (totalHeight > contentHeight) {
      const scrollFraction = -this.scrollY / (totalHeight - contentHeight);
      const indicatorHeight = Math.max(20, contentHeight * (contentHeight / totalHeight));
      const indicatorY = contentTop + scrollFraction * (contentHeight - indicatorHeight);

      ctx.fillStyle = theme.ui.borderDim;
      ctx.fillRect(panelX + panelWidth - 6, indicatorY, 3, indicatorHeight);
    }

    ctx.restore();
  }
}
