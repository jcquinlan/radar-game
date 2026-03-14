/** Minimum speed (px/s) for an entity to leave a trail */
const SPEED_THRESHOLD = 40;
/** Maximum trail points stored per entity */
const MAX_TRAIL_LENGTH = 12;
/** Seconds between recording trail points */
const SAMPLE_INTERVAL = 0.025;

interface TrailPoint {
  x: number;
  y: number;
}

interface TrailEntry {
  points: TrailPoint[];
  color: string;
  timer: number;
}

export class MotionTrail {
  private trails = new Map<string, TrailEntry>();

  /**
   * Record a position for a tracked entity.
   * Call once per frame for each entity that should potentially leave a trail.
   */
  track(id: string, x: number, y: number, vx: number, vy: number, color: string, dt: number): void {
    const speed = Math.sqrt(vx * vx + vy * vy);

    let entry = this.trails.get(id);
    if (!entry) {
      entry = { points: [], color, timer: 0 };
      this.trails.set(id, entry);
    }

    entry.color = color;
    entry.timer += dt;

    if (speed < SPEED_THRESHOLD) {
      // Below threshold — let trail fade out naturally
      return;
    }

    if (entry.timer >= SAMPLE_INTERVAL) {
      entry.timer = 0;
      entry.points.push({ x, y });
      if (entry.points.length > MAX_TRAIL_LENGTH) {
        entry.points.shift();
      }
    }
  }

  /** Remove trail data for entities that are gone */
  prune(activeIds: Set<string>): void {
    for (const id of this.trails.keys()) {
      if (!activeIds.has(id)) {
        this.trails.delete(id);
      }
    }
  }

  /**
   * Render all trails. Positions are in world space — caller provides
   * the player offset so we can convert to screen space.
   * Must be called inside the rotated/clipped canvas context.
   */
  render(
    ctx: CanvasRenderingContext2D,
    playerX: number,
    playerY: number,
    centerX: number,
    centerY: number,
  ): void {
    for (const entry of this.trails.values()) {
      const pts = entry.points;
      if (pts.length < 2) continue;

      for (let i = 0; i < pts.length; i++) {
        const t = (i + 1) / pts.length;
        const alpha = t * 0.55;
        const sx = centerX + (pts[i].x - playerX);
        const sy = centerY + (pts[i].y - playerY);
        const radius = 2.5 * t;

        ctx.globalAlpha = alpha;
        if (t > 0.7) {
          ctx.shadowColor = entry.color;
          ctx.shadowBlur = 4;
        }
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = entry.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    ctx.globalAlpha = 1;
  }
}
