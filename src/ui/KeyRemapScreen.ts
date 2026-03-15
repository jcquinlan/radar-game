import type { Ability } from '../systems/AbilitySystem';
import { getTheme } from '../themes/theme';

const STORAGE_KEY = 'radar-game-keybindings';

export interface BindingEntry {
  id: string;
  name: string;
  description: string;
  key: string;
}

export class KeyRemapScreen {
  private visible = false;
  private listeningIndex: number | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private itemBounds: { x: number; y: number; width: number; height: number }[] = [];
  private extraBindings: BindingEntry[] = [];

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

  /** Register non-ability bindings (e.g. upgrades panel key) */
  addExtraBinding(entry: BindingEntry): void {
    this.extraBindings.push(entry);
  }

  getExtraBinding(id: string): BindingEntry | undefined {
    return this.extraBindings.find((b) => b.id === id);
  }

  /** Save all bindings (abilities + extras) to localStorage */
  save(abilities: Ability[]): void {
    const data: Record<string, string> = {};
    for (const a of abilities) {
      data[a.id] = a.keybind;
    }
    for (const b of this.extraBindings) {
      data[b.id] = b.key;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage unavailable (e.g. in tests) — silently skip
    }
  }

  /** Load bindings from localStorage and apply to abilities + extras */
  load(abilities: Ability[]): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Record<string, string>;
      for (const a of abilities) {
        if (data[a.id]) a.keybind = data[a.id];
      }
      for (const b of this.extraBindings) {
        if (data[b.id]) b.key = data[b.id];
      }
    } catch {
      // localStorage unavailable or corrupt — use defaults
    }
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

      // Don't allow remapping to reserved keys (only movement + K for this screen)
      const reserved = ['k', 'K', 'Escape', 'w', 'a', 's', 'd',
        'W', 'A', 'S', 'D', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (reserved.includes(e.key)) return;

      const key = e.key;
      const allBindings = this.getAllBindings(abilities);
      const currentBinding = allBindings[this.listeningIndex!];

      // Check for conflicts across all bindings
      const conflictIdx = allBindings.findIndex(
        (b, idx) => idx !== this.listeningIndex && b.key === key
      );
      if (conflictIdx >= 0) {
        // Swap
        this.setBindingKey(abilities, conflictIdx, currentBinding.key);
      }

      this.setBindingKey(abilities, this.listeningIndex!, key);
      this.listeningIndex = null;
      this.save(abilities);
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

    const allBindings = this.getAllBindings(abilities);

    const theme = getTheme();

    // Semi-transparent overlay
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const panelWidth = 360;
    const panelHeight = allBindings.length * 70 + 100;
    const panelX = (canvasWidth - panelWidth) / 2;
    const panelY = (canvasHeight - panelHeight) / 2;

    // Panel background
    ctx.fillStyle = theme.ui.panelBackgroundSolid;
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

    // Border
    ctx.strokeStyle = theme.ui.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    // Title
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = theme.ui.textPrimary;
    ctx.shadowColor = theme.ui.textPrimary;
    ctx.shadowBlur = 8;
    ctx.textAlign = 'center';
    ctx.fillText('KEY BINDINGS', panelX + panelWidth / 2, panelY + 30);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.font = '11px monospace';
    ctx.fillStyle = theme.ui.textSecondary;
    ctx.fillText('Click a binding to remap. Press K to close.', panelX + panelWidth / 2, panelY + 50);

    this.itemBounds = [];
    ctx.textAlign = 'left';

    for (let i = 0; i < allBindings.length; i++) {
      const binding = allBindings[i];
      const y = panelY + 70 + i * 70;
      const isListening = this.listeningIndex === i;

      const itemX = panelX + 20;
      const itemWidth = panelWidth - 40;
      const itemHeight = 55;

      this.itemBounds.push({ x: itemX, y, width: itemWidth, height: itemHeight });

      // Item background
      ctx.fillStyle = isListening ? theme.ui.highlight : theme.ui.highlightSubtle;
      ctx.fillRect(itemX, y, itemWidth, itemHeight);

      // Item border
      ctx.strokeStyle = isListening ? theme.ui.border : theme.ui.borderDim;
      ctx.lineWidth = 1;
      ctx.strokeRect(itemX, y, itemWidth, itemHeight);

      // Binding name
      ctx.font = '14px monospace';
      ctx.fillStyle = theme.ui.textPrimary;
      ctx.fillText(binding.name, itemX + 12, y + 22);

      // Description
      ctx.font = '10px monospace';
      ctx.fillStyle = theme.ui.textSecondary;
      ctx.fillText(binding.description, itemX + 12, y + 40);

      // Key binding box (right side)
      const keyBoxWidth = 60;
      const keyBoxHeight = 32;
      const keyBoxX = itemX + itemWidth - keyBoxWidth - 12;
      const keyBoxY = y + (itemHeight - keyBoxHeight) / 2;

      ctx.fillStyle = isListening ? theme.radar.dim : theme.radar.background;
      ctx.fillRect(keyBoxX, keyBoxY, keyBoxWidth, keyBoxHeight);

      ctx.strokeStyle = isListening ? theme.ui.border : theme.ui.borderDim;
      ctx.lineWidth = isListening ? 2 : 1;
      ctx.strokeRect(keyBoxX, keyBoxY, keyBoxWidth, keyBoxHeight);

      // Key text
      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = isListening ? theme.abilities.dash : theme.ui.textPrimary;
      ctx.textAlign = 'center';
      const displayKey = isListening ? '...' : this.formatKey(binding.key);
      ctx.fillText(displayKey, keyBoxX + keyBoxWidth / 2, keyBoxY + keyBoxHeight / 2 + 6);
      ctx.textAlign = 'left';
    }

    ctx.restore();
  }

  /** Merge ability bindings and extra bindings into a flat list */
  private getAllBindings(abilities: Ability[]): BindingEntry[] {
    const descriptions: Record<string, string> = {
      damage_blast: 'AoE damage to nearby enemies',
      heal_over_time: 'Heal over time',
      helper_drone: 'Spawn a helper drone',
      dash: 'Dash forward, rams enemies',
      homing_missile: 'Fire a homing missile at nearest enemy',
    };
    const abilityBindings: BindingEntry[] = abilities.map((a) => ({
      id: a.id,
      name: a.name,
      description: descriptions[a.id] || '',
      key: a.keybind,
    }));
    return [...abilityBindings, ...this.extraBindings];
  }

  /** Set a binding key by index into the merged list */
  private setBindingKey(abilities: Ability[], index: number, key: string): void {
    if (index < abilities.length) {
      abilities[index].keybind = key;
    } else {
      const extraIdx = index - abilities.length;
      this.extraBindings[extraIdx].key = key;
    }
  }

  private formatKey(key: string): string {
    if (key === ' ') return 'SPACE';
    if (key.length === 1) return key.toUpperCase();
    return key;
  }
}
