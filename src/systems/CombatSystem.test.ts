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

  it('enemies do not chase when outside chase range', () => {
    const enemy = createEnemy(1000, 0, 'scout');
    const initialX = enemy.x;
    combat.update([enemy], player, 1);
    expect(enemy.x).toBe(initialX);
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
});
