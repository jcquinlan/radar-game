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

  it('creates an ally at the given position', () => {
    const a = createAlly(300, 400);
    expect(a.x).toBe(300);
    expect(a.y).toBe(400);
    expect(a.type).toBe('ally');
    expect(a.active).toBe(true);
    expect(a.healAmount).toBeGreaterThan(0);
    expect(a.cooldown).toBeGreaterThan(0);
  });
});
