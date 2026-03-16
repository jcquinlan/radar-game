import { describe, it, expect, beforeEach } from 'vitest';
import { CombatBotSystem } from './CombatBotSystem';
import { createEnemy, Enemy, GameEntity } from '../entities/Entity';

function makeEnemy(x: number, y: number, health = 30): Enemy {
  const e = createEnemy(x, y, 'scout');
  e.health = health;
  e.maxHealth = health;
  e.active = true;
  e.visible = true;
  return e;
}

describe('CombatBotSystem', () => {
  let system: CombatBotSystem;
  let floatingTexts: { text: string; x: number; y: number }[];
  let addFloatingText: (text: string, x: number, y: number, color: string) => void;
  let deathEvents: { x: number; y: number }[];
  let onDeath: (x: number, y: number, sx: number, sy: number, color: string) => void;
  let impactEvents: { x: number; y: number }[];
  let onImpact: (x: number, y: number, sx: number, sy: number, color: string) => void;

  beforeEach(() => {
    system = new CombatBotSystem();
    floatingTexts = [];
    addFloatingText = (text, x, y) => floatingTexts.push({ text, x, y });
    deathEvents = [];
    onDeath = (x, y) => deathEvents.push({ x, y });
    impactEvents = [];
    onImpact = (x, y) => impactEvents.push({ x, y });
  });

  describe('deployBot', () => {
    it('spawns a bot at the given coordinates', () => {
      const result = system.deployBot(100, 200);
      expect(result).toBe(true);
      expect(system.bots.length).toBe(1);
      expect(system.bots[0].x).toBe(100);
      expect(system.bots[0].y).toBe(200);
      expect(system.bots[0].active).toBe(true);
    });

    it('returns false when no charges remain', () => {
      // Deploy max bots (default 2)
      expect(system.deployBot(0, 0)).toBe(true);
      expect(system.deployBot(50, 50)).toBe(true);
      expect(system.deployBot(100, 100)).toBe(false);
      expect(system.bots.length).toBe(2);
    });

    it('sets correct initial stats on deployed bot', () => {
      system.deployBot(0, 0);
      const bot = system.bots[0];
      expect(bot.health).toBe(30);
      expect(bot.maxHealth).toBe(30);
      expect(bot.damage).toBe(4);
      expect(bot.range).toBe(200);
      expect(bot.fireRate).toBe(0.8);
      expect(bot.maxLifetime).toBe(20);
      expect(bot.lifetime).toBe(20);
    });

    it('allows deploying a new bot after an old one expires', () => {
      system.deployBot(0, 0);
      system.deployBot(50, 50);
      // Both deployed, no charges left
      expect(system.deployBot(100, 100)).toBe(false);

      // Expire the first bot by advancing time past its lifetime
      const entities: GameEntity[] = [];
      for (let i = 0; i < 21 * 60; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }
      // Both bots should be expired, charges restored
      expect(system.deployBot(100, 100)).toBe(true);
    });
  });

  describe('bot firing', () => {
    it('fires at the nearest enemy within range', () => {
      system.deployBot(0, 0);
      const enemy = makeEnemy(100, 0);
      const entities: GameEntity[] = [enemy];

      // Advance past fire rate (0.8s)
      for (let i = 0; i < 60; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      // Should have active projectiles
      const activeProjectiles = system.botProjectiles.filter(p => p.active);
      expect(activeProjectiles.length).toBeGreaterThan(0);
    });

    it('does not fire at enemies outside range', () => {
      system.deployBot(0, 0);
      const enemy = makeEnemy(500, 0); // 500px away, range is 200
      const entities: GameEntity[] = [enemy];

      for (let i = 0; i < 60; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      const activeProjectiles = system.botProjectiles.filter(p => p.active);
      expect(activeProjectiles.length).toBe(0);
    });

    it('does not fire at inactive enemies', () => {
      system.deployBot(0, 0);
      const enemy = makeEnemy(100, 0);
      enemy.active = false;
      const entities: GameEntity[] = [enemy];

      for (let i = 0; i < 60; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      const activeProjectiles = system.botProjectiles.filter(p => p.active);
      expect(activeProjectiles.length).toBe(0);
    });
  });

  describe('projectile damage', () => {
    it('deals damage to enemies on projectile collision', () => {
      system.deployBot(0, 0);
      const enemy = makeEnemy(50, 0, 30);
      const entities: GameEntity[] = [enemy];
      const initialHealth = enemy.health;

      // Run enough frames for projectile to reach enemy and hit
      for (let i = 0; i < 120; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      expect(enemy.health).toBeLessThan(initialHealth);
    });

    it('deactivates enemy when health reaches 0', () => {
      system.deployBot(0, 0);
      const enemy = makeEnemy(50, 0, 4); // 4 HP, one shot kills
      const entities: GameEntity[] = [enemy];

      // Run enough frames
      for (let i = 0; i < 120; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      expect(enemy.active).toBe(false);
      expect(deathEvents.length).toBeGreaterThan(0);
    });
  });

  describe('lifetime', () => {
    it('deactivates bot after lifetime expires', () => {
      system.deployBot(0, 0);
      const entities: GameEntity[] = [];

      // Advance 21 seconds (lifetime is 20s)
      for (let i = 0; i < 21 * 60; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      expect(system.bots[0].active).toBe(false);
    });

    it('bot remains active before lifetime expires', () => {
      system.deployBot(0, 0);
      const entities: GameEntity[] = [];

      // Advance 10 seconds (lifetime is 20s)
      for (let i = 0; i < 10 * 60; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      expect(system.bots[0].active).toBe(true);
    });
  });

  describe('enemy contact damage', () => {
    it('enemies deal contact damage to bots', () => {
      system.deployBot(0, 0);
      // Place enemy right on top of bot
      const enemy = makeEnemy(5, 0);
      enemy.damage = 10;
      enemy.subtype = 'brute';
      const entities: GameEntity[] = [enemy];
      const initialHealth = system.bots[0].health;

      // Run a few frames
      for (let i = 0; i < 30; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      expect(system.bots[0].health).toBeLessThan(initialHealth);
    });

    it('deactivates bot when health reaches 0 from contact damage', () => {
      system.deployBot(0, 0);
      const enemy = makeEnemy(5, 0);
      enemy.damage = 100; // Very high damage
      enemy.subtype = 'brute';
      const entities: GameEntity[] = [enemy];

      // Run enough frames for contact damage to kill the bot
      for (let i = 0; i < 60; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      expect(system.bots[0].active).toBe(false);
    });
  });

  describe('charge management', () => {
    it('getChargesRemaining returns correct count', () => {
      expect(system.getChargesRemaining()).toBe(2);
      system.deployBot(0, 0);
      expect(system.getChargesRemaining()).toBe(1);
      system.deployBot(50, 50);
      expect(system.getChargesRemaining()).toBe(0);
    });

    it('reset restores all charges and clears bots', () => {
      system.deployBot(0, 0);
      system.deployBot(50, 50);
      expect(system.getChargesRemaining()).toBe(0);

      system.reset();
      expect(system.getChargesRemaining()).toBe(2);
      // Active bots should be cleared
      const activeBots = system.bots.filter(b => b.active);
      expect(activeBots.length).toBe(0);
    });

    it('expired bots free up charges', () => {
      system.deployBot(0, 0);
      expect(system.getChargesRemaining()).toBe(1);

      const entities: GameEntity[] = [];
      // Expire the bot
      for (let i = 0; i < 21 * 60; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      expect(system.getChargesRemaining()).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('handles empty entity list without errors', () => {
      system.deployBot(0, 0);
      const entities: GameEntity[] = [];
      // Should not throw
      for (let i = 0; i < 10; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }
      expect(system.bots[0].active).toBe(true);
    });

    it('ranged enemies do not deal contact damage to bots', () => {
      system.deployBot(0, 0);
      const enemy = makeEnemy(5, 0, 30);
      enemy.subtype = 'ranged';
      enemy.damage = 100;
      const entities: GameEntity[] = [enemy];
      const initialHealth = system.bots[0].health;

      for (let i = 0; i < 30; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      // Ranged enemies should not deal contact damage
      expect(system.bots[0].health).toBe(initialHealth);
    });

    it('handles zero dt gracefully', () => {
      system.deployBot(0, 0);
      const entities: GameEntity[] = [];
      // Should not throw or change state
      system.update(0, entities, addFloatingText, onDeath, onImpact);
      expect(system.bots[0].active).toBe(true);
      expect(system.bots[0].lifetime).toBe(20);
    });

    it('bot destroyed emits floating text', () => {
      system.deployBot(0, 0);
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
      expect(system.deployBot(0, 0)).toBe(true);
      expect(system.deployBot(50, 50)).toBe(false);
    });
  });
});
