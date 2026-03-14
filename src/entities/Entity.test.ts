import { describe, it, expect } from 'vitest';
import { createResource, createEnemy, createAlly } from './Entity';

describe('Entity factories', () => {
  it('creates a resource at the given position', () => {
    const r = createResource(100, 200);
    expect(r.x).toBe(100);
    expect(r.y).toBe(200);
    expect(r.type).toBe('resource');
    expect(r.active).toBe(true);
    expect(r.energyValue).toBeGreaterThan(0);
  });

  it('creates a scout enemy', () => {
    const e = createEnemy(50, 75, 'scout');
    expect(e.type).toBe('enemy');
    expect(e.subtype).toBe('scout');
    expect(e.speed).toBeGreaterThan(50); // scouts are fast
    expect(e.health).toBeLessThan(30); // scouts are fragile
  });

  it('creates a brute enemy', () => {
    const e = createEnemy(50, 75, 'brute');
    expect(e.subtype).toBe('brute');
    expect(e.health).toBeGreaterThan(50); // brutes are tanky
    expect(e.damage).toBeGreaterThan(5); // brutes hit hard
  });

  it('creates a ranged enemy', () => {
    const e = createEnemy(50, 75, 'ranged');
    expect(e.subtype).toBe('ranged');
    expect(e.fireRate).toBeGreaterThan(0);
    expect(e.projectileSpeed).toBeGreaterThan(0);
  });

  it('creates a healer ally with heal properties', () => {
    const a = createAlly(300, 400, 'healer');
    expect(a.type).toBe('ally');
    expect(a.subtype).toBe('healer');
    expect(a.active).toBe(true);
    expect(a.healAmount).toBeGreaterThan(0);
    expect(a.cooldown).toBeGreaterThan(0);
  });

  it('creates a shield ally with shield properties', () => {
    const a = createAlly(300, 400, 'shield');
    expect(a.subtype).toBe('shield');
    expect(a.shieldReduction).toBeGreaterThan(0);
    expect(a.shieldDuration).toBeGreaterThan(0);
  });

  it('creates a beacon ally with energy properties', () => {
    const a = createAlly(300, 400, 'beacon');
    expect(a.subtype).toBe('beacon');
    expect(a.energyPerSecond).toBeGreaterThan(0);
    expect(a.beaconRange).toBeGreaterThan(0);
  });

  it('creates a random ally subtype when none specified', () => {
    const a = createAlly(300, 400);
    expect(['healer', 'shield', 'beacon']).toContain(a.subtype);
  });

  it('creates enemies with ghost marker and wander fields initialized', () => {
    const e = createEnemy(50, 75, 'scout');
    expect(e.pingVisible).toBe(false);
    expect(e.ghostX).toBeNull();
    expect(e.ghostY).toBeNull();
    expect(e.wanderAngle).toBeGreaterThanOrEqual(0);
    expect(e.wanderAngle).toBeLessThan(Math.PI * 2);
    expect(e.wanderTimer).toBeGreaterThan(0);
  });
});
