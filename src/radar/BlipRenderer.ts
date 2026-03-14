import { GameEntity } from '../entities/Entity';

const BLIP_COLORS = {
  resource: '#00ff41',
  enemy: '#ff4141',
  ally: '#4141ff',
};

const BLIP_SIZES = {
  resource: 3,
  enemy: 5,
  ally: 4,
};

export class BlipRenderer {
  private time = 0;

  update(dt: number): void {
    this.time += dt;
  }

  renderBlips(
    ctx: CanvasRenderingContext2D,
    entities: GameEntity[],
    playerX: number,
    playerY: number,
    radarCenterX: number,
    radarCenterY: number,
    radarRadius: number,
    resolutionLevel: number
  ): void {
    for (const entity of entities) {
      if (!entity.active) continue;

      // Convert world position to radar position
      const relX = entity.x - playerX;
      const relY = entity.y - playerY;
      const dist = Math.sqrt(relX * relX + relY * relY);

      // Only render if within radar range
      if (dist > radarRadius) continue;

      const screenX = radarCenterX + relX;
      const screenY = radarCenterY + relY;

      const color = BLIP_COLORS[entity.type];
      const size = BLIP_SIZES[entity.type];

      ctx.save();

      // Glow effect
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;

      // Enemy pulsing effect
      let currentSize = size;
      if (entity.type === 'enemy') {
        currentSize = size + Math.sin(this.time * 4) * 1.5;
      }

      ctx.beginPath();
      ctx.arc(screenX, screenY, currentSize, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Resolution upgrade: show type-specific shapes at level 2+
      if (resolutionLevel >= 2) {
        ctx.font = '10px monospace';
        ctx.fillStyle = color;
        ctx.shadowBlur = 3;
        const label =
          entity.type === 'resource'
            ? 'E'
            : entity.type === 'enemy'
              ? '!'
              : '+';
        ctx.fillText(label, screenX + size + 2, screenY + 3);
      }

      ctx.restore();
    }
  }
}
