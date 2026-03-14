import type { Ability } from '../systems/AbilitySystem';

const ICON_COLORS: Record<string, string> = {
  damage_blast: '#ff4141',
  heal_over_time: '#00ff41',
  helper_drone: '#00ffff',
  dash: '#ffff00',
  homing_missile: '#ff8800',
};

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

    ctx.save();

    for (let i = 0; i < abilities.length; i++) {
      const ability = abilities[i];
      const x = startX + i * (boxSize + gap);
      const ready = ability.cooldownRemaining <= 0;
      const isActive = ability.active && ability.durationRemaining > 0;
      const cooldownFill = ready ? 1 : 1 - ability.cooldownRemaining / ability.cooldown;
      const color = ICON_COLORS[ability.id] || '#00ff41';

      // Background
      ctx.fillStyle = 'rgba(0, 10, 0, 0.85)';
      ctx.fillRect(x, y, boxSize, boxSize);

      // Cooldown fill (fills from bottom up)
      if (!ready) {
        const fillHeight = boxSize * cooldownFill;
        ctx.fillStyle = 'rgba(0, 255, 65, 0.08)';
        ctx.fillRect(x, y + boxSize - fillHeight, boxSize, fillHeight);
      }

      // Active glow
      if (isActive) {
        ctx.fillStyle = `${color}22`;
        ctx.fillRect(x, y, boxSize, boxSize);
      }

      // Border
      ctx.strokeStyle = ready ? color : '#335533';
      ctx.lineWidth = ready ? 2 : 1;
      if (isActive) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
      }
      ctx.strokeRect(x, y, boxSize, boxSize);

      // Keybind — large and prominent
      const keyLabel = ability.keybind === ' ' ? 'SPC' : ability.keybind.toUpperCase();
      ctx.font = 'bold 24px monospace';
      ctx.fillStyle = ready || isActive ? color : '#335533';
      ctx.textAlign = 'center';
      ctx.fillText(keyLabel, x + boxSize / 2, y + 30);

      // Ability name (small, below keybind)
      ctx.font = '9px monospace';
      ctx.fillStyle = '#557755';
      ctx.fillText(ability.name, x + boxSize / 2, y + 44);

      // Status text
      if (!ready && !isActive) {
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#663333';
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
