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
