import { describe, it, expect, beforeEach } from 'vitest';
import { CombatSystem } from './CombatSystem';
import { Player } from '../entities/Player';
import { createEnemy } from '../entities/Entity';

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
});
