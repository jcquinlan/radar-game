import { describe, it, expect, beforeEach, vi } from 'vitest';
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
  let releasedSlots: number[];

  beforeEach(() => {
    system = new CombatBotSystem();
    player = makePlayer(0, 0);
    floatingTexts = [];
    addFloatingText = (text, x, y) => floatingTexts.push({ text, x, y });
    deathEvents = [];
    onDeath = (x, y) => deathEvents.push({ x, y });
    impactEvents = [];
    onImpact = (x, y) => impactEvents.push({ x, y });
    releasedSlots = [];
    system.onSlotRelease = (slotIndex) => releasedSlots.push(slotIndex);
  });

  describe('deployBot', () => {
    it('spawns a bot at the player position, targeting the click location', () => {
      system.deployBot(300, 400, player, 0);
      expect(system.bots.length).toBe(1);
      expect(system.bots[0].x).toBe(0);
      expect(system.bots[0].y).toBe(0);
      expect(system.bots[0].targetX).toBe(300);
      expect(system.bots[0].targetY).toBe(400);
      expect(system.bots[0].active).toBe(true);
      expect(system.bots[0].state).toBe(CombatBotState.FlyingToTarget);
    });

    it('sets correct initial stats on deployed bot', () => {
      system.deployBot(100, 100, player, 0);
      const bot = system.bots[0];
      expect(bot.health).toBe(30);
      expect(bot.maxHealth).toBe(30);
      expect(bot.damage).toBe(4);
      expect(bot.range).toBe(200);
      expect(bot.fireRate).toBe(1.5);
      expect(bot.maxLifetime).toBe(20);
      expect(bot.lifetime).toBe(20);
    });

    it('stores slotIndex on the deployed bot', () => {
      system.deployBot(100, 100, player, 5);
      expect(system.bots[0].slotIndex).toBe(5);
    });

    it('launches bot with non-zero initial velocity', () => {
      system.deployBot(300, 0, player, 0);
      const bot = system.bots[0];
      const speed = Math.sqrt(bot.vx * bot.vx + bot.vy * bot.vy);
      expect(speed).toBeGreaterThan(0);
    });

    it('triggers screen shake on deployment', () => {
      const onShake = vi.fn();
      system.onShake = onShake;

      system.deployBot(300, 0, player, 0);

      expect(onShake).toHaveBeenCalledWith(5);
    });
  });

  describe('movement — flies from player to click target', () => {
    it('bot moves toward the click target', () => {
      system.deployBot(500, 0, player, 0);
      const bot = system.bots[0];
      const initialX = bot.x;
      const entities: GameEntity[] = [];

      for (let i = 0; i < 30; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      expect(bot.x).toBeGreaterThan(initialX);
    });

    it('transitions to SeekingEnemy on arrival at target', () => {
      system.deployBot(10, 0, player, 0);
      const bot = system.bots[0];
      const entities: GameEntity[] = [];

      for (let i = 0; i < 60; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      expect(bot.state).toBe(CombatBotState.SeekingEnemy);
    });
  });

  describe('auto-aggro — detects and chases enemies', () => {
    it('auto-aggros a nearby enemy while flying to target', () => {
      system.deployBot(500, 0, player, 0);
      const bot = system.bots[0];
      const enemy = makeEnemy(100, 0);
      const entities: GameEntity[] = [enemy];

      for (let i = 0; i < 10; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      expect(bot.state).toBe(CombatBotState.ChasingEnemy);
      expect(bot.targetEnemy).toBe(enemy);
    });

    it('transitions to orbiting after reaching the enemy', () => {
      system.deployBot(500, 0, player, 0);
      const enemy = makeEnemy(20, 0, 100);
      const entities: GameEntity[] = [enemy];

      for (let i = 0; i < 120; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      const bot = system.bots[0];
      expect(bot.state).toBe(CombatBotState.OrbitingEnemy);
    });

    it('returns to seeking when target enemy dies', () => {
      system.deployBot(500, 0, player, 0);
      const enemy = makeEnemy(50, 0, 1);
      const entities: GameEntity[] = [enemy];

      for (let i = 0; i < 200; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact, player);
      }

      // Bot should still be alive (it may be seeking or have found another state)
      expect(enemy.active).toBe(false);
      // After enemy dies, bot should be in seeking state (if still alive)
      const aliveBots = system.bots.filter(b => b.active);
      if (aliveBots.length > 0) {
        expect(aliveBots[0].state).toBe(CombatBotState.SeekingEnemy);
      }
    });

    it('does not aggro enemies outside detection range', () => {
      system.deployBot(100, 0, player, 0);
      const bot = system.bots[0];
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
      system.deployBot(500, 0, player, 0);
      const enemy = makeEnemy(50, 0, 100);
      const entities: GameEntity[] = [enemy];
      const initialHealth = enemy.health;

      for (let i = 0; i < 300; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact, player);
      }

      expect(enemy.health).toBeLessThan(initialHealth);
    });

    it('deactivates enemy when health reaches 0', () => {
      system.deployBot(500, 0, player, 0);
      const enemy = makeEnemy(50, 0, 4);
      const entities: GameEntity[] = [enemy];

      for (let i = 0; i < 300; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact, player);
      }

      expect(enemy.active).toBe(false);
      expect(deathEvents.length).toBeGreaterThan(0);
    });
  });

  describe('lifetime and slot release', () => {
    it('deactivates bot and releases slot after lifetime expires', () => {
      system.deployBot(100, 0, player, 3);
      const entities: GameEntity[] = [];

      for (let i = 0; i < 21 * 60; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      expect(system.bots.filter(b => b.active).length).toBe(0);
      expect(releasedSlots).toContain(3);
    });

    it('bot remains active before lifetime expires', () => {
      system.deployBot(100, 0, player, 0);
      const entities: GameEntity[] = [];

      for (let i = 0; i < 10 * 60; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }

      expect(system.bots[0].active).toBe(true);
    });

    it('releases slot when bot is destroyed by contact damage', () => {
      system.deployBot(100, 0, player, 4);
      const bot = system.bots[0];
      bot.x = 0;
      bot.y = 0;
      bot.state = CombatBotState.SeekingEnemy;
      const enemy = makeEnemy(5, 0);
      enemy.damage = 10000;
      enemy.subtype = 'brute';
      const entities: GameEntity[] = [enemy];

      system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);

      expect(releasedSlots).toContain(4);
    });
  });

  describe('enemy contact damage', () => {
    it('enemies deal contact damage to bots', () => {
      system.deployBot(100, 0, player, 0);
      const bot = system.bots[0];
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

    it('ranged enemies do not deal contact damage to bots', () => {
      system.deployBot(100, 0, player, 0);
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

  describe('reset', () => {
    it('clears all bots and releases their slots', () => {
      system.deployBot(100, 0, player, 0);
      system.deployBot(200, 0, player, 1);

      system.reset();

      expect(system.bots.length).toBe(0);
      expect(releasedSlots).toContain(0);
      expect(releasedSlots).toContain(1);
    });
  });

  describe('edge cases', () => {
    it('handles empty entity list without errors', () => {
      system.deployBot(100, 0, player, 0);
      const entities: GameEntity[] = [];
      for (let i = 0; i < 10; i++) {
        system.update(1 / 60, entities, addFloatingText, onDeath, onImpact);
      }
      expect(system.bots[0].active).toBe(true);
    });

    it('handles zero dt gracefully', () => {
      system.deployBot(100, 0, player, 0);
      const entities: GameEntity[] = [];
      system.update(0, entities, addFloatingText, onDeath, onImpact);
      expect(system.bots[0].active).toBe(true);
      expect(system.bots[0].lifetime).toBe(20);
    });

    it('bot destroyed emits floating text', () => {
      system.deployBot(100, 0, player, 0);
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
});
