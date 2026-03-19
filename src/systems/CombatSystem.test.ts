import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CombatSystem } from './CombatSystem';
import { Player } from '../entities/Player';
import { createEnemy, createHomeBase, createSalvage } from '../entities/Entity';

describe('CombatSystem', () => {
  let combat: CombatSystem;
  let player: Player;

  beforeEach(() => {
    combat = new CombatSystem();
    player = new Player(0, 0);
  });

  it('scout enemies chase the player when within chase range', () => {
    const enemy = createEnemy(100, 0, 'scout');
    const initialX = enemy.x;
    combat.update([enemy], player, 1);
    expect(enemy.x).toBeLessThan(initialX);
  });

  it('enemies wander when outside chase range', () => {
    const enemy = createEnemy(1000, 0, 'scout');
    enemy.wanderAngle = 0; // wander to the right
    enemy.wanderTimer = 5; // don't change direction during test
    const initialX = enemy.x;
    combat.update([enemy], player, 1);
    // Enemy should have moved (wandered), not stayed still
    expect(enemy.x).not.toBe(initialX);
  });

  it('scouts deal contact damage when close to the player', () => {
    const enemy = createEnemy(5, 0, 'scout');
    combat.update([enemy], player, 1);
    expect(player.health).toBeLessThan(player.maxHealth);
  });

  it('returns false when player dies', () => {
    const enemy = createEnemy(5, 0, 'brute');
    enemy.damage = 200;
    const alive = combat.update([enemy], player, 1);
    expect(alive).toBe(false);
  });

  it('returns true when player is alive', () => {
    const enemy = createEnemy(500, 0, 'scout');
    const alive = combat.update([enemy], player, 1);
    expect(alive).toBe(true);
  });

  it('ignores inactive enemies', () => {
    const enemy = createEnemy(5, 0, 'brute');
    enemy.damage = 200;
    enemy.active = false;
    const alive = combat.update([enemy], player, 1);
    expect(alive).toBe(true);
  });

  it('ranged enemies fire projectiles at the player', () => {
    const enemy = createEnemy(150, 0, 'ranged');
    enemy.fireRate = 0; // fire every frame
    combat.update([enemy], player, 1);
    expect(combat.projectiles.length).toBeGreaterThan(0);
  });

  it('tracks projectilesFiredThisFrame counter and resets each update', () => {
    const enemy = createEnemy(150, 0, 'ranged');
    enemy.fireRate = 0;
    combat.update([enemy], player, 1);
    expect(combat.projectilesFiredThisFrame).toBeGreaterThan(0);

    // Next update with no fire — counter resets
    enemy.fireRate = 999;
    combat.update([enemy], player, 0.001);
    expect(combat.projectilesFiredThisFrame).toBe(0);
  });

  it('projectiles deal damage on contact with the player', () => {
    combat.projectiles.push({
      x: 5, y: 0,
      vx: -100, vy: 0,
      damage: 15,
      active: true,
      lifetime: 3,
    });
    combat.update([], player, 0.1);
    expect(player.health).toBe(85); // 100 - 15
  });

  it('projectiles expire after their lifetime', () => {
    combat.projectiles.push({
      x: 500, y: 500,
      vx: 10, vy: 0,
      damage: 10,
      active: true,
      lifetime: 0.1,
    });
    combat.update([], player, 0.2);
    expect(combat.projectiles).toHaveLength(0);
  });

  it('melee enemies stop chasing when within standoff distance', () => {
    // Scout at 20px — within standoff range, should not move closer
    const enemy = createEnemy(20, 0, 'scout');
    const initialX = enemy.x;
    combat.update([enemy], player, 0.1);
    // Should not have moved closer to player
    expect(enemy.x).toBeGreaterThanOrEqual(initialX);
  });

  it('brute enemies stop chasing when within standoff distance', () => {
    const enemy = createEnemy(15, 0, 'brute');
    const initialX = enemy.x;
    combat.update([enemy], player, 0.1);
    expect(enemy.x).toBeGreaterThanOrEqual(initialX);
  });

  it('melee enemies still deal contact damage at standoff distance', () => {
    const enemy = createEnemy(20, 0, 'scout');
    combat.update([enemy], player, 1);
    expect(player.health).toBeLessThan(player.maxHealth);
  });

  it('wandering speed is much slower than chase speed', () => {
    // Enemy wandering (out of range)
    const wanderer = createEnemy(1000, 0, 'scout');
    wanderer.wanderAngle = 0;
    wanderer.wanderTimer = 5;
    const wanderStartX = wanderer.x;
    combat.update([wanderer], player, 0.5);
    const wanderDist = Math.abs(wanderer.x - wanderStartX);

    // Enemy chasing (in range)
    const chaser = createEnemy(100, 0, 'scout');
    const chaseStartX = chaser.x;
    combat.update([chaser], player, 0.5);
    const chaseDist = Math.abs(chaser.x - chaseStartX);

    // Wander movement should be significantly less than chase movement
    expect(wanderDist).toBeLessThan(chaseDist * 0.5);
  });

  it('enemies pick new wander direction when timer expires', () => {
    const enemy = createEnemy(1000, 0, 'scout');
    enemy.wanderTimer = 0.1; // about to expire
    const oldAngle = enemy.wanderAngle;

    combat.update([enemy], player, 0.2); // dt > wanderTimer, triggers new direction
    // Timer should have been reset to 2-3 seconds
    expect(enemy.wanderTimer).toBeGreaterThan(1);
  });

  describe('dash ram damage', () => {
    it('damages enemy instead of player on contact while dashing', () => {
      const enemy = createEnemy(5, 0, 'scout');
      enemy.health = 50;
      const initialHealth = player.health;

      combat.update([enemy], player, 1, true, 15);

      expect(player.health).toBe(initialHealth);
      expect(enemy.health).toBe(35); // 50 - 15 flat
    });

    it('only hits each enemy once per dash', () => {
      const enemy = createEnemy(5, 0, 'scout');
      enemy.health = 50;

      // Multiple frames while dashing — should only deal damage once
      combat.update([enemy], player, 0.016, true, 15);
      combat.update([enemy], player, 0.016, true, 15);
      combat.update([enemy], player, 0.016, true, 15);

      expect(enemy.health).toBe(35); // hit only once
    });

    it('resets hit tracking for a new dash', () => {
      const enemy = createEnemy(5, 0, 'scout');
      enemy.health = 50;

      // First dash
      combat.update([enemy], player, 0.016, true, 15);
      expect(enemy.health).toBe(35);

      // Dash ends
      combat.update([enemy], player, 0.016, false);

      // Second dash — should hit again
      combat.update([enemy], player, 0.016, true, 15);
      expect(enemy.health).toBe(20);
    });

    it('kills enemy and awards score when dashing into them', () => {
      const enemy = createEnemy(5, 0, 'scout');
      enemy.health = 5;
      enemy.energyDrop = 10;

      combat.update([enemy], player, 1, true, 15);

      expect(enemy.active).toBe(false);
      expect(player.kills).toBe(1);
      expect(player.score).toBe(50);
      expect(player.energy).toBe(10);
    });

    it('dash damages all enemy subtypes including ranged on contact', () => {
      const ranged = createEnemy(5, 0, 'ranged');
      ranged.health = 50;

      combat.update([ranged], player, 1, true, 15);

      expect(ranged.health).toBe(35);
    });

    it('knocks enemy back in player movement direction on ram hit', () => {
      const enemy = createEnemy(5, 0, 'scout');
      enemy.health = 50;
      enemy.vx = 0;
      enemy.vy = 0;
      player.vx = 100;
      player.vy = 0;

      combat.update([enemy], player, 0.016, true, 15);

      expect(enemy.vx).toBeGreaterThan(0); // pushed in player's direction
    });

    it('normal contact damage applies when not dashing', () => {
      const enemy = createEnemy(5, 0, 'scout');
      combat.update([enemy], player, 1, false);
      expect(player.health).toBeLessThan(player.maxHealth);
    });
  });

  it('enemies immediately chase when player enters range', () => {
    // Start outside chase range, wandering
    const enemy = createEnemy(300, 0, 'scout');
    enemy.chaseRange = 200;
    enemy.wanderAngle = Math.PI; // wandering away from player
    enemy.wanderTimer = 5;

    // Move player close to enemy
    player.x = 250; // now dist = 50, within chaseRange of 200
    const initialX = enemy.x;
    combat.update([enemy], player, 0.5);

    // Enemy should be chasing (moving toward player), not wandering away
    expect(enemy.x).toBeLessThan(initialX); // moved toward player at x=250
  });

  describe('aggro on damage', () => {
    it('aggroed enemies chase the player even when beyond normal chase range', () => {
      const enemy = createEnemy(1000, 0, 'scout');
      enemy.chaseRange = 200;
      enemy.aggro = true;
      const initialX = enemy.x;

      combat.update([enemy], player, 1);

      // Should chase toward player at origin despite being 1000px away (chaseRange=200)
      expect(enemy.x).toBeLessThan(initialX);
    });

    it('non-aggroed enemies outside chase range do not chase', () => {
      const enemy = createEnemy(1000, 0, 'scout');
      enemy.chaseRange = 200;
      enemy.aggro = false;
      enemy.wanderAngle = Math.PI / 2; // wander perpendicular, not toward player
      enemy.wanderTimer = 5;

      combat.update([enemy], player, 0.5);

      // Should NOT have moved significantly toward player
      expect(enemy.x).toBeGreaterThan(990);
    });

    it('ram sets aggro on hit enemy', () => {
      const enemy = createEnemy(5, 0, 'scout');
      enemy.health = 50;
      expect(enemy.aggro).toBe(false);

      combat.update([enemy], player, 0.016, true, 15);

      expect(enemy.aggro).toBe(true);
    });

    it('normal chase range behavior still works for non-aggroed enemies', () => {
      const enemy = createEnemy(100, 0, 'scout');
      enemy.chaseRange = 200;
      enemy.aggro = false;
      const initialX = enemy.x;

      combat.update([enemy], player, 1);

      // Within chase range, should still chase
      expect(enemy.x).toBeLessThan(initialX);
    });
  });

  describe('targetPos override', () => {
    it('enemies chase targetPos instead of player when provided', () => {
      const enemy = createEnemy(100, 0, 'scout');
      // Target is at 200, 0 — enemy should move toward it, away from player at 0,0
      const initialX = enemy.x;
      combat.update([enemy], player, 1, false, 15, () => {}, () => {}, () => {}, { x: 200, y: 0 });
      expect(enemy.x).toBeGreaterThan(initialX);
    });

    it('ranged enemies fire at targetPos, not player', () => {
      // Place ranged enemy between player and target
      const enemy = createEnemy(100, 0, 'ranged');
      enemy.fireRate = 0;
      // Target is at 200, 0
      combat.update([enemy], player, 1, false, 15, () => {}, () => {}, () => {}, { x: 200, y: 0 });
      // Projectile should move toward x=200 (positive vx)
      expect(combat.projectiles.length).toBeGreaterThan(0);
      expect(combat.projectiles[0].vx).toBeGreaterThan(0);
    });

    it('enemies still deal contact damage to player even when targeting base', () => {
      const enemy = createEnemy(5, 0, 'scout');
      combat.update([enemy], player, 1, false, 15, () => {}, () => {}, () => {}, { x: 200, y: 0 });
      expect(player.health).toBeLessThan(player.maxHealth);
    });

    it('wave enemies always chase regardless of distance to target', () => {
      // Wave enemy at 2000px from target — beyond normal chaseRange
      const enemy = createEnemy(2000, 0, 'scout');
      enemy.waveEnemy = true;
      enemy.chaseRange = 200; // normal range is tiny
      const initialX = enemy.x;
      combat.update([enemy], player, 1, false, 15, () => {}, () => {}, () => {}, { x: 0, y: 0 });
      // Should still chase toward target at origin
      expect(enemy.x).toBeLessThan(initialX);
    });
  });

  describe('base damage', () => {
    it('wave enemies deal contact damage to base when within 30px', () => {
      const homeBase = createHomeBase(0, 0);
      const enemy = createEnemy(10, 0, 'brute');
      enemy.waveEnemy = true;
      enemy.damage = 12;
      const initialHP = homeBase.health;

      combat.update([enemy], player, 1, false, 15, () => {}, () => {}, () => {}, undefined, homeBase);

      expect(homeBase.health).toBeLessThan(initialHP);
    });

    it('non-wave enemies do not damage the base', () => {
      const homeBase = createHomeBase(0, 0);
      const enemy = createEnemy(10, 0, 'brute');
      enemy.waveEnemy = false;
      const initialHP = homeBase.health;

      combat.update([enemy], player, 1, false, 15, () => {}, () => {}, () => {}, undefined, homeBase);

      expect(homeBase.health).toBe(initialHP);
    });

    it('wave enemies outside 30px do not damage the base', () => {
      const homeBase = createHomeBase(0, 0);
      const enemy = createEnemy(50, 0, 'scout');
      enemy.waveEnemy = true;
      const initialHP = homeBase.health;

      combat.update([enemy], player, 0.016, false, 15, () => {}, () => {}, () => {}, undefined, homeBase);

      expect(homeBase.health).toBe(initialHP);
    });

    it('base damage is proportional to enemy damage and dt', () => {
      const homeBase = createHomeBase(0, 0);
      const enemy = createEnemy(10, 0, 'brute');
      enemy.waveEnemy = true;
      enemy.damage = 20;

      combat.update([enemy], player, 0.5, false, 15, () => {}, () => {}, () => {}, undefined, homeBase);

      // Damage = 20 * 0.5 = 10
      expect(homeBase.health).toBe(390);
    });
  });

  describe('camera shake on projectile events', () => {
    it('triggers shake when enemy projectile hits the player', () => {
      const onShake = vi.fn();
      combat.onShake = onShake;

      combat.projectiles.push({
        x: 5, y: 0,
        vx: -100, vy: 0,
        damage: 15,
        active: true,
        lifetime: 3,
      });
      combat.update([], player, 0.1);

      expect(onShake).toHaveBeenCalledWith(6);
    });

    it('does not trigger shake when no collisions occur', () => {
      const onShake = vi.fn();
      combat.onShake = onShake;

      const enemy = createEnemy(500, 0, 'scout');
      combat.update([enemy], player, 0.016);

      expect(onShake).not.toHaveBeenCalled();
    });
  });

  describe('salvage damage from projectiles', () => {
    it('enemy projectile within 15px damages salvage', () => {
      const salvage = createSalvage(100, 0);
      combat.projectiles.push({
        x: 100, y: 0,
        vx: 0, vy: 0,
        damage: 8,
        active: true,
        lifetime: 3,
      });

      combat.update([], player, 0.1, false, 15, () => {}, () => {}, () => {}, undefined, undefined, [salvage]);

      expect(salvage.hp).toBe(22); // 30 - 8
      expect(combat.projectiles).toHaveLength(0); // projectile consumed
    });

    it('enemy projectile sets damageFlash on salvage', () => {
      const salvage = createSalvage(100, 0);
      combat.projectiles.push({
        x: 100, y: 0, vx: 0, vy: 0,
        damage: 8, active: true, lifetime: 3,
      });

      combat.update([], player, 0.1, false, 15, () => {}, () => {}, () => {}, undefined, undefined, [salvage]);

      expect(salvage.damageFlash).toBe(0.15);
    });

    it('projectile prioritizes player over salvage', () => {
      const salvage = createSalvage(5, 0); // Near player at origin
      combat.projectiles.push({
        x: 5, y: 0, vx: -100, vy: 0,
        damage: 8, active: true, lifetime: 3,
      });

      combat.update([], player, 0.1, false, 15, () => {}, () => {}, () => {}, undefined, undefined, [salvage]);

      // Player should take damage, salvage should not
      expect(player.health).toBe(92); // 100 - 8
      expect(salvage.hp).toBe(30); // untouched
    });

    it('projectile outside 15px does not damage salvage', () => {
      const salvage = createSalvage(100, 0);
      combat.projectiles.push({
        x: 120, y: 0, vx: 0, vy: 0,
        damage: 8, active: true, lifetime: 3,
      });

      combat.update([], player, 0.1, false, 15, () => {}, () => {}, () => {}, undefined, undefined, [salvage]);

      expect(salvage.hp).toBe(30);
      expect(combat.projectiles).toHaveLength(1);
    });

    it('salvage is destroyed when hp reaches 0', () => {
      const salvage = createSalvage(100, 0);
      salvage.hp = 5;
      combat.projectiles.push({
        x: 100, y: 0, vx: 0, vy: 0,
        damage: 8, active: true, lifetime: 3,
      });

      combat.update([], player, 0.1, false, 15, () => {}, () => {}, () => {}, undefined, undefined, [salvage]);

      expect(salvage.hp).toBe(0);
      expect(salvage.active).toBe(false);
    });

    it('calls onDeath when salvage is destroyed by projectile', () => {
      const onDeath = vi.fn();
      const salvage = createSalvage(100, 0);
      salvage.hp = 5;
      combat.projectiles.push({
        x: 100, y: 0, vx: 0, vy: 0,
        damage: 8, active: true, lifetime: 3,
      });

      combat.update([], player, 0.1, false, 15, () => {}, onDeath, () => {}, undefined, undefined, [salvage]);

      expect(onDeath).toHaveBeenCalled();
    });

    it('calls addFloatingText with damage amount on salvage hit', () => {
      const addFloatingText = vi.fn();
      const salvage = createSalvage(100, 0);
      combat.projectiles.push({
        x: 100, y: 0, vx: 0, vy: 0,
        damage: 8, active: true, lifetime: 3,
      });

      combat.update([], player, 0.1, false, 15, addFloatingText, () => {}, () => {}, undefined, undefined, [salvage]);

      expect(addFloatingText).toHaveBeenCalledWith('-8', 100, 0, expect.any(String));
    });

    it('triggers screen shake when projectile hits salvage', () => {
      const onShake = vi.fn();
      combat.onShake = onShake;
      const salvage = createSalvage(100, 0);
      combat.projectiles.push({
        x: 100, y: 0, vx: 0, vy: 0,
        damage: 8, active: true, lifetime: 3,
      });

      combat.update([], player, 0.1, false, 15, () => {}, () => {}, () => {}, undefined, undefined, [salvage]);

      expect(onShake).toHaveBeenCalledWith(4);
    });

    it('triggers impact particles when projectile hits salvage', () => {
      const onImpact = vi.fn();
      const salvage = createSalvage(100, 0);
      combat.projectiles.push({
        x: 100, y: 0, vx: 0, vy: 0,
        damage: 8, active: true, lifetime: 3,
      });

      combat.update([], player, 0.1, false, 15, () => {}, () => {}, onImpact, undefined, undefined, [salvage]);

      expect(onImpact).toHaveBeenCalledWith(100, 0, 100, 0, expect.any(String));
    });

    it('inactive salvage is not hit by projectiles', () => {
      const salvage = createSalvage(100, 0);
      salvage.active = false;
      combat.projectiles.push({
        x: 100, y: 0, vx: 0, vy: 0,
        damage: 8, active: true, lifetime: 3,
      });

      combat.update([], player, 0.1, false, 15, () => {}, () => {}, () => {}, undefined, undefined, [salvage]);

      expect(salvage.hp).toBe(30);
      expect(combat.projectiles).toHaveLength(1);
    });
  });

  describe('salvage projectile edge cases', () => {
    it('only one salvage is hit per projectile', () => {
      const s1 = createSalvage(100, 0);
      const s2 = createSalvage(100, 5); // Both within 15px
      combat.projectiles.push({
        x: 100, y: 0, vx: 0, vy: 0,
        damage: 8, active: true, lifetime: 3,
      });

      combat.update([], player, 0.1, false, 15, () => {}, () => {}, () => {}, undefined, undefined, [s1, s2]);

      // Only one should be damaged
      const totalDamage = (30 - s1.hp) + (30 - s2.hp);
      expect(totalDamage).toBe(8);
    });

    it('already-destroyed salvage is not hit by subsequent projectiles', () => {
      const salvage = createSalvage(100, 0);
      salvage.hp = 0;
      salvage.active = false;
      combat.projectiles.push({
        x: 100, y: 0, vx: 0, vy: 0,
        damage: 8, active: true, lifetime: 3,
      });

      combat.update([], player, 0.1, false, 15, () => {}, () => {}, () => {}, undefined, undefined, [salvage]);

      // Projectile should pass through
      expect(combat.projectiles).toHaveLength(1);
    });

    it('contact damage is proportional to dt', () => {
      const enemy = createEnemy(502, 0, 'scout');
      enemy.damage = 10;
      const salvage = createSalvage(500, 0);

      combat.update([enemy], player, 0.5, false, 15, () => {}, () => {}, () => {}, undefined, undefined, [salvage]);

      // damage = 10 * 0.5 = 5
      expect(salvage.hp).toBe(25);
    });
  });

  describe('salvage damage from enemy contact', () => {
    it('melee enemy within 25px deals contact damage to salvage', () => {
      const enemy = createEnemy(505, 0, 'scout');
      const salvage = createSalvage(500, 0);

      combat.update([enemy], player, 1, false, 15, () => {}, () => {}, () => {}, undefined, undefined, [salvage]);

      expect(salvage.hp).toBeLessThan(30);
    });

    it('ranged enemies do not deal contact damage to salvage', () => {
      const enemy = createEnemy(502, 0, 'ranged');
      const salvage = createSalvage(500, 0);

      combat.update([enemy], player, 1, false, 15, () => {}, () => {}, () => {}, undefined, undefined, [salvage]);

      expect(salvage.hp).toBe(30);
    });

    it('salvage destroyed by contact damage sets active to false', () => {
      const enemy = createEnemy(502, 0, 'brute');
      enemy.damage = 50;
      const salvage = createSalvage(500, 0);
      salvage.hp = 5;

      combat.update([enemy], player, 1, false, 15, () => {}, () => {}, () => {}, undefined, undefined, [salvage]);

      expect(salvage.active).toBe(false);
      expect(salvage.hp).toBe(0);
    });

    it('enemy outside 25px does not damage salvage', () => {
      const enemy = createEnemy(530, 0, 'scout');
      const salvage = createSalvage(500, 0);

      combat.update([enemy], player, 0.016, false, 15, () => {}, () => {}, () => {}, undefined, undefined, [salvage]);

      expect(salvage.hp).toBe(30);
    });

    it('player collision behavior is unchanged when salvage is provided', () => {
      const enemy = createEnemy(5, 0, 'scout');
      const salvage = createSalvage(500, 0);

      combat.update([enemy], player, 1, false, 15, () => {}, () => {}, () => {}, undefined, undefined, [salvage]);

      expect(player.health).toBeLessThan(player.maxHealth);
    });
  });

  describe('player heal', () => {
    it('player heal method heals by the given amount', () => {
      player.takeDamage(20);
      expect(player.health).toBe(80);
      player.heal(10);
      expect(player.health).toBe(90);
    });

    it('player heal does not exceed maxHealth', () => {
      player.heal(50);
      expect(player.health).toBe(player.maxHealth);
    });
  });
});
