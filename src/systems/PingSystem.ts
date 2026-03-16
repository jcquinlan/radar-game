import { GameEntity, Enemy } from '../entities/Entity';
import { Player } from '../entities/Player';

export interface PingEvent {
  entity: GameEntity;
  type: 'reveal';
  value: number;
}

export interface PingState {
  /** Current radius of the expanding ping circle */
  radius: number;
  /** Current expansion speed (decelerates over time) */
  speed: number;
  /** Whether a ping is currently expanding */
  active: boolean;
  /** Alpha/opacity of the ping ring (fades as it expands) */
  alpha: number;
  /** Time until next ping fires (counts down during cooldown) */
  cooldownRemaining: number;
}

export interface PingConfig {
  /** Maximum radius the ping can reach (matches radar radius) */
  maxRadius: number;
  /** Initial expansion speed in px/s */
  initialSpeed: number;
  /** Deceleration factor — speed *= exp(-deceleration * dt) */
  deceleration: number;
  /** Time between pings in seconds */
  cooldown: number;
}

export const DEFAULT_PING_CONFIG: PingConfig = {
  maxRadius: 340,
  initialSpeed: 450,
  deceleration: 0.8,
  cooldown: 1.5,
};

export class PingSystem {
  private state: PingState;
  private config: PingConfig;
  private events: PingEvent[] = [];

  constructor(config: Partial<PingConfig> = {}) {
    this.config = { ...DEFAULT_PING_CONFIG, ...config };
    this.state = {
      radius: 0,
      speed: 0,
      active: false,
      alpha: 0,
      cooldownRemaining: 0,
    };
  }

  getState(): PingState {
    return this.state;
  }

  getConfig(): PingConfig {
    return this.config;
  }

  setMaxRadius(radius: number): void {
    this.config.maxRadius = radius;
  }

  setCooldown(cooldown: number): void {
    this.config.cooldown = cooldown;
  }

  update(
    entities: GameEntity[],
    player: Player,
    dt: number
  ): PingEvent[] {
    this.events.length = 0;

    // Check if we need to fire a new ping
    if (!this.state.active) {
      this.state.cooldownRemaining -= dt;

      if (this.state.cooldownRemaining <= 0) {
        // Fire new ping — hide enemies and save ghost markers at last-known positions
        for (const entity of entities) {
          if (entity.type === 'enemy' && entity.active) {
            const enemy = entity as Enemy;
            if (enemy.visible) {
              // Save ghost at current position before hiding
              enemy.ghostX = enemy.x;
              enemy.ghostY = enemy.y;
            }
            enemy.visible = false;
          }
          entity.pingedThisWave = false;
        }

        this.state.active = true;
        this.state.radius = 0;
        this.state.speed = this.config.initialSpeed;
        this.state.alpha = 1;
        this.state.cooldownRemaining = 0;
      }
    }

    // Expand the active ping (runs in the same frame the ping fires)
    if (this.state.active) {
      this.state.radius += this.state.speed * dt;
      this.state.speed *= Math.exp(-this.config.deceleration * dt);

      // Fade as it expands
      this.state.alpha = Math.max(0, 1 - this.state.radius / this.config.maxRadius);

      // Check entities crossed by the expanding ring
      for (const entity of entities) {
        if (!entity.active || entity.pingedThisWave) continue;

        const relX = entity.x - player.x;
        const relY = entity.y - player.y;
        const distSq = relX * relX + relY * relY;

        if (distSq > this.config.maxRadius * this.config.maxRadius) continue;

        if (distSq <= this.state.radius * this.state.radius) {
          entity.pingedThisWave = true;

          if (entity.type === 'enemy') {
            entity.visible = true;
            // Clear ghost marker — live position is now visible
            (entity as Enemy).ghostX = null;
            (entity as Enemy).ghostY = null;
          }
        }
      }

      // Ping finished — reached max radius
      if (this.state.radius >= this.config.maxRadius) {
        this.state.active = false;
        this.state.radius = 0;
        this.state.speed = 0;
        this.state.alpha = 0;
        this.state.cooldownRemaining = this.config.cooldown;
      }
    }

    return this.events;
  }
}
