import { describe, it, expect, beforeEach } from 'vitest';
import { SweepSystem } from './SweepSystem';
import { Player } from '../entities/Player';
import { createResource, createEnemy, createAlly, GameEntity } from '../entities/Entity';

describe('SweepSystem', () => {
  let sweep: SweepSystem;
  let player: Player;

  beforeEach(() => {
    sweep = new SweepSystem();
    player = new Player(0, 0);
  });

  it('collects a resource when the sweep passes over it', () => {
    // Place resource to the right of the player (angle = 0)
    const resource = createResource(100, 0);
    resource.energyValue = 15;

    const events = sweep.update(0.1, [resource], player, 300, 0.016);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('collect');
    expect(events[0].value).toBe(15);
    expect(player.energy).toBe(15);
    expect(resource.active).toBe(false);
  });

  it('damages an enemy when the sweep passes over it', () => {
    const enemy = createEnemy(100, 0);
    enemy.health = 50;
    player.sweepDamage = 10;

    const events = sweep.update(0.1, [enemy], player, 300, 0.016);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('damage');
    expect(enemy.health).toBe(40);
  });

  it('destroys an enemy and drops energy when health reaches 0', () => {
    const enemy = createEnemy(100, 0);
    enemy.health = 5;
    enemy.energyDrop = 20;
    player.sweepDamage = 10;

    const events = sweep.update(0.1, [enemy], player, 300, 0.016);
    expect(enemy.active).toBe(false);
    expect(player.energy).toBe(20);
  });

  it('heals the player when the sweep passes over a healer ally', () => {
    player.takeDamage(30);
    const ally = createAlly(100, 0, 'healer');
    ally.healAmount = 10;

    const events = sweep.update(0.1, [ally], player, 300, 0.016);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('heal');
    expect(player.health).toBe(80); // 70 + 10
  });

  it('applies shield when the sweep passes over a shield ally', () => {
    const ally = createAlly(100, 0, 'shield');

    const events = sweep.update(0.1, [ally], player, 300, 0.016);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('shield');
    expect(player.shieldActive).toBe(true);
  });

  it('does not interact with the same entity twice per rotation', () => {
    const resource = createResource(100, 0);
    resource.energyValue = 10;

    sweep.update(0.1, [resource], player, 300, 0.016);
    expect(resource.active).toBe(false);

    // Even if we try again with a new resource at same spot (but sweptThisRotation is true)
    const resource2 = createResource(100, 0);
    resource2.sweptThisRotation = true;
    const events = sweep.update(0.2, [resource2], player, 300, 0.016);
    expect(events).toHaveLength(0);
  });

  it('ignores entities outside radar range', () => {
    const resource = createResource(500, 0);
    resource.energyValue = 10;

    const events = sweep.update(0.1, [resource], player, 300, 0.016);
    expect(events).toHaveLength(0);
    expect(player.energy).toBe(0);
  });

  it('sets pingVisible on enemy when sweep crosses it', () => {
    const enemy = createEnemy(100, 0, 'scout');
    expect(enemy.pingVisible).toBe(false);

    sweep.update(0.1, [enemy], player, 300, 0.016);
    expect(enemy.pingVisible).toBe(true);
  });

  it('creates ghost marker when sweep rotation resets', () => {
    // Place enemy at angle PI (behind player) so it's NOT in the wrap arc near 0
    const enemy = createEnemy(-100, 0, 'scout'); // angle = PI

    // Sweep past PI to hit the enemy
    sweep.update(Math.PI + 0.1, [enemy], player, 300, 0.016);
    expect(enemy.pingVisible).toBe(true);

    // Advance sweep to near 2*PI
    sweep.update(Math.PI * 2 - 0.01, [enemy], player, 300, 0.016);

    // Wrap around — enemy at angle PI is NOT in wrap arc [~6.27, 0.05]
    sweep.update(0.05, [enemy], player, 300, 0.016);

    // Ghost should be created at enemy's position, pingVisible should be false
    expect(enemy.pingVisible).toBe(false);
    expect(enemy.ghostX).toBe(enemy.x);
    expect(enemy.ghostY).toBe(enemy.y);
  });

  it('clears ghost marker when enemy is re-swept', () => {
    // Place enemy at angle PI
    const enemy = createEnemy(-100, 0, 'scout');

    // Sweep to hit enemy, then trigger rotation reset to create ghost
    sweep.update(Math.PI + 0.1, [enemy], player, 300, 0.016);
    sweep.update(Math.PI * 2 - 0.01, [enemy], player, 300, 0.016);
    sweep.update(0.05, [enemy], player, 300, 0.016);
    expect(enemy.ghostX).not.toBeNull();

    // Re-sweep the enemy by sweeping past PI again
    sweep.update(Math.PI + 0.1, [enemy], player, 300, 0.016);

    expect(enemy.pingVisible).toBe(true);
    expect(enemy.ghostX).toBeNull();
    expect(enemy.ghostY).toBeNull();
  });

  it('does not create ghost for enemies that were never pinged', () => {
    // Enemy exists but is outside radar range — never swept
    const enemy = createEnemy(500, 0, 'scout');
    expect(enemy.pingVisible).toBe(false);

    // Full sweep rotation with enemy out of range
    sweep.update(Math.PI * 2 - 0.01, [enemy], player, 300, 0.016);
    sweep.update(0.05, [enemy], player, 300, 0.016);

    // No ghost created since enemy was never visible
    expect(enemy.ghostX).toBeNull();
    expect(enemy.ghostY).toBeNull();
  });

  it('respects ally heal cooldown', () => {
    player.takeDamage(50);
    const ally = createAlly(100, 0, 'healer');
    ally.healAmount = 10;
    ally.cooldown = 3;

    // First heal works
    sweep.update(0.1, [ally], player, 300, 0.016);
    expect(player.health).toBe(60);

    // Reset sweep rotation flag to simulate next rotation
    ally.sweptThisRotation = false;

    // Second heal too soon — should return no event
    const events = sweep.update(0.2, [ally], player, 300, 0.016);
    expect(events).toHaveLength(0);
    expect(player.health).toBe(60); // unchanged
  });
});
