import { describe, it, expect, beforeEach } from 'vitest';
import { CombatBotSystem, CombatBotState } from './CombatBotSystem';
import { createEnemy, Enemy, GameEntity } from '../entities/Entity';
import { Player } from '../entities/Player';

function makeEnemy(x: number, y: number, health = 30): Enemy {
  const e = createEnemy(x, y, 'scout');
  e.health = health;
  e.maxHealth = health;
  e.active = true;
  e.visible = true;
  return e;
}

function makePlayer(x = 0, y = 0): Player {
  return new Player(x, y);
}

describe('CombatBotSystem', () => {
  let system: CombatBotSystem;
  let player: Player;
  let floatingTexts: { text: string; x: number; y: number }[];
  let addFloatingText: (text: string, x: number, y: number, color: string) => void;
  let deathEvents: { x: number; y: number }[];
  let onDeath: (x: number, y: number, sx: number, sy: number, color: string) => void;
  let impactEvents: { x: number; y: number }[];
  let onImpact: (x: number, y: number, sx: number, sy: number, color: string) => void;

  beforeEach(() => {
    system = new CombatBotSystem();
    player = makePlayer(0, 0);
    floatingTexts = [];
    addFloatingText = (text, x, y) => floatingTexts.push({ text, x, y });
    deathEvents = [];
    onDeath = (x, y) => deathEvents.push({ x, y });
    impactEvents = [];
    onImpact = (x, y) => impactEvents.push({ x, y });
  });

  describe('deployBot', () => {
    it('spawns a bot at the player position, targeting the click location', () => {
      const result = system.deployBot(300, 400, player);
      expect(result).toBe(true);
      expect(system.bots.length).toBe(1);
      // Bot spawns at player position
      expect(system.bots[0].x).toBe(0);
      expect(system.bots[0].y).toBe(0);
      // Target is the click location
      expect(system.bots[0].targetX).toBe(300);
      expect(system.bots[0].targetY).toBe(400);
      expect(system.bots[0].active).toBe(true);
      expect(system.bots[0].state).toBe(CombatBotState.FlyingToTarget);
    });

    it('returns false when no charges remain', () => {
      expect(system.deployBot(100, 0, player)).toBe(true);
      expect(system.deployBot(200, 0, player)).toBe(true);
      expect(system.deployBot(300, 0, player)).toBe(false);
      expect(system.bots.length).toBe(2);
    });

    it('sets correct initial stats on deployed bot', () => {
      system.deployBot(100, 100, player);
      const bot = system.bots[0];
      expect(bot.health).toBe(30);
      expect(bot.maxHealth).toBe(30);
      expect(bot.damage).toBe(4);
      expect(bot.range).toBe(200);
      expect(bot.fireRate).toBe(1.5);
      expect(bot.maxLifetime).toBe(20);
      expect(bot.lifetime).toBe(20);
    });

    it('allows deploying a new bot after an old one expires', () => {
      system.deployBot(100, 0, player);
      system.deployBot(200, 0, player);
      expect(system.deployBot(300, 0, player)).toBe(false);

      // Expire bots
      const entities: GameEntity[] = [];
      for (let i = 0; i < 21 * 60; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }
      expect(system.deployBot(300, 0, player)).toBe(true);
    });
  });

  describe('movement — flies from player to click target', () => {
    it('bot moves toward the click target', () => {
      system.deployBot(500, 0, player);
      const bot = system.bots[0];
      const initialX = bot.x;
      const entities: GameEntity[] = [];

      // Run a few frames
      for (let i = 0; i < 30; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      expect(bot.x).toBeGreaterThan(initialX);
    });

    it('transitions to SeekingEnemy on arrival at target', () => {
      // Place click target very close so bot arrives quickly
      system.deployBot(10, 0, player);
      const bot = system.bots[0];
      const entities: GameEntity[] = [];

      // Run enough frames to arrive
      for (let i = 0; i < 60; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      expect(bot.state).toBe(CombatBotState.SeekingEnemy);
    });
  });

  describe('auto-aggro — detects and chases enemies', () => {
    it('auto-aggros a nearby enemy while flying to target', () => {
      system.deployBot(500, 0, player);
      const bot = system.bots[0];
      // Place enemy near the bot's starting position
      const enemy = makeEnemy(100, 0);
      const entities: GameEntity[] = [enemy];

      // Run a few frames — bot should detect enemy
      for (let i = 0; i < 10; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      expect(bot.state).toBe(CombatBotState.ChasingEnemy);
      expect(bot.targetEnemy).toBe(enemy);
    });

    it('transitions to orbiting after reaching the enemy', () => {
      // Place target far away but enemy right next to player
      system.deployBot(500, 0, player);
      const enemy = makeEnemy(20, 0, 100);
      const entities: GameEntity[] = [enemy];

      // Run enough frames to reach and orbit
      for (let i = 0; i < 120; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      const bot = system.bots[0];
      expect(bot.state).toBe(CombatBotState.OrbitingEnemy);
    });

    it('returns to seeking when target enemy dies', () => {
      system.deployBot(500, 0, player);
      const enemy = makeEnemy(50, 0, 1);
      const entities: GameEntity[] = [enemy];

      // Let bot aggro and kill the enemy
      for (let i = 0; i < 200; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact, player);
      }

      const bot = system.bots[0];
      expect(enemy.active).toBe(false);
      expect(bot.state).toBe(CombatBotState.SeekingEnemy);
    });

    it('does not aggro enemies outside detection range', () => {
      system.deployBot(100, 0, player);
      const bot = system.bots[0];
      // Enemy far away — beyond 250px detection range
      const enemy = makeEnemy(800, 0);
      const entities: GameEntity[] = [enemy];

      for (let i = 0; i < 10; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      expect(bot.state).toBe(CombatBotState.FlyingToTarget);
    });
  });

  describe('projectile damage', () => {
    it('deals damage to enemies while orbiting', () => {
      system.deployBot(500, 0, player);
      const enemy = makeEnemy(50, 0, 100);
      const entities: GameEntity[] = [enemy];
      const initialHealth = enemy.health;

      // Run enough frames for bot to reach, orbit, and fire
      for (let i = 0; i < 300; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact, player);
      }

      expect(enemy.health).toBeLessThan(initialHealth);
    });

    it('deactivates enemy when health reaches 0', () => {
      system.deployBot(500, 0, player);
      const enemy = makeEnemy(50, 0, 4);
      const entities: GameEntity[] = [enemy];

      for (let i = 0; i < 300; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact, player);
      }

      expect(enemy.active).toBe(false);
      expect(deathEvents.length).toBeGreaterThan(0);
    });
  });

  describe('lifetime', () => {
    it('deactivates bot after lifetime expires', () => {
      system.deployBot(100, 0, player);
      const entities: GameEntity[] = [];

      for (let i = 0; i < 21 * 60; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      expect(system.bots[0].active).toBe(false);
    });

    it('bot remains active before lifetime expires', () => {
      system.deployBot(100, 0, player);
      const entities: GameEntity[] = [];

      for (let i = 0; i < 10 * 60; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      expect(system.bots[0].active).toBe(true);
    });
  });

  describe('enemy contact damage', () => {
    it('enemies deal contact damage to bots', () => {
      system.deployBot(100, 0, player);
      const bot = system.bots[0];
      // Move bot to known position for testing
      bot.x = 0;
      bot.y = 0;
      bot.state = CombatBotState.SeekingEnemy;
      const enemy = makeEnemy(5, 0);
      enemy.damage = 10;
      enemy.subtype = 'brute';
      const entities: GameEntity[] = [enemy];
      const initialHealth = bot.health;

      for (let i = 0; i < 30; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      expect(bot.health).toBeLessThan(initialHealth);
    });

    it('deactivates bot when health reaches 0 from contact damage', () => {
      system.deployBot(100, 0, player);
      const bot = system.bots[0];
      bot.x = 0;
      bot.y = 0;
      bot.state = CombatBotState.SeekingEnemy;
      const enemy = makeEnemy(5, 0);
      enemy.damage = 100;
      enemy.subtype = 'brute';
      const entities: GameEntity[] = [enemy];

      for (let i = 0; i < 60; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      expect(bot.active).toBe(false);
    });

    it('ranged enemies do not deal contact damage to bots', () => {
      system.deployBot(100, 0, player);
      const bot = system.bots[0];
      bot.x = 0;
      bot.y = 0;
      bot.state = CombatBotState.SeekingEnemy;
      const enemy = makeEnemy(5, 0, 30);
      enemy.subtype = 'ranged';
      enemy.damage = 100;
      const entities: GameEntity[] = [enemy];
      const initialHealth = bot.health;

      for (let i = 0; i < 30; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      expect(bot.health).toBe(initialHealth);
    });
  });

  describe('charge management', () => {
    it('getChargesRemaining returns correct count', () => {
      expect(system.getChargesRemaining()).toBe(2);
      system.deployBot(100, 0, player);
      expect(system.getChargesRemaining()).toBe(1);
      system.deployBot(200, 0, player);
      expect(system.getChargesRemaining()).toBe(0);
    });

    it('reset restores all charges and clears bots', () => {
      system.deployBot(100, 0, player);
      system.deployBot(200, 0, player);
      expect(system.getChargesRemaining()).toBe(0);

      system.reset();
      expect(system.getChargesRemaining()).toBe(2);
      const activeBots = system.bots.filter(b => b.active);
      expect(activeBots.length).toBe(0);
    });

    it('expired bots free up charges', () => {
      system.deployBot(100, 0, player);
      expect(system.getChargesRemaining()).toBe(1);

      const entities: GameEntity[] = [];
      for (let i = 0; i < 21 * 60; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      expect(system.getChargesRemaining()).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('handles empty entity list without errors', () => {
      system.deployBot(100, 0, player);
      const entities: GameEntity[] = [];
      for (let i = 0; i < 10; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }
      expect(system.bots[0].active).toBe(true);
    });

    it('handles zero dt gracefully', () => {
      system.deployBot(100, 0, player);
      const entities: GameEntity[] = [];
      system.update(0, entities, addFloatingText, onDeath, onImpact);
      expect(system.bots[0].active).toBe(true);
      expect(system.bots[0].lifetime).toBe(20);
    });

    it('bot destroyed emits floating text', () => {
      system.deployBot(100, 0, player);
      const bot = system.bots[0];
      bot.x = 0;
      bot.y = 0;
      bot.state = CombatBotState.SeekingEnemy;
      const enemy = makeEnemy(5, 0);
      enemy.damage = 10000;
      enemy.subtype = 'brute';
      const entities: GameEntity[] = [enemy];

      system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);

      const destroyedText = floatingTexts.find(t => t.text === 'BOT DESTROYED');
      expect(destroyedText).toBeDefined();
    });
  });

  describe('maxBots property', () => {
    it('defaults to 2', () => {
      expect(system.maxBots).toBe(2);
    });

    it('limits deployment to maxBots', () => {
      system.maxBots = 1;
      expect(system.deployBot(100, 0, player)).toBe(true);
      expect(system.deployBot(200, 0, player)).toBe(false);
    });
  });
});
