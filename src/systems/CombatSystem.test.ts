import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CombatSystem } from './CombatSystem';
import { Player } from '../entities/Player';
import { createEnemy, createHomeBase, createTurret, createRepairStation, Defense } from '../entities/Entity';

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
      expect(homeBase.health).toBe(490);
    });
  });

  describe('turret AI', () => {
    it('turret fires projectile at nearest enemy within range', () => {
      const turret = createTurret(0, 0);
      turret.lastFireTime = -10; // ensure cooldown has elapsed
      const enemy = createEnemy(100, 0, 'scout');
      enemy.active = true;

      combat.updateTurrets([turret], [enemy], 1, 0.1);

      expect(combat.turretProjectiles.length).toBe(1);
      expect(combat.turretProjectiles[0].vx).toBeGreaterThan(0); // aimed toward enemy at x=100
    });

    it('turret does not fire when no enemies in range', () => {
      const turret = createTurret(0, 0);
      turret.range = 200;
      const enemy = createEnemy(500, 0, 'scout');

      combat.updateTurrets([turret], [enemy], 1, 0.1);

      expect(combat.turretProjectiles.length).toBe(0);
    });

    it('turret respects fire rate cooldown', () => {
      const turret = createTurret(0, 0);
      turret.fireRate = 1; // 1 shot per second
      turret.lastFireTime = 0.5;
      const enemy = createEnemy(100, 0, 'scout');

      // gameTime=0.8, lastFireTime=0.5 — only 0.3s elapsed, need 1s
      combat.updateTurrets([turret], [enemy], 0.8, 0.1);

      expect(combat.turretProjectiles.length).toBe(0);
    });

    it('turret fires when cooldown has elapsed', () => {
      const turret = createTurret(0, 0);
      turret.fireRate = 1;
      turret.lastFireTime = 0;
      const enemy = createEnemy(100, 0, 'scout');

      // gameTime=1.5, lastFireTime=0 — 1.5s elapsed, need 1s
      combat.updateTurrets([turret], [enemy], 1.5, 0.1);

      expect(combat.turretProjectiles.length).toBe(1);
      expect(turret.lastFireTime).toBe(1.5);
    });

    it('inactive turret does not fire', () => {
      const turret = createTurret(0, 0);
      turret.active = false;
      turret.lastFireTime = -10;
      const enemy = createEnemy(100, 0, 'scout');

      combat.updateTurrets([turret], [enemy], 1, 0.1);

      expect(combat.turretProjectiles.length).toBe(0);
    });

    it('turret targets nearest enemy when multiple in range', () => {
      const turret = createTurret(0, 0);
      turret.lastFireTime = -10;
      const farEnemy = createEnemy(150, 0, 'scout');
      const nearEnemy = createEnemy(50, 0, 'scout');

      combat.updateTurrets([turret], [farEnemy, nearEnemy], 1, 0.1);

      expect(combat.turretProjectiles.length).toBe(1);
      // Projectile should be aimed at the nearer enemy
      expect(combat.turretProjectiles[0].damage).toBe(turret.damage);
    });

    it('turret updates aimDirection toward target', () => {
      const turret = createTurret(0, 0);
      turret.lastFireTime = -10;
      const enemy = createEnemy(0, 100, 'scout'); // directly below

      combat.updateTurrets([turret], [enemy], 1, 0.1);

      // aimDirection should be ~PI/2 (pointing down/toward y=100)
      expect(turret.aimDirection).toBeCloseTo(Math.PI / 2, 1);
    });

    it('turret projectiles have correct speed and damage', () => {
      const turret = createTurret(0, 0);
      turret.lastFireTime = -10;
      turret.damage = 7;
      const enemy = createEnemy(100, 0, 'scout');

      combat.updateTurrets([turret], [enemy], 1, 0.1);

      const proj = combat.turretProjectiles[0];
      expect(proj.damage).toBe(7);
      // Speed should be ~150 px/s
      const speed = Math.sqrt(proj.vx * proj.vx + proj.vy * proj.vy);
      expect(speed).toBeCloseTo(150, 0);
    });

    it('turret ignores inactive enemies', () => {
      const turret = createTurret(0, 0);
      turret.lastFireTime = -10;
      const enemy = createEnemy(100, 0, 'scout');
      enemy.active = false;

      combat.updateTurrets([turret], [enemy], 1, 0.1);

      expect(combat.turretProjectiles.length).toBe(0);
    });
  });

  describe('turret projectile vs enemy collision', () => {
    it('turret projectile damages enemy on contact', () => {
      const enemy = createEnemy(100, 0, 'scout');
      enemy.health = 15;
      // Place turret projectile right next to enemy
      combat.turretProjectiles.push({
        x: 100, y: 0,
        vx: 0, vy: 0,
        damage: 5,
        active: true,
        lifetime: 3,
      });

      combat.update([enemy], player, 0.016);

      expect(enemy.health).toBe(10); // 15 - 5
      expect(combat.turretProjectiles.length).toBe(0); // consumed
    });

    it('turret projectile kills enemy and awards score', () => {
      const enemy = createEnemy(100, 0, 'scout');
      enemy.health = 3;
      enemy.energyDrop = 10;
      combat.turretProjectiles.push({
        x: 100, y: 0,
        vx: 0, vy: 0,
        damage: 5,
        active: true,
        lifetime: 3,
      });

      combat.update([enemy], player, 0.016);

      expect(enemy.active).toBe(false);
      expect(player.kills).toBe(1);
      expect(player.score).toBe(50);
      expect(player.energy).toBe(10);
    });

    it('turret projectiles expire after lifetime', () => {
      combat.turretProjectiles.push({
        x: 500, y: 500,
        vx: 10, vy: 0,
        damage: 5,
        active: true,
        lifetime: 0.1,
      });

      combat.update([], player, 0.2);

      expect(combat.turretProjectiles.length).toBe(0);
    });

    it('turret projectiles do not damage the player', () => {
      combat.turretProjectiles.push({
        x: 5, y: 0,
        vx: -100, vy: 0,
        damage: 15,
        active: true,
        lifetime: 3,
      });

      combat.update([], player, 0.1);

      expect(player.health).toBe(player.maxHealth);
    });
  });

  describe('enemy damage to defenses', () => {
    it('enemy within 30px damages defense health', () => {
      const turret = createTurret(100, 0);
      turret.health = 50;
      const enemy = createEnemy(110, 0, 'scout');
      enemy.damage = 10;
      const defenses: Defense[] = [turret];

      combat.update([enemy], player, 1, false, 15, () => {}, () => {}, () => {}, undefined, undefined, defenses);

      expect(turret.health).toBeLessThan(50);
    });

    it('enemy outside 30px does not damage defense', () => {
      const turret = createTurret(100, 0);
      const enemy = createEnemy(200, 0, 'scout');
      enemy.damage = 10;
      const defenses: Defense[] = [turret];

      combat.update([enemy], player, 0.1, false, 15, () => {}, () => {}, () => {}, undefined, undefined, defenses);

      expect(turret.health).toBe(50);
    });

    it('defense becomes inactive when health reaches 0', () => {
      const turret = createTurret(100, 0);
      turret.health = 5;
      const enemy = createEnemy(105, 0, 'brute');
      enemy.damage = 20;
      const defenses: Defense[] = [turret];

      combat.update([enemy], player, 1, false, 15, () => {}, () => {}, () => {}, undefined, undefined, defenses);

      expect(turret.active).toBe(false);
      expect(turret.health).toBeLessThanOrEqual(0);
    });

    it('inactive defenses are not damaged further', () => {
      const turret = createTurret(100, 0);
      turret.active = false;
      turret.health = 0;
      const enemy = createEnemy(105, 0, 'brute');
      enemy.damage = 20;
      const defenses: Defense[] = [turret];

      combat.update([enemy], player, 1, false, 15, () => {}, () => {}, () => {}, undefined, undefined, defenses);

      expect(turret.health).toBe(0); // not further reduced
    });

    it('repair stations can be damaged by enemies', () => {
      const station = createRepairStation(100, 0);
      station.health = 30;
      const enemy = createEnemy(105, 0, 'scout');
      enemy.damage = 6;
      const defenses: Defense[] = [station];

      combat.update([enemy], player, 1, false, 15, () => {}, () => {}, () => {}, undefined, undefined, defenses);

      expect(station.health).toBeLessThan(30);
    });

    it('ranged enemies also damage defenses on contact', () => {
      const turret = createTurret(100, 0);
      turret.health = 50;
      const enemy = createEnemy(105, 0, 'ranged');
      // ranged enemies have damage=0 normally, but they still have a damage field
      enemy.damage = 5;
      const defenses: Defense[] = [turret];

      combat.update([enemy], player, 1, false, 15, () => {}, () => {}, () => {}, undefined, undefined, defenses);

      expect(turret.health).toBeLessThan(50);
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

      expect(onShake).toHaveBeenCalledWith(3);
    });

    it('triggers shake when turret projectile hits an enemy', () => {
      const onShake = vi.fn();
      combat.onShake = onShake;

      const enemy = createEnemy(100, 0, 'scout');
      enemy.health = 50;
      combat.turretProjectiles.push({
        x: 100, y: 0,
        vx: 0, vy: 0,
        damage: 5,
        active: true,
        lifetime: 3,
      });

      combat.update([enemy], player, 0.016);

      expect(onShake).toHaveBeenCalledWith(2);
    });

    it('triggers shake when turret fires a projectile', () => {
      const onShake = vi.fn();
      combat.onShake = onShake;

      const turret = createTurret(0, 0);
      turret.lastFireTime = -10;
      const enemy = createEnemy(100, 0, 'scout');

      combat.updateTurrets([turret], [enemy], 1, 0.1);

      expect(onShake).toHaveBeenCalledWith(1.5);
    });

    it('does not trigger shake when no collisions occur', () => {
      const onShake = vi.fn();
      combat.onShake = onShake;

      const enemy = createEnemy(500, 0, 'scout');
      combat.update([enemy], player, 0.016);

      expect(onShake).not.toHaveBeenCalled();
    });
  });

  describe('repair station healing', () => {
    // Note: repair station healing is handled in main.ts, not CombatSystem.
    // These tests verify the Player.heal() method works correctly for this use case.
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
