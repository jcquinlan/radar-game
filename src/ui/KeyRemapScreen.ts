import type { Ability } from '../systems/AbilitySystem';

export class KeyRemapScreen {
  private visible = false;
  private listeningIndex: number | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private itemBounds: { x: number; y: number; width: number; height: number }[] = [];

  toggle(): void {
    this.visible = !this.visible;
    this.listeningIndex = null;
  }

  isVisible(): boolean {
    return this.visible;
  }

  isListening(): boolean {
    return this.listeningIndex !== null;
  }

  attach(canvas: HTMLCanvasElement, abilities: Ability[]): void {
    this.clickHandler = (e: MouseEvent) => {
      if (!this.visible) return;

      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      for (let i = 0; i < this.itemBounds.length; i++) {
        const b = this.itemBounds[i];
        if (mx >= b.x && mx <= b.x + b.width && my >= b.y && my <= b.y + b.height) {
          this.listeningIndex = i;
          return;
        }
      }

      // Clicked outside items — cancel listening
      this.listeningIndex = null;
    };

    this.keyHandler = (e: KeyboardEvent) => {
      if (!this.visible || this.listeningIndex === null) return;

      // Don't allow remapping to reserved keys
      const reserved = ['e', 'E', 'k', 'K', 'Escape', 'w', 'a', 's', 'd',
        'W', 'A', 'S', 'D', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (reserved.includes(e.key)) return;

      const key = e.key;

      // Check for conflicts with other abilities
      const conflictIdx = abilities.findIndex(
        (a, idx) => idx !== this.listeningIndex && a.keybind === key
      );
      if (conflictIdx >= 0) {
        // Swap: give the conflicting ability the old key
        abilities[conflictIdx].keybind = abilities[this.listeningIndex!].keybind;
      }

      abilities[this.listeningIndex!].keybind = key;
      this.listeningIndex = null;
      e.preventDefault();
      e.stopPropagation();
    };

    canvas.addEventListener('click', this.clickHandler);
    window.addEventListener('keydown', this.keyHandler, true);
  }

  detach(canvas: HTMLCanvasElement): void {
    if (this.clickHandler) {
      canvas.removeEventListener('click', this.clickHandler);
      this.clickHandler = null;
    }
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler, true);
      this.keyHandler = null;
    }
  }

  render(
    ctx: CanvasRenderingContext2D,
    abilities: Ability[],
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    if (!this.visible) return;

    // Semi-transparent overlay
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const panelWidth = 360;
    const panelHeight = abilities.length * 70 + 100;
    const panelX = (canvasWidth - panelWidth) / 2;
    const panelY = (canvasHeight - panelHeight) / 2;

    // Panel background
    ctx.fillStyle = 'rgba(0, 15, 0, 0.95)';
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

    // Border
    ctx.strokeStyle = '#00ff41';
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    // Title
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#00ff41';
    ctx.shadowColor = '#00ff41';
    ctx.shadowBlur = 8;
    ctx.textAlign = 'center';
    ctx.fillText('KEY BINDINGS', panelX + panelWidth / 2, panelY + 30);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.font = '11px monospace';
    ctx.fillStyle = '#557755';
    ctx.fillText('Click a binding to remap. Press K to close.', panelX + panelWidth / 2, panelY + 50);

    this.itemBounds = [];
    ctx.textAlign = 'left';

    for (let i = 0; i < abilities.length; i++) {
      const ability = abilities[i];
      const y = panelY + 70 + i * 70;
      const isListening = this.listeningIndex === i;

      const itemX = panelX + 20;
      const itemWidth = panelWidth - 40;
      const itemHeight = 55;

      this.itemBounds.push({ x: itemX, y, width: itemWidth, height: itemHeight });

      // Item background
      ctx.fillStyle = isListening ? 'rgba(0, 255, 65, 0.15)' : 'rgba(0, 255, 65, 0.03)';
      ctx.fillRect(itemX, y, itemWidth, itemHeight);

      // Item border
      ctx.strokeStyle = isListening ? '#00ff41' : '#335533';
      ctx.lineWidth = 1;
      ctx.strokeRect(itemX, y, itemWidth, itemHeight);

      // Ability name
      ctx.font = '14px monospace';
      ctx.fillStyle = '#00ff41';
      ctx.fillText(ability.name, itemX + 12, y + 22);

      // Ability description
      ctx.font = '10px monospace';
      ctx.fillStyle = '#557755';
      const descriptions: Record<string, string> = {
        damage_blast: 'AoE damage to nearby enemies',
        heal_over_time: 'Heal over time',
        helper_drone: 'Spawn a helper drone',
        dash: 'Speed burst in current direction',
      };
      ctx.fillText(descriptions[ability.id] || '', itemX + 12, y + 40);

      // Key binding box (right side)
      const keyBoxWidth = 60;
      const keyBoxHeight = 32;
      const keyBoxX = itemX + itemWidth - keyBoxWidth - 12;
      const keyBoxY = y + (itemHeight - keyBoxHeight) / 2;

      ctx.fillStyle = isListening ? '#002200' : '#0a0a0a';
      ctx.fillRect(keyBoxX, keyBoxY, keyBoxWidth, keyBoxHeight);

      ctx.strokeStyle = isListening ? '#00ff41' : '#335533';
      ctx.lineWidth = isListening ? 2 : 1;
      ctx.strokeRect(keyBoxX, keyBoxY, keyBoxWidth, keyBoxHeight);

      // Key text
      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = isListening ? '#ffff00' : '#00ff41';
      ctx.textAlign = 'center';
      const displayKey = isListening ? '...' : this.formatKey(ability.keybind);
      ctx.fillText(displayKey, keyBoxX + keyBoxWidth / 2, keyBoxY + keyBoxHeight / 2 + 6);
      ctx.textAlign = 'left';
    }

    ctx.restore();
  }

  private formatKey(key: string): string {
    if (key === ' ') return 'SPACE';
    if (key.length === 1) return key.toUpperCase();
    return key;
  }
}
