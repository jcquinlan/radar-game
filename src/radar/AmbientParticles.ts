interface Particle {
  /** World-space position (large range, wraps around) */
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
}

const DEEP_COUNT = 35;
const FOREGROUND_COUNT = 12;

/** How much each layer shifts relative to player movement (0 = fixed, 1 = moves with world) */
const DEEP_PARALLAX = 0.05;
const FOREGROUND_PARALLAX = 0.4;

/** Spawn range — particles tile across a region larger than the radar */
const SPAWN_RANGE = 800;

export class AmbientParticles {
  private deep: Particle[] = [];
  private foreground: Particle[] = [];

  constructor() {
    for (let i = 0; i < DEEP_COUNT; i++) {
      this.deep.push(this.createDeepParticle());
    }
    for (let i = 0; i < FOREGROUND_COUNT; i++) {
      this.foreground.push(this.createForegroundParticle());
    }
  }

  private createDeepParticle(): Particle {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 5;
    return {
      x: (Math.random() - 0.5) * SPAWN_RANGE,
      y: (Math.random() - 0.5) * SPAWN_RANGE,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 0.008 + Math.random() * 0.012,
      size: 40 + Math.random() * 80,
    };
  }

  private createForegroundParticle(): Particle {
    const angle = Math.random() * Math.PI * 2;
    const speed = 8 + Math.random() * 20;
    return {
      x: (Math.random() - 0.5) * SPAWN_RANGE,
      y: (Math.random() - 0.5) * SPAWN_RANGE,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 0.08 + Math.random() * 0.08,
      size: 2 + Math.random() * 2.5,
    };
  }

  update(dt: number): void {
    this.updateLayer(this.deep, dt, true);
    this.updateLayer(this.foreground, dt, false);
  }

  private updateLayer(particles: Particle[], dt: number, isDeep: boolean): void {
    const half = SPAWN_RANGE / 2;
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Wrap around spawn range (keeps particles distributed evenly)
      if (p.x > half) p.x -= SPAWN_RANGE;
      if (p.x < -half) p.x += SPAWN_RANGE;
      if (p.y > half) p.y -= SPAWN_RANGE;
      if (p.y < -half) p.y += SPAWN_RANGE;
    }
  }

  /** Render the deep/background layer (call before entities) */
  renderDeep(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
    playerX: number,
    playerY: number
  ): void {
    this.renderLayer(ctx, this.deep, centerX, centerY, radius, playerX, playerY, DEEP_PARALLAX);
  }

  /** Render the foreground layer (call after entities) */
  renderForeground(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
    playerX: number,
    playerY: number
  ): void {
    this.renderLayer(ctx, this.foreground, centerX, centerY, radius, playerX, playerY, FOREGROUND_PARALLAX);
  }

  private renderLayer(
    ctx: CanvasRenderingContext2D,
    particles: Particle[],
    centerX: number,
    centerY: number,
    radius: number,
    playerX: number,
    playerY: number,
    parallax: number
  ): void {
    const r2 = radius * radius;
    // Parallax offset: higher factor = moves more with the player
    const offsetX = -playerX * parallax;
    const offsetY = -playerY * parallax;
    const half = SPAWN_RANGE / 2;

    ctx.save();
    for (const p of particles) {
      // Wrap particle position relative to the parallax-shifted view
      let rx = ((p.x + offsetX + half) % SPAWN_RANGE + SPAWN_RANGE) % SPAWN_RANGE - half;
      let ry = ((p.y + offsetY + half) % SPAWN_RANGE + SPAWN_RANGE) % SPAWN_RANGE - half;

      if (rx * rx + ry * ry > r2) continue;

      const screenX = centerX + rx;
      const screenY = centerY + ry;

      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = '#00ff41';
      const s = p.size;
      ctx.fillRect(screenX - s / 2, screenY - s / 2, s, s);
    }
    ctx.restore();
  }
}
