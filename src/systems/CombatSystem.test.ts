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

  it('enemies chase the player when within chase range', () => {
    const enemy = createEnemy(100, 0);
    enemy.chaseRange = 250;
    enemy.speed = 50;

    const initialX = enemy.x;
    combat.update([enemy], player, 1);

    // Enemy should have moved toward the player (x decreased)
    expect(enemy.x).toBeLessThan(initialX);
  });

  it('enemies do not chase when outside chase range', () => {
    const enemy = createEnemy(1000, 0);
    enemy.chaseRange = 250;
    enemy.speed = 50;

    const initialX = enemy.x;
    combat.update([enemy], player, 1);

    expect(enemy.x).toBe(initialX);
  });

  it('enemies deal contact damage when close to the player', () => {
    const enemy = createEnemy(5, 0); // Very close to player
    enemy.damage = 10;

    combat.update([enemy], player, 1);

    expect(player.health).toBeLessThan(player.maxHealth);
  });

  it('returns false when player dies', () => {
    const enemy = createEnemy(5, 0);
    enemy.damage = 200; // Lethal damage

    const alive = combat.update([enemy], player, 1);

    expect(alive).toBe(false);
    expect(player.isAlive()).toBe(false);
  });

  it('returns true when player is alive', () => {
    const enemy = createEnemy(500, 0); // Far away, no damage
    enemy.chaseRange = 100;

    const alive = combat.update([enemy], player, 1);

    expect(alive).toBe(true);
  });

  it('ignores inactive enemies', () => {
    const enemy = createEnemy(5, 0);
    enemy.damage = 200;
    enemy.active = false;

    const alive = combat.update([enemy], player, 1);

    expect(alive).toBe(true);
    expect(player.health).toBe(player.maxHealth);
  });
});
