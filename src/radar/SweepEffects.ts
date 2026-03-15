import { PingEvent } from '../systems/PingSystem';
import { getTheme } from '../themes/theme';

interface FlashEffect {
  x: number;
  y: number;
  color: string;
  remaining: number;
  maxDuration: number;
}

const FLASH_DURATION = 0.3; // seconds

export class SweepEffects {
  private flashes: FlashEffect[] = [];

  addEvents(events: PingEvent[], playerX: number, playerY: number): void {
    const flashColors = getTheme().events as Record<string, string>;
    for (const event of events) {
      this.flashes.push({
        x: event.entity.x - playerX,
        y: event.entity.y - playerY,
        color: flashColors[event.type],
        remaining: FLASH_DURATION,
        maxDuration: FLASH_DURATION,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].remaining -= dt;
      if (this.flashes[i].remaining <= 0) {
        this.flashes.splice(i, 1);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, centerX: number, centerY: number): void {
    for (const flash of this.flashes) {
      const alpha = flash.remaining / flash.maxDuration;
      const radius = 8 + (1 - alpha) * 12;

      ctx.save();
      ctx.globalAlpha = alpha * 0.8;
      ctx.shadowColor = flash.color;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(centerX + flash.x, centerY + flash.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = flash.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }
}
