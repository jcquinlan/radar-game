interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
}

const MAX_PARTICLES = 40;

export class AmbientParticles {
  private particles: Particle[] = [];

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push(this.createParticle());
    }
  }

  private createParticle(): Particle {
    const angle = Math.random() * Math.PI * 2;
    const speed = 5 + Math.random() * 15;
    return {
      x: (Math.random() - 0.5) * 600,
      y: (Math.random() - 0.5) * 600,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 0.05 + Math.random() * 0.1,
      size: 1 + Math.random() * 2,
    };
  }

  update(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Respawn if too far from center
      if (Math.abs(p.x) > 350 || Math.abs(p.y) > 350) {
        Object.assign(p, this.createParticle());
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number): void {
    ctx.save();

    for (const p of this.particles) {
      const screenX = centerX + p.x;
      const screenY = centerY + p.y;

      // Only render within radar circle
      const dx = p.x;
      const dy = p.y;
      if (dx * dx + dy * dy > radius * radius) continue;

      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = '#00ff41';
      ctx.beginPath();
      ctx.arc(screenX, screenY, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
