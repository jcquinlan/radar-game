interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  active: boolean;
}

const MIN_SPEED = 100;
const MAX_SPEED = 250;
const MIN_SIZE = 1.5;
const MAX_SIZE = 3.5;
const MIN_LIFE = 0.3;
const MAX_LIFE = 0.5;
const FRICTION = 3.0;
const CONE_HALF_ANGLE = Math.PI / 4; // 45° half = 90° full cone

export class DeathParticles {
  private pool: Particle[];
  private nextIndex = 0;

  constructor(poolSize: number) {
    this.pool = [];
    for (let i = 0; i < poolSize; i++) {
      this.pool.push({
        x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 0, size: 0,
        color: '', active: false,
      });
    }
  }

  emit(x: number, y: number, dirX: number, dirY: number, color: string, count: number): void {
    const isDirectional = dirX !== 0 || dirY !== 0;
    const baseAngle = isDirectional ? Math.atan2(dirY, dirX) : 0;

    for (let i = 0; i < count; i++) {
      const p = this.pool[this.nextIndex];
      this.nextIndex = (this.nextIndex + 1) % this.pool.length;

      let angle: number;
      if (isDirectional) {
        angle = baseAngle + (Math.random() - 0.5) * 2 * CONE_HALF_ANGLE;
      } else {
        angle = Math.random() * Math.PI * 2;
      }

      const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);

      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = MIN_LIFE + Math.random() * (MAX_LIFE - MIN_LIFE);
      p.maxLife = p.life;
      p.size = MIN_SIZE + Math.random() * (MAX_SIZE - MIN_SIZE);
      p.color = color;
      p.active = true;
    }
  }

  update(dt: number): void {
    const decay = Math.exp(-FRICTION * dt);
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= decay;
      p.vy *= decay;
      p.life -= dt;

      if (p.life <= 0) {
        p.active = false;
      }
    }
  }

  render(
    ctx: CanvasRenderingContext2D,
    playerX: number,
    playerY: number,
    cx: number,
    cy: number,
    radius: number,
  ): void {
    const r2 = radius * radius;

    // Group active particles by color to minimize fillStyle changes
    // Use a Map-free approach: sort by color and batch
    let currentColor = '';
    let batchStarted = false;

    // First pass: collect active particles sorted by color
    // To avoid allocation, we do two passes — one per unique color found
    const seen: string[] = [];
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      if (seen.indexOf(p.color) === -1) seen.push(p.color);
    }

    ctx.save();
    for (let c = 0; c < seen.length; c++) {
      currentColor = seen[c];
      ctx.fillStyle = currentColor;
      ctx.beginPath();
      batchStarted = false;

      for (let i = 0; i < this.pool.length; i++) {
        const p = this.pool[i];
        if (!p.active || p.color !== currentColor) continue;

        const sx = cx + (p.x - playerX);
        const sy = cy + (p.y - playerY);

        // Cull particles outside radar radius
        const dx = sx - cx;
        const dy = sy - cy;
        if (dx * dx + dy * dy > r2) continue;

        ctx.globalAlpha = p.life / p.maxLife;
        // Can't truly batch with varying alpha, so draw individually
        ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
        batchStarted = true;
      }
    }
    ctx.restore();
  }

  reset(): void {
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].active = false;
    }
    this.nextIndex = 0;
  }

  activeCount(): number {
    let count = 0;
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) count++;
    }
    return count;
  }

  getActiveParticles(): Readonly<Particle>[] {
    const result: Particle[] = [];
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) result.push(this.pool[i]);
    }
    return result;
  }
}
