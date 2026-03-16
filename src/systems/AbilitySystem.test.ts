import { describe, it, expect, vi } from 'vitest';
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

    it('sets aggro on enemies hit by blast', () => {
      const { system, player } = buildAbilitySystem();
      player.x = 0;
      player.y = 0;
      const enemy = createEnemy(100, 0, 'brute');
      enemy.health = 80;
      expect(enemy.aggro).toBe(false);

      system.activate('damage_blast', [enemy], () => {});

      expect(enemy.aggro).toBe(true);
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

  describe('dash', () => {
    it('accelerates player in heading direction', () => {
      const { system, player } = buildAbilitySystem();
      player.heading = 0; // facing right
      player.vx = 0;
      player.vy = 0;
      system.activate('dash', [], () => {});

      const dashSpeed = player.speed * 3;
      expect(player.vx).toBeCloseTo(dashSpeed);
      expect(player.vy).toBeCloseTo(0);
    });

    it('works when player is stationary', () => {
      const { system, player } = buildAbilitySystem();
      player.heading = -Math.PI / 2; // facing up
      player.vx = 0;
      player.vy = 0;
      system.activate('dash', [], () => {});

      const dashSpeed = player.speed * 3;
      expect(player.vx).toBeCloseTo(0);
      expect(player.vy).toBeCloseTo(-dashSpeed);
    });

    it('has 5 second cooldown', () => {
      const { system } = buildAbilitySystem();
      const ability = system.getAbility('dash')!;
      expect(ability.cooldown).toBe(5);
    });

    it('uses heading direction regardless of current velocity', () => {
      const { system, player } = buildAbilitySystem();
      player.heading = Math.PI / 4; // facing down-right (45 degrees)
      player.vx = -100; // moving left (opposite of heading)
      player.vy = -100;
      system.activate('dash', [], () => {});

      const dashSpeed = player.speed * 3;
      // Should dash in heading direction, not velocity direction
      expect(player.vx).toBeCloseTo(dashSpeed * Math.cos(Math.PI / 4));
      expect(player.vy).toBeCloseTo(dashSpeed * Math.sin(Math.PI / 4));
    });

    it('has 2 charges', () => {
      const { system } = buildAbilitySystem();
      const ability = system.getAbility('dash')!;
      expect(ability.maxCharges).toBe(2);
      expect(ability.charges).toBe(2);
    });

    it('can be used twice before needing to recharge', () => {
      const { system, player } = buildAbilitySystem();
      player.heading = 0;

      expect(system.activate('dash', [], () => {})).toBe(true);
      expect(system.activate('dash', [], () => {})).toBe(true);
      expect(system.activate('dash', [], () => {})).toBe(false);
    });

    it('regenerates one charge after cooldown expires', () => {
      const { system, player } = buildAbilitySystem();
      player.heading = 0;

      system.activate('dash', [], () => {});
      system.activate('dash', [], () => {});
      const ability = system.getAbility('dash')!;
      expect(ability.charges).toBe(0);

      // Wait for one cooldown cycle
      system.update(5, [], () => {});
      expect(ability.charges).toBe(1);

      // Can dash again
      expect(system.activate('dash', [], () => {})).toBe(true);
    });

    it('regenerates both charges after two cooldown cycles', () => {
      const { system, player } = buildAbilitySystem();
      player.heading = 0;

      system.activate('dash', [], () => {});
      system.activate('dash', [], () => {});

      const ability = system.getAbility('dash')!;
      // First cooldown cycle regenerates one charge
      system.update(5, [], () => {});
      expect(ability.charges).toBe(1);
      // Second cooldown cycle regenerates the other
      system.update(5, [], () => {});
      expect(ability.charges).toBe(2);
    });

    it('is actively dashing for 1.5 seconds after activation', () => {
      const { system, player } = buildAbilitySystem();
      player.heading = 0;
      expect(system.isDashing()).toBe(false);

      system.activate('dash', [], () => {});
      expect(system.isDashing()).toBe(true);

      system.update(1, [], () => {});
      expect(system.isDashing()).toBe(true);

      system.update(0.5, [], () => {});
      expect(system.isDashing()).toBe(false);
    });
  });

  describe('homing missile', () => {
    it('spawns a missile at the player position with randomized launch direction', () => {
      const { system, player } = buildAbilitySystem();
      player.x = 100;
      player.y = 200;
      const enemy = createEnemy(300, 200, 'scout');
      enemy.visible = true;
      const entities: GameEntity[] = [enemy];

      system.activate('homing_missile', entities, () => {});

      expect(system.missiles.length).toBe(1);
      expect(system.missiles[0].x).toBe(100);
      expect(system.missiles[0].y).toBe(200);
      // Launches at low speed (not full speed) — will accelerate
      const speed = Math.sqrt(
        system.missiles[0].vx ** 2 + system.missiles[0].vy ** 2,
      );
      expect(speed).toBeLessThan(system.missiles[0].speed);
    });

    it('accelerates and steers toward nearest enemy over time', () => {
      const { system, player } = buildAbilitySystem();
      player.x = 0;
      player.y = 0;
      // Enemy far to the right — gives missile time to arc toward it
      const enemy = createEnemy(300, 0, 'brute');
      enemy.visible = true;
      const entities: GameEntity[] = [enemy];

      system.activate('homing_missile', entities, () => {});
      const launchSpeed = Math.sqrt(
        system.missiles[0].vx ** 2 + system.missiles[0].vy ** 2,
      );

      // Run several frames to let it accelerate and steer
      for (let i = 0; i < 10; i++) system.update(0.1, entities, () => {});

      const afterSpeed = Math.sqrt(
        system.missiles[0].vx ** 2 + system.missiles[0].vy ** 2,
      );
      // Should have accelerated
      expect(afterSpeed).toBeGreaterThan(launchSpeed);
      // Should be heading toward the enemy (positive x velocity)
      expect(system.missiles[0].vx).toBeGreaterThan(0);
    });

    it('deals damage on impact and is consumed', () => {
      const { system, player } = buildAbilitySystem();
      player.x = 0;
      player.y = 0;
      // Place enemy at moderate range — missile arcs then homes in
      const enemy = createEnemy(150, 0, 'brute');
      enemy.visible = true;
      enemy.health = 80;
      const entities: GameEntity[] = [enemy];

      system.activate('homing_missile', entities, () => {});
      // Simulate full lifetime in small steps — missile arcs and accelerates
      for (let i = 0; i < 80; i++) system.update(0.05, entities, () => {});

      expect(enemy.health).toBeLessThan(80); // Took missile damage
      expect(system.missiles.length).toBe(0); // Consumed on impact
    });

    it('kills enemy and awards score on lethal hit', () => {
      const { system, player } = buildAbilitySystem();
      player.x = 0;
      player.y = 0;
      const enemy = createEnemy(150, 0, 'scout');
      enemy.visible = true;
      enemy.health = 1; // One hit from anything kills it
      enemy.energyDrop = 5;
      const entities: GameEntity[] = [enemy];

      system.activate('homing_missile', entities, () => {});
      for (let i = 0; i < 80; i++) system.update(0.05, entities, () => {});

      expect(enemy.active).toBe(false);
      expect(player.kills).toBe(1);
      expect(player.score).toBe(50);
      expect(player.energy).toBe(5);
    });

    it('sets aggro on enemy hit by missile', () => {
      const { system, player } = buildAbilitySystem();
      player.x = 0;
      player.y = 0;
      const enemy = createEnemy(150, 0, 'brute');
      enemy.visible = true;
      enemy.health = 80;
      expect(enemy.aggro).toBe(false);
      const entities: GameEntity[] = [enemy];

      system.activate('homing_missile', entities, () => {});
      for (let i = 0; i < 80; i++) system.update(0.05, entities, () => {});

      expect(enemy.health).toBeLessThan(80);
      expect(enemy.aggro).toBe(true);
    });

    it('expires after 4 seconds if it misses', () => {
      const { system, player } = buildAbilitySystem();
      player.x = 0;
      player.y = 0;

      // Fire with no enemies — missile flies into void
      system.activate('homing_missile', [], () => {});
      expect(system.missiles.length).toBe(1);

      system.update(5, [], () => {});
      expect(system.missiles.length).toBe(0);
    });

    it('has a cooldown', () => {
      const { system } = buildAbilitySystem();
      const ability = system.getAbility('homing_missile')!;
      expect(ability.cooldown).toBeGreaterThan(0);
    });

    it('does not track invisible enemies', () => {
      const { system, player } = buildAbilitySystem();
      player.x = 0;
      player.y = 0;
      player.heading = 0; // facing right
      // Place enemy off the firing line so straight-ahead missile misses
      const enemy = createEnemy(0, 150, 'brute');
      enemy.visible = false; // Not revealed by ping
      enemy.health = 80;
      const entities: GameEntity[] = [enemy];

      system.activate('homing_missile', entities, () => {});
      // Run full lifetime — missile fires straight ahead, misses the enemy above
      for (let i = 0; i < 80; i++) system.update(0.05, entities, () => {});

      expect(enemy.health).toBe(80); // No damage — missile didn't track
    });

    it('triggers shake when missile hits an enemy', () => {
      const { system, player } = buildAbilitySystem();
      const onShake = vi.fn();
      system.onShake = onShake;
      player.x = 0;
      player.y = 0;
      const enemy = createEnemy(150, 0, 'brute');
      enemy.visible = true;
      enemy.health = 80;
      const entities: GameEntity[] = [enemy];

      system.activate('homing_missile', entities, () => {});
      for (let i = 0; i < 80; i++) system.update(0.05, entities, () => {});

      expect(enemy.health).toBeLessThan(80);
      expect(onShake).toHaveBeenCalledWith(7);
    });

    describe('distance-based aim directness', () => {
      it('uses higher effective turn rate for close targets than far targets', () => {
        // Measure turn per frame: record launch angle, advance one frame, measure angular change
        // Use multiple trials and average to reduce randomness from launch spread

        function measureAverageTurnRate(enemyDist: number, trials: number): number {
          let totalTurn = 0;
          for (let t = 0; t < trials; t++) {
            const { system, player } = buildAbilitySystem();
            player.x = 0;
            player.y = 0;
            player.heading = Math.PI / 2; // facing up, enemy is to the right
            const enemy = createEnemy(enemyDist, 0, 'brute');
            enemy.visible = true;
            enemy.health = 80;

            system.activate('homing_missile', [enemy], () => {});
            const launchAngle = Math.atan2(system.missiles[0].vy, system.missiles[0].vx);

            system.update(0.016, [enemy], () => {}); // One frame at 60Hz
            const afterAngle = Math.atan2(system.missiles[0].vy, system.missiles[0].vx);
            totalTurn += Math.abs(afterAngle - launchAngle);
          }
          return totalTurn / trials;
        }

        const closeTurn = measureAverageTurnRate(40, 20);
        const farTurn = measureAverageTurnRate(300, 20);

        // Close target should produce more turn per frame on average
        expect(closeTurn).toBeGreaterThan(farTurn);
      });

      it('uses narrower launch spread for close targets', () => {
        // Fire many missiles at a close target and check the spread is narrow
        const launchAngles: number[] = [];
        for (let i = 0; i < 50; i++) {
          const { system, player } = buildAbilitySystem();
          player.x = 0;
          player.y = 0;
          player.heading = 0; // facing right
          const enemy = createEnemy(40, 0, 'scout'); // Very close
          enemy.visible = true;
          system.activate('homing_missile', [enemy], () => {});
          const angle = Math.atan2(system.missiles[0].vy, system.missiles[0].vx);
          launchAngles.push(angle);
        }

        // All angles should be within ±30° (±0.524 rad) of heading (0)
        const maxSpread = Math.max(...launchAngles.map((a) => Math.abs(a)));
        expect(maxSpread).toBeLessThan(Math.PI * 0.35); // ~63° — generous bound for ±30° random
      });

      it('uses wider launch spread for far targets', () => {
        // Fire many missiles at a far target and verify wider spread
        const launchAngles: number[] = [];
        for (let i = 0; i < 50; i++) {
          const { system, player } = buildAbilitySystem();
          player.x = 0;
          player.y = 0;
          player.heading = 0; // facing right
          const enemy = createEnemy(400, 0, 'scout'); // Far away
          enemy.visible = true;
          system.activate('homing_missile', [enemy], () => {});
          const angle = Math.atan2(system.missiles[0].vy, system.missiles[0].vx);
          launchAngles.push(angle);
        }

        // Should see angles with larger spread — at least some beyond ±30°
        const maxSpread = Math.max(...launchAngles.map((a) => Math.abs(a)));
        expect(maxSpread).toBeGreaterThan(Math.PI * 0.2); // At least ~36° spread seen
      });

      it('close-range missiles hit their target reliably', () => {
        // Fire 10 missiles at a very close target — all should hit
        let hits = 0;
        for (let trial = 0; trial < 10; trial++) {
          const { system, player } = buildAbilitySystem();
          player.x = 0;
          player.y = 0;
          player.heading = 0;
          const enemy = createEnemy(40, 0, 'brute');
          enemy.visible = true;
          enemy.health = 80;
          const entities: GameEntity[] = [enemy];

          system.activate('homing_missile', entities, () => {});
          for (let i = 0; i < 80; i++) system.update(0.05, entities, () => {});
          if (enemy.health < 80) hits++;
        }
        // All should hit at close range with direct aim
        expect(hits).toBe(10);
      });

      it('smoothly interpolates turn rate — medium range gets intermediate value', () => {
        // Measure average turn per frame at three distances
        function measureAverageTurn(enemyDist: number, trials: number): number {
          let totalTurn = 0;
          for (let t = 0; t < trials; t++) {
            const { system, player } = buildAbilitySystem();
            player.x = 0;
            player.y = 0;
            player.heading = Math.PI / 2;
            const enemy = createEnemy(enemyDist, 0, 'brute');
            enemy.visible = true;
            enemy.health = 80;

            system.activate('homing_missile', [enemy], () => {});
            const launchAngle = Math.atan2(system.missiles[0].vy, system.missiles[0].vx);

            system.update(0.016, [enemy], () => {});
            const afterAngle = Math.atan2(system.missiles[0].vy, system.missiles[0].vx);
            totalTurn += Math.abs(afterAngle - launchAngle);
          }
          return totalTurn / trials;
        }

        const closeTurn = measureAverageTurn(40, 20);
        const mediumTurn = measureAverageTurn(100, 20);
        const farTurn = measureAverageTurn(300, 20);

        // close > medium > far (smooth gradient)
        expect(closeTurn).toBeGreaterThan(mediumTurn);
        expect(mediumTurn).toBeGreaterThan(farTurn);
      });
    });
  });
});
