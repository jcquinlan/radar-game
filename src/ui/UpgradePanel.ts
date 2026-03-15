import { UpgradeSystem } from '../systems/UpgradeSystem';
import { Player } from '../entities/Player';
import { getTheme } from '../themes/theme';

export class UpgradePanel {
  private visible = false;
  private selectedIndex = 0;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private itemBounds: { x: number; y: number; width: number; height: number }[] = [];

  toggle(): void {
    this.visible = !this.visible;
  }

  isVisible(): boolean {
    return this.visible;
  }

  attach(canvas: HTMLCanvasElement, upgradeSystem: UpgradeSystem, player: Player): void {
    this.clickHandler = (e: MouseEvent) => {
      if (!this.visible) return;

      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      for (let i = 0; i < this.itemBounds.length; i++) {
        const b = this.itemBounds[i];
        if (mx >= b.x && mx <= b.x + b.width && my >= b.y && my <= b.y + b.height) {
          const upgrade = upgradeSystem.upgrades[i];
          upgradeSystem.purchase(upgrade.id, player);
          break;
        }
      }
    };

    canvas.addEventListener('click', this.clickHandler);
  }

  detach(canvas: HTMLCanvasElement): void {
    if (this.clickHandler) {
      canvas.removeEventListener('click', this.clickHandler);
      this.clickHandler = null;
    }
  }

  render(
    ctx: CanvasRenderingContext2D,
    upgradeSystem: UpgradeSystem,
    player: Player,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    if (!this.visible) return;

    const panelWidth = 300;
    const panelX = canvasWidth - panelWidth - 20;
    const panelY = 60;
    const itemHeight = 80;
    const padding = 12;

    const theme = getTheme();

    // Panel background
    ctx.save();
    ctx.fillStyle = theme.ui.panelBackground;
    ctx.fillRect(panelX, panelY, panelWidth, upgradeSystem.upgrades.length * itemHeight + padding * 2 + 30);

    // Title
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = theme.ui.textPrimary;
    ctx.shadowColor = theme.ui.textPrimary;
    ctx.shadowBlur = 5;
    ctx.fillText('UPGRADES', panelX + padding, panelY + 22);
    ctx.shadowBlur = 0;

    // Border
    ctx.strokeStyle = theme.ui.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelWidth, upgradeSystem.upgrades.length * itemHeight + padding * 2 + 30);

    this.itemBounds = [];

    for (let i = 0; i < upgradeSystem.upgrades.length; i++) {
      const upgrade = upgradeSystem.upgrades[i];
      const y = panelY + 35 + i * itemHeight;
      const canBuy = upgradeSystem.canPurchase(upgrade.id, player.energy);
      const maxed = upgrade.level >= upgrade.maxLevel;

      const itemY = y;
      this.itemBounds.push({
        x: panelX + padding,
        y: itemY,
        width: panelWidth - padding * 2,
        height: itemHeight - 5,
      });

      // Item background on hover possibility
      if (canBuy) {
        ctx.fillStyle = theme.ui.highlightSubtle;
        ctx.fillRect(panelX + padding, itemY, panelWidth - padding * 2, itemHeight - 5);
      }

      // Name
      ctx.font = '14px monospace';
      ctx.fillStyle = canBuy ? theme.ui.textPrimary : maxed ? theme.ui.maxedText : theme.ui.textDisabled;
      ctx.fillText(upgrade.name, panelX + padding + 4, y + 18);

      // Level bar
      const barX = panelX + padding + 4;
      const barY = y + 25;
      const barWidth = panelWidth - padding * 2 - 8;
      const barHeight = 8;

      ctx.fillStyle = theme.ui.barBackground;
      ctx.fillRect(barX, barY, barWidth, barHeight);

      const fillWidth = (upgrade.level / upgrade.maxLevel) * barWidth;
      ctx.fillStyle = maxed ? theme.ui.maxedText : theme.ui.textPrimary;
      ctx.fillRect(barX, barY, fillWidth, barHeight);

      ctx.strokeStyle = theme.ui.borderDim;
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barWidth, barHeight);

      // Level text
      ctx.font = '11px monospace';
      ctx.fillStyle = theme.ui.statsText;
      ctx.fillText(
        `Lv ${upgrade.level}/${upgrade.maxLevel}`,
        panelX + padding + 4,
        y + 50
      );

      // Cost
      if (!maxed) {
        const cost = upgradeSystem.getNextCost(upgrade.id);
        ctx.fillStyle = canBuy ? theme.ui.textPrimary : theme.ui.cooldownText;
        ctx.fillText(`Cost: ${cost} E`, panelX + panelWidth - padding - 90, y + 50);
      } else {
        ctx.fillStyle = theme.ui.maxedText;
        ctx.fillText('MAXED', panelX + panelWidth - padding - 60, y + 50);
      }

      // Description
      ctx.font = '10px monospace';
      ctx.fillStyle = theme.ui.labelText;
      ctx.fillText(upgrade.description, panelX + padding + 4, y + 65);
    }

    ctx.restore();
  }
}
