import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MiningBotSystem, MiningBotState } from './MiningBotSystem';
import { Player } from '../entities/Player';
import { createAsteroid, createEnemy, Asteroid, Enemy, GameEntity } from '../entities/Entity';

function makeAsteroid(x: number, y: number, size: 'small' | 'medium' | 'large' = 'medium'): Asteroid {
  const a = createAsteroid(x, y, size);
  a.active = true;
  a.visible = true;
  return a;
}

function makeEnemy(x: number, y: number): Enemy {
  const e = createEnemy(x, y, 'scout');
  e.active = true;
  e.visible = true;
  e.aggro = false;
  return e;
}

describe('MiningBotSystem', () => {
  let player: Player;
  let system: MiningBotSystem;
  let floatingTexts: { text: string; x: number; y: number }[];
  let addFloatingText: (text: string, x: number, y: number, color: string) => void;
  let releasedSlots: number[];

  beforeEach(() => {
    player = new Player(0, 0);
    system = new MiningBotSystem();
    floatingTexts = [];
    addFloatingText = (text, x, y) => floatingTexts.push({ text, x, y });
    releasedSlots = [];
    system.onSlotRelease = (slotIndex) => releasedSlots.push(slotIndex);
  });

  describe('deployBot', () => {
    it('deploys a bot when clicking within 100px of an asteroid', () => {
      const asteroid = makeAsteroid(150, 0);
      const entities: GameEntity[] = [asteroid];

      const result = system.deployBot(160, 0, entities, player, 0);

      expect(result).toBe(true);
      expect(system.getActiveCount()).toBe(1);
    });

    it('returns false when no asteroid is within 100px of click', () => {
      const asteroid = makeAsteroid(300, 0);
      const entities: GameEntity[] = [asteroid];

      const result = system.deployBot(0, 0, entities, player, 0);

      expect(result).toBe(false);
      expect(system.getActiveCount()).toBe(0);
    });

    it('ignores inactive asteroids', () => {
      const asteroid = makeAsteroid(100, 0);
      asteroid.active = false;
      const entities: GameEntity[] = [asteroid];

      const result = system.deployBot(100, 0, entities, player, 0);
      expect(result).toBe(false);
    });

    it('spawns bot at player position', () => {
      player.x = 50;
      player.y = 75;
      const asteroid = makeAsteroid(100, 75);
      const entities: GameEntity[] = [asteroid];

      system.deployBot(100, 75, entities, player, 0);

      const bots = system.getBots();
      const activeBot = bots.find(b => b.active);
      expect(activeBot).toBeDefined();
      expect(activeBot!.x).toBe(50);
      expect(activeBot!.y).toBe(75);
    });

    it('selects the nearest asteroid when multiple are in range', () => {
      const farAsteroid = makeAsteroid(180, 0);
      const nearAsteroid = makeAsteroid(120, 0);
      const entities: GameEntity[] = [farAsteroid, nearAsteroid];

      system.deployBot(110, 0, entities, player, 0);

      const bots = system.getBots();
      const activeBot = bots.find(b => b.active);
      expect(activeBot).toBeDefined();
      expect(activeBot!.targetAsteroid).toBe(nearAsteroid);
    });

    it('stores slotIndex on the deployed bot', () => {
      const asteroid = makeAsteroid(100, 0);
      const entities: GameEntity[] = [asteroid];

      system.deployBot(100, 0, entities, player, 7);

      const bots = system.getBots();
      expect(bots[0].slotIndex).toBe(7);
    });

    it('launches bot with non-zero initial velocity toward asteroid', () => {
      const asteroid = makeAsteroid(200, 0);
      const entities: GameEntity[] = [asteroid];

      system.deployBot(200, 0, entities, player, 0);

      const bot = system.getBots().find(b => b.active)!;
      const speed = Math.sqrt(bot.vx * bot.vx + bot.vy * bot.vy);
      expect(speed).toBeGreaterThan(0);
    });

    it('triggers screen shake on deployment', () => {
      const onShake = vi.fn();
      system.onShake = onShake;

      const asteroid = makeAsteroid(60, 0);
      const entities: GameEntity[] = [asteroid];

      system.deployBot(60, 0, entities, player, 0);

      expect(onShake).toHaveBeenCalledWith(5);
    });
  });

  describe('deploying state', () => {
    it('bot flies toward the target asteroid', () => {
      const asteroid = makeAsteroid(200, 0);
      const entities: GameEntity[] = [asteroid];

      system.deployBot(200, 0, entities, player, 0);

      const bot = system.getBots()[0];
      const initialDist = Math.sqrt(
        (bot.x - asteroid.x) ** 2 + (bot.y - asteroid.y) ** 2
      );

      for (let i = 0; i < 60; i++) {
        system.update(1 / 60, player, entities, addFloatingText);
      }

      const finalDist = Math.sqrt(
        (bot.x - asteroid.x) ** 2 + (bot.y - asteroid.y) ** 2
      );

      expect(finalDist).toBeLessThan(initialDist);
    });

    it('transitions to mining state on arrival near asteroid', () => {
      const asteroid = makeAsteroid(80, 0);
      const entities: GameEntity[] = [asteroid];

      system.deployBot(80, 0, entities, player, 0);

      for (let i = 0; i < 180; i++) {
        system.update(1 / 60, player, entities, addFloatingText);
      }

      const bot = system.getBots()[0];
      expect(bot.state).toBe(MiningBotState.Mining);
    });
  });

  describe('mining state', () => {
    it('extracts energy from asteroid and adds to player', () => {
      const asteroid = makeAsteroid(60, 0, 'medium');
      const entities: GameEntity[] = [asteroid];
      const initialEnergy = player.energy;

      system.deployBot(60, 0, entities, player, 0);

      for (let i = 0; i < 300; i++) {
        system.update(1 / 60, player, entities, addFloatingText);
      }

      expect(player.energy).toBeGreaterThan(initialEnergy);
    });

    it('decrements asteroid HP while mining', () => {
      const asteroid = makeAsteroid(60, 0, 'medium');
      const initialHp = asteroid.hp;
      const entities: GameEntity[] = [asteroid];

      system.deployBot(60, 0, entities, player, 0);

      for (let i = 0; i < 300; i++) {
        system.update(1 / 60, player, entities, addFloatingText);
      }

      expect(asteroid.hp).toBeLessThan(initialHp);
    });

    it('sets asteroid.miningActive to true while mining', () => {
      const asteroid = makeAsteroid(60, 0);
      const entities: GameEntity[] = [asteroid];

      system.deployBot(60, 0, entities, player, 0);

      for (let i = 0; i < 180; i++) {
        system.update(1 / 60, player, entities, addFloatingText);
      }

      expect(asteroid.miningActive).toBe(true);
    });

    it('releases slot when bot returns after asteroid is depleted', () => {
      // Player at origin, asteroid close by so return is quick
      player.x = 0;
      player.y = 0;
      const asteroid = makeAsteroid(40, 0, 'small');
      asteroid.hp = 0.5;
      asteroid.maxHp = 0.5;
      asteroid.energyValue = 10;
      const entities: GameEntity[] = [asteroid];

      system.deployBot(40, 0, entities, player, 3);

      // Run long enough for bot to mine, deplete, and despawn
      for (let i = 0; i < 2400; i++) {
        system.update(1 / 60, player, entities, addFloatingText);
      }

      expect(asteroid.active).toBe(false);
      expect(releasedSlots).toContain(3);
      expect(system.getActiveCount()).toBe(0);
    });

    it('deactivates bot in place when asteroid is depleted', () => {
      const asteroid = makeAsteroid(60, 0, 'small');
      asteroid.hp = 0.5;
      asteroid.maxHp = 0.5;
      asteroid.energyValue = 10;
      const entities: GameEntity[] = [asteroid];

      system.deployBot(40, 0, entities, player, 3);

      // Use larger dt (0.1s per step) to speed the simulation
      for (let i = 0; i < 600; i++) {
        system.update(0.1, player, entities, addFloatingText);
        if (!asteroid.active) break;
      }

      expect(asteroid.active).toBe(false);
      // Bot should be deactivated (not returning)
      const activeBot = system.getBots().find(b => b.active);
      expect(activeBot).toBeUndefined();
    });
  });

  describe('slot release on bot death', () => {
    it('releases slot when bot returns after target asteroid disappears', () => {
      // Player at origin, bot starts at player
      player.x = 0;
      player.y = 0;
      const asteroid = makeAsteroid(50, 0);
      const entities: GameEntity[] = [asteroid];

      system.deployBot(50, 0, entities, player, 2);
      // Deactivate asteroid while bot is deploying — bot transitions to Returning
      asteroid.active = false;

      // Run enough frames for bot to return to player and despawn
      for (let i = 0; i < 600; i++) {
        system.update(1 / 60, player, entities, addFloatingText);
      }

      expect(releasedSlots).toContain(2);
      expect(system.getActiveCount()).toBe(0);
    });

    it('deactivates when target asteroid disappears during deploying', () => {
      const asteroid = makeAsteroid(200, 0);
      const entities: GameEntity[] = [asteroid];

      system.deployBot(200, 0, entities, player, 0);

      // Run a few frames then remove the asteroid
      for (let i = 0; i < 10; i++) {
        system.update(1 / 60, player, entities, addFloatingText);
      }

      asteroid.active = false;
      system.update(1 / 60, player, entities, addFloatingText);

      const activeBot = system.getBots().find(b => b.active);
      expect(activeBot).toBeUndefined();
    });
  });

  describe('enemy aggro', () => {
    it('does not aggro enemies beyond 400px range', () => {
      const asteroid = makeAsteroid(60, 0, 'large');
      asteroid.hp = 200;
      const farEnemy = makeEnemy(600, 0);
      const entities: GameEntity[] = [asteroid, farEnemy];

      system.deployBot(60, 0, entities, player, 0);

      for (let i = 0; i < 1800; i++) {
        system.update(1 / 60, player, entities, addFloatingText);
      }

      expect(farEnemy.aggro).toBe(false);
    });
  });

  describe('reset', () => {
    it('clears all active bots and releases their slots', () => {
      const a1 = makeAsteroid(100, 0);
      const a2 = makeAsteroid(100, 200);
      const entities: GameEntity[] = [a1, a2];

      system.deployBot(100, 0, entities, player, 0);
      system.deployBot(100, 200, entities, player, 1);
      expect(system.getActiveCount()).toBe(2);

      system.reset();

      expect(system.getActiveCount()).toBe(0);
      expect(releasedSlots).toContain(0);
      expect(releasedSlots).toContain(1);
    });
  });
});
