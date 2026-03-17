import { describe, it, expect, beforeEach } from 'vitest';
import { PingSystem } from './PingSystem';
import { Player } from '../entities/Player';
import { createEnemy, createAsteroid } from '../entities/Entity';

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

  it('does not damage enemies when the ping reaches them', () => {
    const enemy = createEnemy(50, 0);
    enemy.health = 50;

    const events = ping.update([enemy], player, 0.1);
    expect(events).toHaveLength(0);
    expect(enemy.health).toBe(50);
  });

  it('does not collect asteroids when the ping reaches them', () => {
    const asteroid = createAsteroid(50, 0, 'medium');
    const initialEnergy = player.energy;

    const events = ping.update([asteroid], player, 0.1);
    expect(events).toHaveLength(0);
    expect(asteroid.active).toBe(true);
    expect(asteroid.hp).toBe(40); // unchanged
    expect(player.energy).toBe(initialEnergy);
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
    const enemy = createEnemy(50, 0);

    // First reveal
    ping.update([enemy], player, 0.1);
    expect(enemy.visible).toBe(true);

    // Create another enemy that's already pinged
    const enemy2 = createEnemy(50, 0);
    enemy2.pingedThisWave = true;
    // Should stay invisible since it was already pinged
    ping.update([enemy2], player, 0.1);
    expect(enemy2.visible).toBe(false);
  });

  it('ignores entities outside max radius', () => {
    const enemy = createEnemy(500, 0);

    const events = ping.update([enemy], player, 0.1);
    expect(events).toHaveLength(0);
    expect(enemy.visible).toBe(false);
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

  it('does not kill enemies or drop energy via ping', () => {
    const enemy = createEnemy(50, 0);
    enemy.health = 5;
    enemy.energyDrop = 20;

    ping.update([enemy], player, 0.1);
    expect(enemy.active).toBe(true);
    expect(enemy.health).toBe(5);
    expect(player.energy).toBe(0);
  });

  it('ping resets to inactive after reaching max radius', () => {
    // maxRadius=300, speed=600, deceleration=0 => reaches 300 in 0.5s
    ping.update([], player, 0.016); // fire
    expect(ping.getState().active).toBe(true);

    ping.update([], player, 0.6); // expand past max
    expect(ping.getState().active).toBe(false);
    expect(ping.getState().radius).toBe(0);
  });

  it('enters cooldown after ping completes', () => {
    const pingWithCooldown = new PingSystem({
      cooldown: 0,
      maxRadius: 300,
      initialSpeed: 600,
      deceleration: 0,
    });

    // Fire and complete ping
    pingWithCooldown.update([], player, 0.016);
    pingWithCooldown.update([], player, 0.6);
    expect(pingWithCooldown.getState().active).toBe(false);

    // Cooldown is 0, so next update fires immediately
    pingWithCooldown.update([], player, 0.016);
    expect(pingWithCooldown.getState().active).toBe(true);
  });

  it('setMaxRadius and setCooldown modify config', () => {
    const p = new PingSystem();
    p.setMaxRadius(500);
    p.setCooldown(3);
    expect(p.getConfig().maxRadius).toBe(500);
    expect(p.getConfig().cooldown).toBe(3);
  });

  it('creates ghost marker when new ping hides a visible enemy', () => {
    const enemy = createEnemy(50, 0, 'scout');

    // First ping reveals the enemy
    ping.update([enemy], player, 0.1);
    expect(enemy.visible).toBe(true);
    expect(enemy.ghostX).toBeNull();

    // Complete the ping
    ping.update([enemy], player, 0.5);

    // Fire new ping — enemy gets hidden, ghost created at current position
    ping.update([enemy], player, 0.016);
    // Enemy at dist=50, ping radius ≈ 9.6 < 50, so not yet re-revealed
    expect(enemy.visible).toBe(false);
    expect(enemy.ghostX).toBe(enemy.x);
    expect(enemy.ghostY).toBe(enemy.y);
  });

  it('clears ghost marker when enemy is re-pinged', () => {
    const enemy = createEnemy(50, 0, 'scout');

    // First ping reveals
    ping.update([enemy], player, 0.1);

    // Complete ping, fire new ping (creates ghost), then expand past enemy
    ping.update([enemy], player, 0.5);
    ping.update([enemy], player, 0.016); // new ping fires, ghost created
    expect(enemy.ghostX).not.toBeNull();

    // Expand enough to re-reveal enemy (speed=600, need dt to reach 50px)
    ping.update([enemy], player, 0.1);
    expect(enemy.visible).toBe(true);
    expect(enemy.ghostX).toBeNull();
    expect(enemy.ghostY).toBeNull();
  });

  it('does not create ghost for enemies that were never visible', () => {
    // Enemy beyond max radius — never revealed
    const enemy = createEnemy(500, 0, 'scout');
    expect(enemy.visible).toBe(false);

    // Complete a full ping cycle
    ping.update([enemy], player, 0.1);
    ping.update([enemy], player, 0.5);
    ping.update([enemy], player, 0.016); // new ping fires

    // No ghost since enemy was never visible
    expect(enemy.ghostX).toBeNull();
    expect(enemy.ghostY).toBeNull();
  });
});
