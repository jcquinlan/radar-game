import { describe, it, expect, beforeEach } from 'vitest';
import { OrbitBotSystem, OrbitBotState } from './OrbitBotSystem';
import { Player } from '../entities/Player';
import { createEnemy, Enemy, GameEntity } from '../entities/Entity';

function makeEnemy(x: number, y: number, health = 30): Enemy {
  const e = createEnemy(x, y, 'scout');
  e.health = health;
  e.maxHealth = health;
  e.active = true;
  e.visible = true;
  return e;
}

describe('OrbitBotSystem', () => {
  let player: Player;
  let system: OrbitBotSystem;
  let floatingTexts: { text: string; x: number; y: number }[];
  let addFloatingText: (text: string, x: number, y: number, color: string) => void;
  let deathEvents: { x: number; y: number }[];
  let onDeath: (x: number, y: number, sx: number, sy: number, color: string) => void;

  beforeEach(() => {
    player = new Player(0, 0);
    system = new OrbitBotSystem(player);
    floatingTexts = [];
    addFloatingText = (text, x, y) => floatingTexts.push({ text, x, y });
    deathEvents = [];
    onDeath = (x, y) => deathEvents.push({ x, y });
  });

  describe('orbiting player (idle state)', () => {
    it('stays near the player orbit radius when no enemies exist', () => {
      const entities: GameEntity[] = [];
      // Run several frames to let bot settle into orbit
      for (let i = 0; i < 60; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath);
      }

      const bot = system.bot;
      const dx = bot.x - player.x;
      const dy = bot.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Should be approximately at orbit radius (50px), within tolerance
      expect(dist).toBeGreaterThan(30);
      expect(dist).toBeLessThan(70);
    });

    it('advances orbit angle over time', () => {
      const entities: GameEntity[] = [];
      const initialAngle = system.bot.angle;
      system.update(1, entities, addFloatingText, onDeath);
      expect(system.bot.angle).not.toBe(initialAngle);
    });

    it('follows player position as player moves', () => {
      const entities: GameEntity[] = [];
      // Let bot settle
      for (let i = 0; i < 30; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath);
      }

      // Move player far away
      player.x = 500;
      player.y = 500;

      // Give bot time to follow (needs plenty of frames to catch up over 500px)
      for (let i = 0; i < 300; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath);
      }

      const bot = system.bot;
      const dx = bot.x - player.x;
      const dy = bot.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeLessThan(80);
    });
  });

  describe('target detection and chasing', () => {
    it('transitions to chasing when an enemy is within detection range', () => {
      const enemy = makeEnemy(200, 0); // Within 250px detection
      const entities: GameEntity[] = [enemy];

      // Let bot settle near player first
      for (let i = 0; i < 30; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath);
      }

      // Should eventually start chasing
      let foundChasing = false;
      for (let i = 0; i < 60; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath);
        if (system.bot.state === OrbitBotState.ChasingEnemy || system.bot.state === OrbitBotState.OrbitingEnemy) {
          foundChasing = true;
          break;
        }
      }
      expect(foundChasing).toBe(true);
    });

    it('ignores enemies beyond detection range', () => {
      const enemy = makeEnemy(500, 0); // Beyond 250px detection
      const entities: GameEntity[] = [enemy];

      for (let i = 0; i < 60; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath);
      }

      expect(system.bot.state).toBe(OrbitBotState.OrbitingPlayer);
    });

    it('selects the nearest enemy when multiple are in range', () => {
      const farEnemy = makeEnemy(200, 0);
      const nearEnemy = makeEnemy(100, 0);
      const entities: GameEntity[] = [farEnemy, nearEnemy];

      for (let i = 0; i < 90; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath);
      }

      // Bot should be closer to the near enemy
      if (system.bot.state === OrbitBotState.ChasingEnemy || system.bot.state === OrbitBotState.OrbitingEnemy) {
        const dxNear = system.bot.x - nearEnemy.x;
        const dyNear = system.bot.y - nearEnemy.y;
        const dxFar = system.bot.x - farEnemy.x;
        const dyFar = system.bot.y - farEnemy.y;
        expect(dxNear * dxNear + dyNear * dyNear).toBeLessThan(dxFar * dxFar + dyFar * dyFar);
      }
    });
  });

  describe('orbiting enemy', () => {
    it('transitions to orbiting enemy after reaching target', () => {
      // Place enemy close so bot reaches it quickly
      const enemy = makeEnemy(80, 0);
      const entities: GameEntity[] = [enemy];

      for (let i = 0; i < 120; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath);
      }

      expect(system.bot.state).toBe(OrbitBotState.OrbitingEnemy);
    });

    it('orbits faster around enemies than around player', () => {
      // The angular speed around enemies (4 rad/s) should be higher than player (2 rad/s)
      // We verify this indirectly: the bot's ENEMY_ANGULAR_SPEED > PLAYER_ANGULAR_SPEED
      expect(OrbitBotSystem.ENEMY_ANGULAR_SPEED).toBeGreaterThan(OrbitBotSystem.PLAYER_ANGULAR_SPEED);
    });
  });

  describe('leash and returning', () => {
    it('returns to player when player moves beyond leash distance', () => {
      const enemy = makeEnemy(80, 0);
      const entities: GameEntity[] = [enemy];

      // Let bot reach and orbit enemy
      for (let i = 0; i < 120; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath);
      }
      expect(system.bot.state).toBe(OrbitBotState.OrbitingEnemy);

      // Move player far away (beyond 350px leash)
      player.x = -400;
      player.y = 0;

      // Update to trigger leash check
      system.update(1 / 60, entities, addFloatingText, onDeath);

      expect(system.bot.state).toBe(OrbitBotState.Returning);
    });

    it('transitions back to orbiting player after returning', () => {
      const enemy = makeEnemy(80, 0);
      const entities: GameEntity[] = [enemy];

      // Let bot reach enemy
      for (let i = 0; i < 120; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath);
      }

      // Move player far away
      player.x = -400;
      // Remove the enemy so bot doesn't re-acquire
      enemy.active = false;

      // Give it time to return
      for (let i = 0; i < 300; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath);
      }

      expect(system.bot.state).toBe(OrbitBotState.OrbitingPlayer);
    });
  });

  describe('combat', () => {
    it('deals damage to target enemy while orbiting it', () => {
      const enemy = makeEnemy(80, 0, 100);
      const entities: GameEntity[] = [enemy];
      const initialHealth = enemy.health;

      // Let bot reach and orbit enemy, dealing damage
      for (let i = 0; i < 180; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath);
      }

      expect(enemy.health).toBeLessThan(initialHealth);
    });

    it('returns to player when target enemy dies', () => {
      const enemy = makeEnemy(80, 0, 5); // Low HP, will die quickly
      const entities: GameEntity[] = [enemy];

      // Let bot kill the enemy
      for (let i = 0; i < 300; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath);
        if (!enemy.active) break;
      }

      // After enemy dies, bot should return to player orbit
      for (let i = 0; i < 120; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath);
      }

      expect(system.bot.state).toBe(OrbitBotState.OrbitingPlayer);
    });

    it('generates floating damage text when dealing damage', () => {
      const enemy = makeEnemy(80, 0, 100);
      const entities: GameEntity[] = [enemy];

      for (let i = 0; i < 180; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath);
      }

      expect(floatingTexts.length).toBeGreaterThan(0);
    });

    it('awards score and energy on enemy kill', () => {
      const enemy = makeEnemy(80, 0, 5);
      const entities: GameEntity[] = [enemy];
      const initialScore = player.score;
      const initialKills = player.kills;

      for (let i = 0; i < 300; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath);
        if (!enemy.active) break;
      }

      expect(player.score).toBeGreaterThan(initialScore);
      expect(player.kills).toBeGreaterThan(initialKills);
    });
  });

  describe('velocity-based movement', () => {
    it('uses velocity (not position snapping) for all movement', () => {
      const entities: GameEntity[] = [];
      system.update(1 / 60, entities, addFloatingText, onDeath);

      // Bot should have velocity values, not just position
      const bot = system.bot;
      // After at least one frame, velocity should be non-zero (bot is orbiting)
      const speed = Math.sqrt(bot.vx * bot.vx + bot.vy * bot.vy);
      expect(speed).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('resets bot to initial state near player', () => {
      const enemy = makeEnemy(80, 0);
      const entities: GameEntity[] = [enemy];

      // Let bot wander
      for (let i = 0; i < 60; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath);
      }

      player.x = 200;
      player.y = 300;
      system.reset();

      expect(system.bot.state).toBe(OrbitBotState.OrbitingPlayer);
      expect(system.bot.targetEnemy).toBeNull();
      // Bot position should be near player after reset
      const dx = system.bot.x - player.x;
      const dy = system.bot.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeLessThan(100);
    });
  });
});
