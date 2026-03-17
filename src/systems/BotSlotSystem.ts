export const enum SlotState {
  Ready = 0,
  Active = 1,
  Cooldown = 2,
}

export interface BotSlot {
  state: SlotState;
  cooldownTimer: number;
  /** Total cooldown duration assigned when this slot entered cooldown */
  cooldownDuration: number;
}

const DEFAULT_TOTAL_SLOTS = 5;
const DEFAULT_COOLDOWN = 8;

export class BotSlotSystem {
  private slots: BotSlot[] = [];
  private cooldownDuration = DEFAULT_COOLDOWN;

  constructor(totalSlots = DEFAULT_TOTAL_SLOTS) {
    for (let i = 0; i < totalSlots; i++) {
      this.slots.push(this.createReadySlot());
    }
  }

  private createReadySlot(): BotSlot {
    return { state: SlotState.Ready, cooldownTimer: 0, cooldownDuration: 0 };
  }

  /**
   * Find and acquire the first ready slot.
   * Returns the slot index, or -1 if none available.
   */
  acquireSlot(): number {
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i].state === SlotState.Ready) {
        this.slots[i].state = SlotState.Active;
        return i;
      }
    }
    return -1;
  }

  /**
   * Release a slot, putting it into cooldown.
   * Call this when a bot dies, expires, or despawns.
   */
  releaseSlot(index: number): void {
    if (index < 0 || index >= this.slots.length) return;
    const slot = this.slots[index];
    slot.state = SlotState.Cooldown;
    slot.cooldownTimer = this.cooldownDuration;
    slot.cooldownDuration = this.cooldownDuration;
  }

  /** Tick cooldown timers. Call every frame. */
  update(dt: number): void {
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot.state !== SlotState.Cooldown) continue;
      slot.cooldownTimer -= dt;
      if (slot.cooldownTimer <= 0) {
        slot.cooldownTimer = 0;
        slot.cooldownDuration = 0;
        slot.state = SlotState.Ready;
      }
    }
  }

  /** Set total number of slots. Adds new ready slots if increasing. */
  setTotalSlots(n: number): void {
    while (this.slots.length < n) {
      this.slots.push(this.createReadySlot());
    }
    // If reducing, truncate (removes from end)
    if (n < this.slots.length) {
      this.slots.length = n;
    }
  }

  /** Set the cooldown duration for future releases. */
  setCooldownDuration(seconds: number): void {
    this.cooldownDuration = seconds;
  }

  /** Number of slots currently in ready state. */
  getReadyCount(): number {
    let count = 0;
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i].state === SlotState.Ready) count++;
    }
    return count;
  }

  getTotalSlots(): number {
    return this.slots.length;
  }

  getSlots(): readonly BotSlot[] {
    return this.slots;
  }

  getCooldownDuration(): number {
    return this.cooldownDuration;
  }

  /** Reset all slots to ready state. Call on new run. */
  reset(): void {
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      slot.state = SlotState.Ready;
      slot.cooldownTimer = 0;
      slot.cooldownDuration = 0;
    }
  }
}
