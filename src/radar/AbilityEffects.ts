import { getTheme } from '../themes/theme';

interface BlastRing {
  remaining: number;
  maxDuration: number;
  maxRadius: number;
}

interface RegenGlow {
  remaining: number;
}

interface SpawnFlash {
  x: number;
  y: number;
  remaining: number;
  maxDuration: number;
  color: string;
}

const BLAST_DURATION = 0.4;
const BLAST_RADIUS = 200;
const SPAWN_FLASH_DURATION = 0.5;

export class AbilityEffects {
  private blastRings: BlastRing[] = [];
  private regenGlow: RegenGlow | null = null;
  private spawnFlashes: SpawnFlash[] = [];

  triggerBlast(): void {
    this.blastRings.push({
      remaining: BLAST_DURATION,
      maxDuration: BLAST_DURATION,
      maxRadius: BLAST_RADIUS,
    });
  }

  setRegenActive(active: boolean, durationRemaining: number): void {
    if (active && durationRemaining > 0) {
      this.regenGlow = { remaining: durationRemaining };
    } else {
      this.regenGlow = null;
    }
  }

  triggerMissileLaunch(worldX: number, worldY: number): void {
    this.spawnFlashes.push({
      x: worldX,
      y: worldY,
      remaining: SPAWN_FLASH_DURATION,
      maxDuration: SPAWN_FLASH_DURATION,
      color: getTheme().effects.missile,
    });
  }

  update(dt: number): void {
    for (let i = this.blastRings.length - 1; i >= 0; i--) {
      this.blastRings[i].remaining -= dt;
      if (this.blastRings[i].remaining <= 0) {
        this.blastRings.splice(i, 1);
      }
    }

    for (let i = this.spawnFlashes.length - 1; i >= 0; i--) {
      this.spawnFlashes[i].remaining -= dt;
      if (this.spawnFlashes[i].remaining <= 0) {
        this.spawnFlashes.splice(i, 1);
      }
    }
  }

  render(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    playerX: number,
    playerY: number,
    gameTime: number,
  ): void {
    const theme = getTheme();

    // Blast ring: expanding red circle from player center
    for (const ring of this.blastRings) {
      const progress = 1 - ring.remaining / ring.maxDuration;
      const radius = ring.maxRadius * progress;
      const alpha = ring.remaining / ring.maxDuration;

      ctx.save();
      ctx.globalAlpha = alpha * 0.6;
      ctx.shadowColor = theme.abilities.damage_blast;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = theme.abilities.damage_blast;
      ctx.lineWidth = 3 * alpha + 1;
      ctx.stroke();
      ctx.restore();
    }

    // Regen glow: pulsing green ring around player
    if (this.regenGlow) {
      const pulse = Math.sin(gameTime * 6) * 0.3 + 0.7;
      const radius = 25 + Math.sin(gameTime * 4) * 5;

      ctx.save();
      ctx.globalAlpha = 0.4 * pulse;
      ctx.shadowColor = theme.abilities.heal_over_time;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = theme.abilities.heal_over_time;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner fill with very low alpha
      ctx.globalAlpha = 0.08 * pulse;
      ctx.fillStyle = theme.abilities.heal_over_time;
      ctx.fill();
      ctx.restore();
    }

    // Spawn flash: expanding burst at spawn point (e.g. missile launch)
    for (const flash of this.spawnFlashes) {
      const progress = 1 - flash.remaining / flash.maxDuration;
      const radius = 30 * progress;
      const alpha = flash.remaining / flash.maxDuration;

      const fx = cx + (flash.x - playerX);
      const fy = cy + (flash.y - playerY);

      ctx.save();
      ctx.globalAlpha = alpha * 0.7;
      ctx.shadowColor = flash.color;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(fx, fy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = flash.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Center dot
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(fx, fy, 3 * (1 - progress), 0, Math.PI * 2);
      ctx.fillStyle = flash.color;
      ctx.fill();
      ctx.restore();
    }
  }
}
