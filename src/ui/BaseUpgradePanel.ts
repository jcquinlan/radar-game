import { SaveData } from '../systems/SaveData';
import {
  BASE_UPGRADES,
  getBaseUpgradeLevel,
  getBaseUpgradeCost,
  purchaseBaseUpgrade,
} from '../systems/BaseUpgradeSystem';

export interface BaseUpgradePanelBounds {
  upgradeBounds: Array<{ x: number; y: number; width: number; height: number }>;
}

/**
 * Renders the persistent base upgrade panel (used on main menu).
 * Returns the bounds of each upgrade button for click detection.
 */
export function renderBaseUpgradePanel(
  ctx: CanvasRenderingContext2D,
  saveData: SaveData,
  canvasWidth: number,
  canvasHeight: number,
): BaseUpgradePanelBounds {
  const panelWidth = 320;
  const panelX = canvasWidth - panelWidth - 30;
  const panelY = 80;
  const itemHeight = 64;
  const padding = 12;
  const panelHeight = BASE_UPGRADES.length * itemHeight + padding * 2 + 40;

  const bounds: BaseUpgradePanelBounds = { upgradeBounds: [] };

  ctx.save();

  // Panel background
  ctx.fillStyle = 'rgba(10, 20, 10, 0.85)';
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

  // Panel border
  ctx.strokeStyle = '#00ff41';
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

  // Title
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = '#00ff41';
  ctx.textAlign = 'left';
  ctx.fillText('BASE UPGRADES', panelX + padding, panelY + 22);

  // Currency display
  ctx.font = '13px monospace';
  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.floor(saveData.currency)} CR`, panelX + panelWidth - padding, panelY + 22);

  // Upgrade items
  for (let i = 0; i < BASE_UPGRADES.length; i++) {
    const upgrade = BASE_UPGRADES[i];
    const currentLevel = getBaseUpgradeLevel(saveData, upgrade.id);
    const cost = getBaseUpgradeCost(saveData, upgrade.id);
    const maxed = currentLevel >= upgrade.maxLevel;
    const canBuy = cost !== null && saveData.currency >= cost;

    const itemY = panelY + 35 + i * itemHeight;
    const itemX = panelX + padding;
    const itemW = panelWidth - padding * 2;

    bounds.upgradeBounds.push({ x: itemX, y: itemY, width: itemW, height: itemHeight - 4 });

    // Highlight if affordable
    if (canBuy) {
      ctx.fillStyle = 'rgba(0, 255, 65, 0.06)';
      ctx.fillRect(itemX, itemY, itemW, itemHeight - 4);
    }

    // Name
    ctx.font = '13px monospace';
    ctx.fillStyle = canBuy ? '#00ff41' : maxed ? '#ffd700' : '#556655';
    ctx.textAlign = 'left';
    ctx.fillText(upgrade.name, itemX + 4, itemY + 16);

    // Level bar
    const barX = itemX + 4;
    const barY = itemY + 22;
    const barWidth = itemW - 8;
    const barHeight = 6;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const fillWidth = (currentLevel / upgrade.maxLevel) * barWidth;
    ctx.fillStyle = maxed ? '#ffd700' : '#00ff41';
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Level text
    ctx.font = '11px monospace';
    ctx.fillStyle = '#88aa88';
    ctx.textAlign = 'left';
    ctx.fillText(`Lv ${currentLevel}/${upgrade.maxLevel}`, itemX + 4, itemY + 42);

    // Cost or MAXED
    ctx.textAlign = 'right';
    if (maxed) {
      ctx.fillStyle = '#ffd700';
      ctx.fillText('MAXED', itemX + itemW - 4, itemY + 42);
    } else if (cost !== null) {
      ctx.fillStyle = canBuy ? '#ffd700' : '#556655';
      ctx.fillText(`${cost} CR`, itemX + itemW - 4, itemY + 42);
    }

    // Description
    ctx.font = '10px monospace';
    ctx.fillStyle = '#556655';
    ctx.textAlign = 'left';
    ctx.fillText(upgrade.description, itemX + 4, itemY + 55);
  }

  ctx.restore();

  return bounds;
}

/** Handle a click on the base upgrade panel. Returns true if an upgrade was purchased. */
export function handleBaseUpgradeClick(
  mx: number,
  my: number,
  bounds: BaseUpgradePanelBounds,
  saveData: SaveData,
): boolean {
  for (let i = 0; i < bounds.upgradeBounds.length; i++) {
    const b = bounds.upgradeBounds[i];
    if (mx >= b.x && mx <= b.x + b.width && my >= b.y && my <= b.y + b.height) {
      const upgrade = BASE_UPGRADES[i];
      return purchaseBaseUpgrade(saveData, upgrade.id);
    }
  }
  return false;
}
