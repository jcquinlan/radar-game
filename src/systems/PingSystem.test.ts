import { describe, it, expect, beforeEach } from 'vitest';
import { PingSystem } from './PingSystem';
import { Player } from '../entities/Player';
import { createResource, createEnemy, createAlly } from '../entities/Entity';

describe('PingSystem', () => {
  let ping: PingSystem;
  let player: Player;

  beforeEach(() => {
    // Start with no cooldown so the first update fires immediately
    ping = new PingSystem({ cooldown: 0, maxRadius: 300, initialSpeed: 600, deceleration: 0 });
    player = new Player(0, 0);
  });

  it('fires a ping on the first update after cooldown expires', () => {
    ping.update([], player, 0.016);
    expect(ping.getState().active).toBe(true);
    expect(ping.getState().radius).toBeGreaterThan(0);
  });

  it('collects a resource when the ping reaches it', () => {
    const resource = createResource(50, 0);
    resource.energyValue = 15;

    // First update fires ping, expand enough to reach 50px
    // speed=600, dt=0.1 => radius = 60
    const events = ping.update([resource], player, 0.1);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('collect');
    expect(events[0].value).toBe(15);
    expect(player.energy).toBe(15);
    expect(resource.active).toBe(false);
  });

  it('damages an enemy when the ping reaches it', () => {
    const enemy = createEnemy(50, 0);
    enemy.health = 50;
    player.sweepDamage = 10;

    const events = ping.update([enemy], player, 0.1);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('damage');
    expect(enemy.health).toBe(40);
  });

  it('reveals enemies when the ping reaches them', () => {
    const enemy = createEnemy(50, 0);
    expect(enemy.visible).toBe(false);

    ping.update([enemy], player, 0.1);
    expect(enemy.visible).toBe(true);
  });

  it('hides enemies when a new ping fires', () => {
    const enemy = createEnemy(50, 0);

    // First ping reveals the enemy
    ping.update([enemy], player, 0.1);
    expect(enemy.visible).toBe(true);

    // Advance until ping finishes (radius > maxRadius)
    // maxRadius=300, speed=600, need 0.5s total
    ping.update([enemy], player, 0.5);

    // Now in cooldown, enemy still visible
    expect(enemy.visible).toBe(true);

    // Cooldown is 0, so next update fires new ping — enemies hidden first
    ping.update([enemy], player, 0.016);
    // Enemy at dist=50, ping radius after 0.016s = 600*0.016 = 9.6 < 50
    // So enemy was hidden and not yet re-revealed
    expect(enemy.visible).toBe(false);
  });

  it('does not interact with the same entity twice per ping wave', () => {
    const resource = createResource(50, 0);
    resource.energyValue = 10;

    ping.update([resource], player, 0.1);
    expect(resource.active).toBe(false);

    // Create another resource that's already pinged
    const resource2 = createResource(50, 0);
    resource2.pingedThisWave = true;
    const events = ping.update([resource2], player, 0.1);
    expect(events).toHaveLength(0);
  });

  it('ignores entities outside max radius', () => {
    const resource = createResource(500, 0);
    resource.energyValue = 10;

    const events = ping.update([resource], player, 0.1);
    expect(events).toHaveLength(0);
    expect(player.energy).toBe(0);
  });

  it('heals the player when ping reaches a healer ally', () => {
    player.takeDamage(30);
    const ally = createAlly(50, 0, 'healer');
    ally.healAmount = 10;

    const events = ping.update([ally], player, 0.1);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('heal');
    expect(player.health).toBe(80);
  });

  it('applies shield when ping reaches a shield ally', () => {
    const ally = createAlly(50, 0, 'shield');

    const events = ping.update([ally], player, 0.1);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('shield');
    expect(player.shieldActive).toBe(true);
  });

  it('respects ally heal cooldown', () => {
    player.takeDamage(50);
    const ally = createAlly(50, 0, 'healer');
    ally.healAmount = 10;
    ally.cooldown = 3;

    // First heal works
    ping.update([ally], player, 0.1);
    expect(player.health).toBe(60);

    // Reset flag manually to simulate next wave
    ally.pingedThisWave = false;

    // Second heal too soon
    const events = ping.update([ally], player, 0.1);
    expect(events).toHaveLength(0);
    expect(player.health).toBe(60);
  });

  it('ping decelerates over time', () => {
    const pingWithDecel = new PingSystem({
      cooldown: 0,
      maxRadius: 1000,
      initialSpeed: 600,
      deceleration: 2.0,
    });

    pingWithDecel.update([], player, 0.016);
    const speed1 = pingWithDecel.getState().speed;

    pingWithDecel.update([], player, 0.5);
    const speed2 = pingWithDecel.getState().speed;

    expect(speed2).toBeLessThan(speed1);
  });

  it('ping alpha fades as it expands', () => {
    ping.update([], player, 0.016);
    const alpha1 = ping.getState().alpha;

    ping.update([], player, 0.1);
    const alpha2 = ping.getState().alpha;

    expect(alpha2).toBeLessThan(alpha1);
  });

  it('resources and allies remain visible (not affected by ping visibility)', () => {
    const resource = createResource(50, 0);
    const ally = createAlly(80, 0, 'healer');

    expect(resource.visible).toBe(true);
    expect(ally.visible).toBe(true);

    // Fire ping and let it pass
    ping.update([resource, ally], player, 0.5);

    // Resources and allies visibility is not toggled off by new pings
    // (only enemies get hidden)
    expect(ally.visible).toBe(true);
  });
});
