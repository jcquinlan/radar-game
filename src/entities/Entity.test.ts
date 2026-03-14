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

  it('creates an enemy at the given position', () => {
    const e = createEnemy(50, 75);
    expect(e.x).toBe(50);
    expect(e.y).toBe(75);
    expect(e.type).toBe('enemy');
    expect(e.active).toBe(true);
    expect(e.health).toBeGreaterThan(0);
    expect(e.damage).toBeGreaterThan(0);
    expect(e.speed).toBeGreaterThan(0);
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
});
