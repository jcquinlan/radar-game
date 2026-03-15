import type { Ability } from '../systems/AbilitySystem';
import { getTheme } from '../themes/theme';

export class AbilityBar {
  render(
    ctx: CanvasRenderingContext2D,
    abilities: Ability[],
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    const boxSize = 64;
    const gap = 10;
    const totalWidth = abilities.length * boxSize + (abilities.length - 1) * gap;
    const startX = (canvasWidth - totalWidth) / 2;
    const y = canvasHeight - boxSize - 16;

    const theme = getTheme();
    const ICON_COLORS = theme.abilities as Record<string, string>;

    ctx.save();

    for (let i = 0; i < abilities.length; i++) {
      const ability = abilities[i];
      const x = startX + i * (boxSize + gap);
      const ready = ability.charges > 0;
      const isActive = ability.active && ability.durationRemaining > 0;
      const cooldownFill = ready ? 1 : 1 - ability.cooldownRemaining / ability.cooldown;
      const color = ICON_COLORS[ability.id] || theme.ui.textPrimary;

      // Background
      ctx.fillStyle = theme.ui.panelBackground;
      ctx.fillRect(x, y, boxSize, boxSize);

      // Cooldown fill (fills from bottom up)
      if (!ready) {
        const fillHeight = boxSize * cooldownFill;
        ctx.fillStyle = theme.ui.highlightSubtle;
        ctx.fillRect(x, y + boxSize - fillHeight, boxSize, fillHeight);
      }

      // Active glow
      if (isActive) {
        ctx.fillStyle = `${color}22`;
        ctx.fillRect(x, y, boxSize, boxSize);
      }

      // Border
      ctx.strokeStyle = ready ? color : theme.ui.borderDim;
      ctx.lineWidth = ready ? 2 : 1;
      if (isActive) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
      }
      ctx.strokeRect(x, y, boxSize, boxSize);

      // Keybind — large and prominent
      const keyLabel = ability.keybind === ' ' ? 'SPC' : ability.keybind.toUpperCase();
      ctx.font = 'bold 24px monospace';
      ctx.fillStyle = ready || isActive ? color : theme.ui.textDisabled;
      ctx.textAlign = 'center';
      ctx.fillText(keyLabel, x + boxSize / 2, y + 30);

      // Ability name (small, below keybind)
      ctx.font = '9px monospace';
      ctx.fillStyle = theme.ui.labelText;
      ctx.fillText(ability.name, x + boxSize / 2, y + 44);

      // Charge indicators (for multi-charge abilities)
      if (ability.maxCharges > 1) {
        const dotY = y + 50;
        const dotSpacing = 10;
        const dotsWidth = (ability.maxCharges - 1) * dotSpacing;
        const dotStartX = x + boxSize / 2 - dotsWidth / 2;
        for (let c = 0; c < ability.maxCharges; c++) {
          const dotX = dotStartX + c * dotSpacing;
          ctx.beginPath();
          ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
          ctx.fillStyle = c < ability.charges ? color : theme.ui.barBackground;
          ctx.fill();
        }
      }

      // Status text
      if (!ready && !isActive) {
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = theme.ui.cooldownText;
        ctx.fillText(
          `${Math.ceil(ability.cooldownRemaining)}s`,
          x + boxSize / 2,
          y + boxSize - 8,
        );
      } else if (isActive) {
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = color;
        ctx.fillText(
          `${Math.ceil(ability.durationRemaining)}s`,
          x + boxSize / 2,
          y + boxSize - 8,
        );
      }
    }

    ctx.textAlign = 'left';
    ctx.restore();
  }
}
