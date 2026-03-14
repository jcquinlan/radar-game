import { Resource } from '../entities/Entity';
import { Player } from '../entities/Player';

// Tuning constants — exported for tests and future adjustment
export const SPRING_K = 1.5;
export const SPRING_DAMPING = 0.5;
export const SPRING_REST_LENGTH = 35;
export const TOW_FRICTION = 1.5;
export const REPULSION_RADIUS = 20;
export const REPULSION_FORCE = 80;
export const MAX_TOWED = 8;
export const FADE_OUT_DURATION = 0.3;

export interface TowedItem {
  resource: Resource;
  vx: number;
  vy: number;
  chainIndex: number;
  fadeOut: number | null; // remaining fade time, or null if not fading
}

export class TowRopeSystem {
  private items: TowedItem[] = [];

  collect(resource: Resource, player: Player): void {
    // If already towed, ignore
    if (resource.towedByPlayer) return;

    // Mark resource as towed
    resource.towedByPlayer = true;
    resource.towVx = 0;
    resource.towVy = 0;

    const chainIndex = this.items.length;
    resource.towChainIndex = chainIndex;

    const item: TowedItem = {
      resource,
      vx: 0,
      vy: 0,
      chainIndex,
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

  update(player: Player, dt: number): void {
    // Apply spring forces along the chain
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const res = item.resource;

      // Determine anchor position (player for first, previous item for rest)
      let anchorX: number;
      let anchorY: number;
      if (i === 0) {
        anchorX = player.x;
        anchorY = player.y;
      } else {
        anchorX = this.items[i - 1].resource.x;
        anchorY = this.items[i - 1].resource.y;
      }

      // Spring force (Hooke's law)
      const dx = anchorX - res.x;
      const dy = anchorY - res.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0) {
        const stretch = dist - SPRING_REST_LENGTH;
        const fx = (dx / dist) * SPRING_K * stretch;
        const fy = (dy / dist) * SPRING_K * stretch;

        // Damping force (relative velocity toward anchor)
        let anchorVx = 0;
        let anchorVy = 0;
        if (i === 0) {
          anchorVx = player.vx;
          anchorVy = player.vy;
        } else {
          anchorVx = this.items[i - 1].vx;
          anchorVy = this.items[i - 1].vy;
        }
        const relVx = anchorVx - item.vx;
        const relVy = anchorVy - item.vy;
        const dampX = relVx * SPRING_DAMPING;
        const dampY = relVy * SPRING_DAMPING;

        item.vx += (fx + dampX) * dt;
        item.vy += (fy + dampY) * dt;
      }
    }

    // Inter-item repulsion
    for (let i = 0; i < this.items.length; i++) {
      for (let j = i + 1; j < this.items.length; j++) {
        const a = this.items[i];
        const b = this.items[j];
        const dx = b.resource.x - a.resource.x;
        const dy = b.resource.y - a.resource.y;
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
      item.resource.x += item.vx * dt;
      item.resource.y += item.vy * dt;

      // Sync back to resource tow fields
      item.resource.towVx = item.vx;
      item.resource.towVy = item.vy;
    }

    // Process fade-outs
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (item.fadeOut !== null) {
        item.fadeOut -= dt;
        if (item.fadeOut <= 0) {
          item.resource.towedByPlayer = false;
          item.resource.active = false;
          this.items.splice(i, 1);
        }
      }
    }

    // Re-index chain
    for (let i = 0; i < this.items.length; i++) {
      this.items[i].chainIndex = i;
      this.items[i].resource.towChainIndex = i;
    }
  }

  clear(): void {
    for (const item of this.items) {
      item.resource.towedByPlayer = false;
      item.resource.active = false;
    }
    this.items.length = 0;
  }

  getTowedItems(): TowedItem[] {
    return this.items;
  }
}
