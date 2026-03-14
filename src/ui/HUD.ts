import { Player } from '../entities/Player';
import { getThreatLevel } from '../world/World';
import type { Ability } from '../systems/AbilitySystem';

export class HUD {
  render(
    ctx: CanvasRenderingContext2D,
    player: Player,
    canvasWidth: number,
    abilities?: Ability[],
  ): void {
    const padding = 20;
    const barWidth = 200;
    const barHeight = 16;
    const y = padding;

    ctx.save();
    ctx.font = '14px monospace';

    // Health bar
    this.renderBar(
      ctx,
      padding,
      y,
      barWidth,
      barHeight,
      player.health / player.maxHealth,
      player.shieldActive ? '#00ffff' : '#00ff41',
      `HP: ${Math.ceil(player.health)}/${player.maxHealth}${player.shieldActive ? ' [SHIELD]' : ''}`
    );

    // Energy counter
    ctx.fillStyle = '#00ff41';
    ctx.shadowColor = '#00ff41';
    ctx.shadowBlur = 5;
    ctx.fillText(`Energy: ${Math.floor(player.energy)}`, padding, y + barHeight + 24);
    ctx.shadowBlur = 0;

    // Distance from origin
    const dist = Math.floor(Math.sqrt(player.x * player.x + player.y * player.y));
    ctx.fillStyle = '#557755';
    ctx.fillText(`RANGE: ${dist}m`, padding, y + barHeight + 44);

    // Threat level
    const threat = getThreatLevel(player.x, player.y);
    ctx.fillStyle = threat.color;
    ctx.shadowColor = threat.color;
    ctx.shadowBlur = 3;
    ctx.fillText(`THREAT: ${threat.label}`, padding, y + barHeight + 64);
    ctx.shadowBlur = 0;

    // Coordinates
    ctx.fillStyle = '#335533';
    ctx.font = '11px monospace';
    ctx.fillText(
      `POS: ${Math.floor(player.x)}, ${Math.floor(player.y)}`,
      padding,
      y + barHeight + 82
    );

    // Score (top right)
    ctx.font = '16px monospace';
    ctx.fillStyle = '#00ff41';
    ctx.shadowColor = '#00ff41';
    ctx.shadowBlur = 5;
    ctx.textAlign = 'right';
    ctx.fillText(`SCORE: ${Math.floor(player.score)}`, canvasWidth - padding, y + 16);
    ctx.shadowBlur = 0;

    ctx.font = '12px monospace';
    ctx.fillStyle = '#557755';
    ctx.fillText(`KILLS: ${player.kills}`, canvasWidth - padding, y + 34);

    const minutes = Math.floor(player.survivalTime / 60);
    const seconds = Math.floor(player.survivalTime % 60);
    ctx.fillText(
      `TIME: ${minutes}:${seconds.toString().padStart(2, '0')}`,
      canvasWidth - padding,
      y + 50
    );

    // Ability cooldown bars
    if (abilities) {
      const abilityBarWidth = 120;
      const abilityBarHeight = 12;
      const abilityY = y + barHeight + 100;

      ctx.textAlign = 'left';
      ctx.font = '10px monospace';

      for (let i = 0; i < abilities.length; i++) {
        const ability = abilities[i];
        const ay = abilityY + i * (abilityBarHeight + 6);
        const ready = ability.cooldownRemaining <= 0;
        const fill = ready ? 1 : 1 - ability.cooldownRemaining / ability.cooldown;
        const color = ready ? '#00ff41' : '#335533';

        this.renderBar(
          ctx,
          padding,
          ay,
          abilityBarWidth,
          abilityBarHeight,
          fill,
          color,
          `[${ability.keybind}] ${ability.name}${ready ? '' : ` ${Math.ceil(ability.cooldownRemaining)}s`}`
        );

        // Show active indicator for duration abilities
        if (ability.active && ability.durationRemaining > 0) {
          ctx.fillStyle = '#00ffff';
          ctx.fillText('ACTIVE', padding + abilityBarWidth + 6, ay + abilityBarHeight - 2);
        }
      }
    }

    ctx.restore();
  }

  private renderBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    fill: number,
    color: string,
    label: string
  ): void {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x, y, width, height);

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(x, y, width * Math.max(0, Math.min(1, fill)), height);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x + 4, y + height - 3);
  }
}
