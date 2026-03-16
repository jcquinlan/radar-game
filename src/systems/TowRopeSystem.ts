import { Salvage, Dropoff, HomeBase } from '../entities/Entity';
import { Player } from '../entities/Player';

// Tuning constants — exported for tests and future adjustment
export const SPRING_K = 1.2;
export const SPRING_DAMPING = 0.25;
export const TOW_FRICTION = 0.8;
export const REPULSION_RADIUS = 20;
export const REPULSION_FORCE = 80;
export const MAX_TOWED = 8;
export const FADE_OUT_DURATION = 0.3;
/** How close the player must be to pick up salvage (px) */
export const PICKUP_RADIUS = 25;

export interface TowedItem {
  salvage: Salvage;
  vx: number;
  vy: number;
  fadeOut: number | null; // remaining fade time, or null if not fading
}

export class TowRopeSystem {
  private items: TowedItem[] = [];

  collect(salvage: Salvage): void {
    // If already towed, ignore
    if (salvage.towedByPlayer) return;

    // Mark as towed
    salvage.towedByPlayer = true;
    salvage.towVx = 0;
    salvage.towVy = 0;

    const item: TowedItem = {
      salvage,
      vx: 0,
      vy: 0,
      fadeOut: null,
    };

    this.items.push(item);

    // If over max, start fading the oldest non-fading item
    if (this.items.length > MAX_TOWED) {
      const oldest = this.items.find(i => i.fadeOut === null);
      if (oldest) {
        oldest.fadeOut = FADE_OUT_DURATION;
      }
    }
  }

  /** Check all salvage entities for proximity pickup */
  checkPickups(entities: readonly { type: string; active: boolean; x: number; y: number }[], player: Player): Salvage[] {
    const collected: Salvage[] = [];
    for (const entity of entities) {
      if (!entity.active || entity.type !== 'salvage') continue;
      const salvage = entity as Salvage;
      if (salvage.towedByPlayer) continue;
      const dx = salvage.x - player.x;
      const dy = salvage.y - player.y;
      if (dx * dx + dy * dy < PICKUP_RADIUS * PICKUP_RADIUS) {
        this.collect(salvage);
        collected.push(salvage);
      }
    }
    return collected;
  }

  update(player: Player, dt: number): void {
    // Hub-and-spoke: every item is anchored to the player directly
    for (const item of this.items) {
      const sal = item.salvage;

      // Spring force toward player (Hooke's law with per-item rope length)
      const dx = player.x - sal.x;
      const dy = player.y - sal.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0) {
        const stretch = dist - sal.ropeLength;
        const fx = (dx / dist) * SPRING_K * stretch;
        const fy = (dy / dist) * SPRING_K * stretch;

        // Damping force (relative velocity toward player)
        const relVx = player.vx - item.vx;
        const relVy = player.vy - item.vy;
        const dampX = relVx * SPRING_DAMPING;
        const dampY = relVy * SPRING_DAMPING;

        item.vx += (fx + dampX) * dt;
        item.vy += (fy + dampY) * dt;
      }
    }

    // Inter-item repulsion (keeps items from bunching)
    for (let i = 0; i < this.items.length; i++) {
      for (let j = i + 1; j < this.items.length; j++) {
        const a = this.items[i];
        const b = this.items[j];
        const dx = b.salvage.x - a.salvage.x;
        const dy = b.salvage.y - a.salvage.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0 && dist < REPULSION_RADIUS) {
          const overlap = REPULSION_RADIUS - dist;
          const pushX = (dx / dist) * overlap * REPULSION_FORCE * dt;
          const pushY = (dy / dist) * overlap * REPULSION_FORCE * dt;
          a.vx -= pushX * 0.5;
          a.vy -= pushY * 0.5;
          b.vx += pushX * 0.5;
          b.vy += pushY * 0.5;
        }
      }
    }

    // Apply friction and update positions
    const frictionDecay = Math.exp(-TOW_FRICTION * dt);
    for (const item of this.items) {
      item.vx *= frictionDecay;
      item.vy *= frictionDecay;
      item.salvage.x += item.vx * dt;
      item.salvage.y += item.vy * dt;

      // Sync back to salvage fields
      item.salvage.towVx = item.vx;
      item.salvage.towVy = item.vy;
    }

    // Remove destroyed salvage (hp <= 0 or deactivated by combat system)
    // and process fade-outs
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];

      // Destroyed by enemy damage
      if (!item.salvage.active || item.salvage.hp <= 0) {
        item.salvage.towedByPlayer = false;
        this.items.splice(i, 1);
        continue;
      }

      if (item.fadeOut !== null) {
        item.fadeOut -= dt;
        if (item.fadeOut <= 0) {
          item.salvage.towedByPlayer = false;
          item.salvage.active = false;
          this.items.splice(i, 1);
        }
      }
    }
  }

  clear(): void {
    for (const item of this.items) {
      item.salvage.towedByPlayer = false;
      item.salvage.active = false;
    }
    this.items.length = 0;
  }

  /** Check if any towed salvage has entered a dropoff zone. Returns deposited items with their dropoff. */
  checkDropoffs(entities: readonly { type: string; active: boolean; x: number; y: number }[]): Array<{ salvage: Salvage; dropoff: Dropoff }> {
    const deposited: Array<{ salvage: Salvage; dropoff: Dropoff }> = [];

    for (const entity of entities) {
      if (!entity.active || entity.type !== 'dropoff') continue;
      const dropoff = entity as Dropoff;

      for (let i = this.items.length - 1; i >= 0; i--) {
        const item = this.items[i];
        if (item.fadeOut !== null) continue; // Already fading

        const dx = item.salvage.x - dropoff.x;
        const dy = item.salvage.y - dropoff.y;
        if (dx * dx + dy * dy < dropoff.radius * dropoff.radius) {
          // Salvage entered the dropoff zone — deposit it
          deposited.push({ salvage: item.salvage, dropoff });
          item.salvage.towedByPlayer = false;
          item.salvage.active = false;
          this.items.splice(i, 1);
        }
      }
    }

    return deposited;
  }

  /** Energy reward per salvage item deposited at the home base */
  static readonly HOME_DEPOSIT_REWARD = 50;

  /** Check if any towed salvage has entered the home base radius. Returns deposited salvage items. */
  checkHomeDeposit(homeBase: HomeBase): Salvage[] {
    const deposited: Salvage[] = [];

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (item.fadeOut !== null) continue; // Already fading

      const dx = item.salvage.x - homeBase.x;
      const dy = item.salvage.y - homeBase.y;
      if (dx * dx + dy * dy < homeBase.radius * homeBase.radius) {
        deposited.push(item.salvage);
        item.salvage.towedByPlayer = false;
        item.salvage.active = false;
        this.items.splice(i, 1);
      }
    }

    return deposited;
  }

  getTowedItems(): TowedItem[] {
    return this.items;
  }
}
