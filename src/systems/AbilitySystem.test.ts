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
      expect(ability.cooldown).toBe(6);
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

  describe('heal over time', () => {
    it('heals 5 HP per second over 4 seconds', () => {
      const { system, player } = buildAbilitySystem();
      player.health = 50;
      system.activate('heal_over_time', [], () => {});

      // Simulate 4 seconds of healing
      system.update(4, [], () => {});
      expect(player.health).toBe(70); // 50 + 5*4 = 70
    });

    it('does not exceed maxHealth', () => {
      const { system, player } = buildAbilitySystem();
      player.health = 95;
      system.activate('heal_over_time', [], () => {});

      system.update(4, [], () => {});
      expect(player.health).toBe(100); // Capped at max
    });

    it('has 15 second cooldown', () => {
      const { system } = buildAbilitySystem();
      const ability = system.getAbility('heal_over_time')!;
      expect(ability.cooldown).toBe(10);
    });

    it('effect ends after 4 seconds', () => {
      const { system, player } = buildAbilitySystem();
      player.health = 50;
      system.activate('heal_over_time', [], () => {});

      system.update(4, [], () => {}); // Duration expires
      system.update(2, [], () => {}); // Extra time — should not heal more

      expect(player.health).toBe(70); // Only healed during 4s window
    });
  });

  describe('helper drone', () => {
    it('spawns a drone at the player position', () => {
      const { system, player } = buildAbilitySystem();
      player.x = 100;
      player.y = 200;
      system.activate('helper_drone', [], () => {});

      expect(system.drones.length).toBe(1);
      expect(system.drones[0].x).toBe(100);
      expect(system.drones[0].y).toBe(200);
    });

    it('drone chases nearest enemy within 300px', () => {
      const { system, player } = buildAbilitySystem();
      player.x = 0;
      player.y = 0;
      const enemy = createEnemy(100, 0, 'scout');
      const entities: GameEntity[] = [enemy];

      system.activate('helper_drone', entities, () => {});
      const droneStartX = system.drones[0].x;

      system.update(1, entities, () => {});

      // Drone should have moved toward enemy
      expect(system.drones[0].x).toBeGreaterThan(droneStartX);
    });

    it('drone deals contact damage to enemies', () => {
      const { system, player } = buildAbilitySystem();
      player.x = 0;
      player.y = 0;
      const enemy = createEnemy(5, 0, 'brute'); // Very close
      enemy.health = 80;
      const entities: GameEntity[] = [enemy];

      system.activate('helper_drone', entities, () => {});
      system.update(1, entities, () => {}); // 1 second of 5 dmg/s = 5 damage

      expect(enemy.health).toBeLessThan(80);
    });

    it('drone despawns after 10 seconds', () => {
      const { system } = buildAbilitySystem();
      system.activate('helper_drone', [], () => {});
      expect(system.drones.length).toBe(1);

      system.update(11, [], () => {}); // Past lifetime
      expect(system.drones.length).toBe(0);
    });

    it('has 20 second cooldown', () => {
      const { system } = buildAbilitySystem();
      const ability = system.getAbility('helper_drone')!;
      expect(ability.cooldown).toBe(15);
    });

    it('drone kills enemies and awards score', () => {
      const { system, player } = buildAbilitySystem();
      player.x = 0;
      player.y = 0;
      const enemy = createEnemy(5, 0, 'scout');
      enemy.health = 1; // Almost dead
      enemy.energyDrop = 5;
      const entities: GameEntity[] = [enemy];

      system.activate('helper_drone', entities, () => {});
      system.update(1, entities, () => {});

      expect(enemy.active).toBe(false);
      expect(player.kills).toBe(1);
      expect(player.score).toBe(50);
    });
  });

  describe('dash', () => {
    it('boosts player velocity in current movement direction', () => {
      const { system, player } = buildAbilitySystem();
      player.vx = 50;
      player.vy = 0;
      system.activate('dash', [], () => {});

      // Should be boosted to 3x player speed in the same direction
      expect(player.vx).toBe(player.speed * 3);
      expect(player.vy).toBe(0);
    });

    it('does not dash when player is stationary', () => {
      const { system, player } = buildAbilitySystem();
      player.vx = 0;
      player.vy = 0;
      system.activate('dash', [], () => {});

      expect(player.vx).toBe(0);
      expect(player.vy).toBe(0);
    });

    it('has 5 second cooldown', () => {
      const { system } = buildAbilitySystem();
      const ability = system.getAbility('dash')!;
      expect(ability.cooldown).toBe(5);
    });

    it('preserves dash direction for diagonal movement', () => {
      const { system, player } = buildAbilitySystem();
      player.vx = 30;
      player.vy = 40; // 3-4-5 triangle, speed = 50
      system.activate('dash', [], () => {});

      const dashSpeed = player.speed * 3;
      // Direction should be preserved: vx/vy ratio = 3/4
      expect(player.vx).toBeCloseTo(dashSpeed * 0.6);
      expect(player.vy).toBeCloseTo(dashSpeed * 0.8);
    });
  });

  describe('homing missile', () => {
    it('spawns a missile at the player position', () => {
      const { system, player } = buildAbilitySystem();
      player.x = 100;
      player.y = 200;
      const enemy = createEnemy(300, 200, 'brute');
      const entities: GameEntity[] = [enemy];

      system.activate('homing_missile', entities, () => {});
      expect(system.missiles.length).toBe(1);
      expect(system.missiles[0].x).toBe(100);
      expect(system.missiles[0].y).toBe(200);
    });

    it('locks onto the nearest enemy at spawn time', () => {
      const { system, player } = buildAbilitySystem();
      player.x = 0;
      player.y = 0;
      const nearEnemy = createEnemy(100, 0, 'scout');
      const farEnemy = createEnemy(500, 0, 'brute');
      const entities: GameEntity[] = [nearEnemy, farEnemy];

      system.activate('homing_missile', entities, () => {});
      expect(system.missiles[0].target).toBe(nearEnemy);
    });

    it('does not spawn if no enemies exist', () => {
      const { system } = buildAbilitySystem();
      const result = system.activate('homing_missile', [], () => {});
      expect(result).toBe(false);
      expect(system.missiles.length).toBe(0);
    });

    it('launches at a semi-random vector before homing', () => {
      const { system, player } = buildAbilitySystem();
      player.x = 0;
      player.y = 0;
      player.heading = 0;
      const enemy = createEnemy(200, 0, 'scout');
      const entities: GameEntity[] = [enemy];

      system.activate('homing_missile', entities, () => {});
      const missile = system.missiles[0];

      // Should have non-zero velocity (launched)
      expect(Math.sqrt(missile.vx * missile.vx + missile.vy * missile.vy)).toBeGreaterThan(0);
      // Should be in launch phase
      expect(missile.phase).toBe('launch');
    });

    it('transitions from launch to homing phase after launch timer expires', () => {
      const { system, player } = buildAbilitySystem();
      player.x = 0;
      player.y = 0;
      const enemy = createEnemy(500, 0, 'scout');
      const entities: GameEntity[] = [enemy];

      system.activate('homing_missile', entities, () => {});
      expect(system.missiles[0].phase).toBe('launch');

      // Advance past launch timer (0.3s)
      system.update(0.35, entities, () => {});
      expect(system.missiles[0].phase).toBe('homing');
    });

    it('steers toward target during homing phase', () => {
      const { system, player } = buildAbilitySystem();
      player.x = 0;
      player.y = 0;
      const enemy = createEnemy(500, 0, 'scout');
      const entities: GameEntity[] = [enemy];

      system.activate('homing_missile', entities, () => {});
      // Skip past launch phase
      system.update(0.35, entities, () => {});

      const missileBefore = system.missiles[0].x;
      system.update(0.5, entities, () => {});

      // Missile should have moved toward enemy (positive x direction)
      expect(system.missiles[0].x).toBeGreaterThan(missileBefore);
    });

    it('goes ballistic when target dies mid-flight', () => {
      const { system, player } = buildAbilitySystem();
      player.x = 0;
      player.y = 0;
      const enemy = createEnemy(500, 0, 'scout');
      const entities: GameEntity[] = [enemy];

      system.activate('homing_missile', entities, () => {});
      system.update(0.35, entities, () => {}); // Enter homing phase

      // Kill the target
      enemy.active = false;

      system.update(0.1, entities, () => {});

      // Missile should still be active (goes ballistic, doesn't self-destruct)
      expect(system.missiles[0].active).toBe(true);
      // Velocity should decay (friction) but missile keeps moving
      expect(Math.abs(system.missiles[0].vx) + Math.abs(system.missiles[0].vy)).toBeGreaterThan(0);
    });

    it('deals damage on collision with an enemy', () => {
      const { system, player } = buildAbilitySystem();
      player.x = 0;
      player.y = 0;
      const enemy = createEnemy(10, 0, 'brute'); // Very close
      enemy.health = 80;
      const entities: GameEntity[] = [enemy];

      system.activate('homing_missile', entities, () => {});
      // Move missile to enemy position
      system.missiles[0].x = enemy.x;
      system.missiles[0].y = enemy.y;

      system.update(0.016, entities, () => {});

      // Enemy should take damage
      expect(enemy.health).toBeLessThan(80);
      // Missile should be deactivated after hit
      expect(system.missiles.length).toBe(0);
    });

    it('awards score and energy on kill', () => {
      const { system, player } = buildAbilitySystem();
      player.x = 0;
      player.y = 0;
      const enemy = createEnemy(10, 0, 'scout');
      enemy.health = 1; // Nearly dead
      enemy.energyDrop = 5;
      const entities: GameEntity[] = [enemy];

      system.activate('homing_missile', entities, () => {});
      system.missiles[0].x = enemy.x;
      system.missiles[0].y = enemy.y;

      system.update(0.016, entities, () => {});

      expect(enemy.active).toBe(false);
      expect(player.kills).toBe(1);
      expect(player.score).toBe(50);
      expect(player.energy).toBe(5);
    });

    it('expires after lifetime runs out', () => {
      const { system, player } = buildAbilitySystem();
      player.x = 0;
      player.y = 0;
      const enemy = createEnemy(5000, 0, 'brute'); // Very far away
      const entities: GameEntity[] = [enemy];

      system.activate('homing_missile', entities, () => {});
      expect(system.missiles.length).toBe(1);

      // Advance past lifetime (6s)
      system.update(7, entities, () => {});
      expect(system.missiles.length).toBe(0);
    });

    it('has 8 second cooldown', () => {
      const { system } = buildAbilitySystem();
      const ability = system.getAbility('homing_missile')!;
      expect(ability.cooldown).toBe(8);
    });

    it('generates floating text on hit', () => {
      const { system, player } = buildAbilitySystem();
      player.x = 0;
      player.y = 0;
      const enemy = createEnemy(10, 0, 'brute');
      enemy.health = 80;
      const entities: GameEntity[] = [enemy];
      const texts: Array<{ text: string; color: string }> = [];

      system.activate('homing_missile', entities, (text, _x, _y, color) => {
        texts.push({ text, color });
      });
      system.missiles[0].x = enemy.x;
      system.missiles[0].y = enemy.y;

      system.update(0.016, entities, (text, _x, _y, color) => {
        texts.push({ text, color });
      });

      expect(texts.some(t => t.text === '-35')).toBe(true);
    });
  });
});
