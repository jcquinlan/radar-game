import { describe, it, expect } from 'vitest';
import { AbilitySystem } from './AbilitySystem';
import { Player } from '../entities/Player';
import { createEnemy } from '../entities/Entity';
import type { GameEntity } from '../entities/Entity';

function buildAbilitySystem() {
  const player = new Player();
  const system = new AbilitySystem(player);
  return { player, system };
}

describe('AbilitySystem', () => {
  describe('cooldown management', () => {
    it('decrements cooldowns over time', () => {
      const { system } = buildAbilitySystem();
      system.activate('damage_blast', [], () => {});
      const ability = system.getAbility('damage_blast')!;
      expect(ability.cooldownRemaining).toBeGreaterThan(0);

      system.update(1, [], () => {});
      expect(ability.cooldownRemaining).toBeLessThan(ability.cooldown);
    });

    it('prevents activation while on cooldown', () => {
      const { system } = buildAbilitySystem();
      const entities: GameEntity[] = [];
      system.activate('damage_blast', entities, () => {});
      const result = system.activate('damage_blast', entities, () => {});
      expect(result).toBe(false);
    });

    it('allows re-activation after cooldown expires', () => {
      const { system } = buildAbilitySystem();
      const entities: GameEntity[] = [];
      system.activate('damage_blast', entities, () => {});
      // Advance past full cooldown
      system.update(10, entities, () => {});
      const result = system.activate('damage_blast', entities, () => {});
      expect(result).toBe(true);
    });
  });

  describe('damage blast', () => {
    it('deals damage to enemies within 200px of player', () => {
      const { system, player } = buildAbilitySystem();
      player.x = 0;
      player.y = 0;
      const enemy = createEnemy(100, 100, 'brute'); // ~141px away
      enemy.health = 80;
      const entities: GameEntity[] = [enemy];

      system.activate('damage_blast', entities, () => {});
      expect(enemy.health).toBe(60); // 80 - 20 = 60
    });

    it('does not damage enemies beyond 200px', () => {
      const { system, player } = buildAbilitySystem();
      player.x = 0;
      player.y = 0;
      const enemy = createEnemy(200, 200, 'scout'); // ~283px away
      enemy.health = 15;
      const entities: GameEntity[] = [enemy];

      system.activate('damage_blast', entities, () => {});
      expect(enemy.health).toBe(15); // Unchanged
    });

    it('kills enemies and drops energy when health reaches zero', () => {
      const { system, player } = buildAbilitySystem();
      player.x = 0;
      player.y = 0;
      const enemy = createEnemy(50, 0, 'scout'); // 50px away, 15 HP
      enemy.health = 10;
      enemy.energyDrop = 5;
      const entities: GameEntity[] = [enemy];

      system.activate('damage_blast', entities, () => {});
      expect(enemy.active).toBe(false);
      expect(player.energy).toBe(5);
      expect(player.kills).toBe(1);
      expect(player.score).toBe(50);
    });

    it('has 8 second cooldown', () => {
      const { system } = buildAbilitySystem();
      const ability = system.getAbility('damage_blast')!;
      expect(ability.cooldown).toBe(8);
    });

    it('generates floating text events for damaged enemies', () => {
      const { system, player } = buildAbilitySystem();
      player.x = 0;
      player.y = 0;
      const enemy = createEnemy(50, 0, 'brute');
      const entities: GameEntity[] = [enemy];
      const texts: Array<{ text: string; x: number; y: number; color: string }> = [];

      system.activate('damage_blast', entities, (text, x, y, color) => {
        texts.push({ text, x, y, color });
      });

      expect(texts.length).toBeGreaterThan(0);
      expect(texts[0].text).toBe('-20');
      expect(texts[0].color).toBe('#ff4141');
    });
  });
});
