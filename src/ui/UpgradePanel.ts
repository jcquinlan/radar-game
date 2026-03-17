import { HomebaseUpgradeSystem, BuildingCategory } from '../systems/HomebaseUpgradeSystem';
import { SaveData } from '../systems/SaveSystem';
import { getTheme } from '../themes/theme';

const TABS: { id: BuildingCategory; label: string; color: string }[] = [
  { id: 'player', label: 'PLAYER', color: '#00ff41' },
  { id: 'mining', label: 'MINING', color: '#ffaa00' },
  { id: 'combat', label: 'COMBAT', color: '#ff4444' },
];

export class UpgradePanel {
  private visible = false;
  private activeTab: BuildingCategory = 'player';
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private itemBounds: { x: number; y: number; width: number; height: number; upgradeId: string }[] = [];
  private tabBounds: { x: number; y: number; width: number; height: number; tab: BuildingCategory }[] = [];

  toggle(): void {
    this.visible = !this.visible;
  }

  isVisible(): boolean {
    return this.visible;
  }

  setTab(tab: BuildingCategory): void {
    this.activeTab = tab;
  }

  attach(
    canvas: HTMLCanvasElement,
    upgradeSystem: HomebaseUpgradeSystem,
    saveData: SaveData,
    onPurchase?: () => void,
  ): void {
    this.clickHandler = (e: MouseEvent) => {
      if (!this.visible) return;

      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Check tab clicks
      for (let i = 0; i < this.tabBounds.length; i++) {
        const b = this.tabBounds[i];
        if (mx >= b.x && mx <= b.x + b.width && my >= b.y && my <= b.y + b.height) {
          this.activeTab = b.tab;
          return;
        }
      }

      // Check upgrade item clicks
      for (let i = 0; i < this.itemBounds.length; i++) {
        const b = this.itemBounds[i];
        if (mx >= b.x && mx <= b.x + b.width && my >= b.y && my <= b.y + b.height) {
          if (upgradeSystem.purchase(b.upgradeId, saveData)) {
            if (onPurchase) onPurchase();
          }
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
    upgradeSystem: HomebaseUpgradeSystem,
    saveData: SaveData,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    if (!this.visible) return;

    const upgrades = upgradeSystem.getUpgradesForBuilding(this.activeTab);
    const panelWidth = 320;
    const panelX = canvasWidth - panelWidth - 20;
    const panelY = 60;
    const tabHeight = 32;
    const itemHeight = 80;
    const padding = 12;
    const panelHeight = tabHeight + upgrades.length * itemHeight + padding * 2 + 40;

    const theme = getTheme();

    ctx.save();

    // Panel background
    ctx.fillStyle = theme.ui.panelBackground;
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

    // Border
    ctx.strokeStyle = theme.ui.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    // Title
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = theme.ui.textPrimary;
    ctx.shadowColor = theme.ui.textPrimary;
    ctx.shadowBlur = 5;
    ctx.fillText('HOMEBASE UPGRADES', panelX + padding, panelY + 20);
    ctx.shadowBlur = 0;

    // Currency display
    ctx.font = '11px monospace';
    ctx.fillStyle = '#ffaa00';
    ctx.textAlign = 'right';
    ctx.fillText(`${saveData.currency} CR`, panelX + panelWidth - padding, panelY + 20);
    ctx.textAlign = 'left';

    // Tabs
    this.tabBounds = [];
    const tabY = panelY + 30;
    const tabWidth = Math.floor((panelWidth - padding * 2) / TABS.length);

    for (let i = 0; i < TABS.length; i++) {
      const tab = TABS[i];
      const tx = panelX + padding + i * tabWidth;
      const isActive = tab.id === this.activeTab;

      this.tabBounds.push({
        x: tx,
        y: tabY,
        width: tabWidth,
        height: tabHeight,
        tab: tab.id,
      });

      // Tab background
      ctx.fillStyle = isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)';
      ctx.fillRect(tx, tabY, tabWidth, tabHeight);

      // Tab border (bottom highlight for active)
      if (isActive) {
        ctx.fillStyle = tab.color;
        ctx.fillRect(tx, tabY + tabHeight - 2, tabWidth, 2);
      }

      // Tab label
      ctx.font = isActive ? 'bold 11px monospace' : '11px monospace';
      ctx.fillStyle = isActive ? tab.color : theme.ui.textDisabled;
      ctx.textAlign = 'center';
      ctx.fillText(tab.label, tx + tabWidth / 2, tabY + 20);
      ctx.textAlign = 'left';
    }

    // Upgrade items
    this.itemBounds = [];
    const listY = tabY + tabHeight + 8;

    for (let i = 0; i < upgrades.length; i++) {
      const upgrade = upgrades[i];
      const y = listY + i * itemHeight;
      const canBuy = upgradeSystem.canPurchase(upgrade.id, saveData.currency);
      const maxed = upgrade.level >= upgrade.maxLevel;

      this.itemBounds.push({
        x: panelX + padding,
        y,
        width: panelWidth - padding * 2,
        height: itemHeight - 5,
        upgradeId: upgrade.id,
      });

      // Item background for purchasable
      if (canBuy) {
        ctx.fillStyle = theme.ui.highlightSubtle;
        ctx.fillRect(panelX + padding, y, panelWidth - padding * 2, itemHeight - 5);
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
      ctx.fillText(`Lv ${upgrade.level}/${upgrade.maxLevel}`, panelX + padding + 4, y + 50);

      // Cost
      if (!maxed) {
        const cost = upgradeSystem.getNextCost(upgrade.id);
        ctx.fillStyle = canBuy ? theme.ui.textPrimary : theme.ui.cooldownText;
        ctx.fillText(`Cost: ${cost} CR`, panelX + panelWidth - padding - 100, y + 50);
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
