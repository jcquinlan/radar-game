interface FloatingTextEntry {
  text: string;
  x: number;
  y: number;
  color: string;
  remaining: number;
  maxDuration: number;
}

const FLOAT_DURATION = 1.0;
const FLOAT_SPEED = 40;

export class FloatingText {
  private entries: FloatingTextEntry[] = [];

  add(text: string, worldX: number, worldY: number, color: string): void {
    this.entries.push({
      text,
      x: worldX,
      y: worldY,
      color,
      remaining: FLOAT_DURATION,
      maxDuration: FLOAT_DURATION,
    });
  }

  update(dt: number): void {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      this.entries[i].remaining -= dt;
      this.entries[i].y -= FLOAT_SPEED * dt;
      if (this.entries[i].remaining <= 0) {
        this.entries.splice(i, 1);
      }
    }
  }

  render(
    ctx: CanvasRenderingContext2D,
    playerX: number,
    playerY: number,
    centerX: number,
    centerY: number
  ): void {
    ctx.save();
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';

    for (const entry of this.entries) {
      const alpha = entry.remaining / entry.maxDuration;
      const screenX = centerX + (entry.x - playerX);
      const screenY = centerY + (entry.y - playerY);

      ctx.globalAlpha = alpha;
      ctx.shadowColor = entry.color;
      ctx.shadowBlur = 5;
      ctx.fillStyle = entry.color;
      ctx.fillText(entry.text, screenX, screenY);
    }

    ctx.restore();
  }
}
