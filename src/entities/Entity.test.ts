import { describe, it, expect } from 'vitest';
import { createResource, createEnemy, createHomeBase, createSalvage, createAsteroid } from './Entity';

describe('Entity factories', () => {
  it('creates a resource at the given position', () => {
    const r = createResource(100, 200);
    expect(r.x).toBe(100);
    expect(r.y).toBe(200);
    expect(r.type).toBe('resource');
    expect(r.active).toBe(true);
    expect(r.visible).toBe(true);
    expect(r.pingedThisWave).toBe(false);
    expect(r.energyValue).toBeGreaterThan(0);
  });

  it('creates a scout enemy', () => {
    const e = createEnemy(50, 75, 'scout');
    expect(e.type).toBe('enemy');
    expect(e.subtype).toBe('scout');
    expect(e.visible).toBe(false);
    expect(e.pingedThisWave).toBe(false);
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

  it('creates a home base with health, maxHealth, and buildings', () => {
    const hb = createHomeBase(100, 200);
    expect(hb.x).toBe(100);
    expect(hb.y).toBe(200);
    expect(hb.radius).toBe(150);
    expect(hb.health).toBe(500);
    expect(hb.maxHealth).toBe(500);
    // Buildings initialized at level 0
    expect(hb.buildings.player).toEqual({ level: 0, maxLevel: 5 });
    expect(hb.buildings.mining).toEqual({ level: 0, maxLevel: 5 });
    expect(hb.buildings.combat).toEqual({ level: 0, maxLevel: 5 });
  });

  it('creates enemies with waveEnemy and isBoss defaulting to false', () => {
    const e = createEnemy(50, 75, 'scout');
    expect(e.waveEnemy).toBe(false);
    expect(e.isBoss).toBe(false);
  });

  it('creates enemies with ghost marker and wander fields initialized', () => {
    const e = createEnemy(50, 75, 'scout');
    expect(e.ghostX).toBeNull();
    expect(e.ghostY).toBeNull();
    expect(e.wanderAngle).toBeGreaterThanOrEqual(0);
    expect(e.wanderAngle).toBeLessThan(Math.PI * 2);
    expect(e.wanderTimer).toBeGreaterThan(0);
  });

  it('creates salvage with HP, maxHp, and damageFlash fields', () => {
    const s = createSalvage(50, 75);
    expect(s.type).toBe('salvage');
    expect(s.hp).toBe(30);
    expect(s.maxHp).toBe(30);
    expect(s.damageFlash).toBe(0);
    expect(s.towedByPlayer).toBe(false);
    expect(s.active).toBe(true);
  });

  it('creates a small asteroid with correct stats', () => {
    const a = createAsteroid(100, 200, 'small');
    expect(a.type).toBe('asteroid');
    expect(a.size).toBe('small');
    expect(a.x).toBe(100);
    expect(a.y).toBe(200);
    expect(a.active).toBe(true);
    expect(a.visible).toBe(true);
    expect(a.pingedThisWave).toBe(false);
    expect(a.energyValue).toBeGreaterThanOrEqual(10);
    expect(a.energyValue).toBeLessThanOrEqual(15);
    expect(a.hp).toBe(20);
    expect(a.maxHp).toBe(20);
    expect(a.damageFlash).toBe(0);
    expect(a.miningActive).toBe(false);
    expect(a.miningProgress).toBe(0);
  });

  it('creates a medium asteroid with correct stats', () => {
    const a = createAsteroid(0, 0, 'medium');
    expect(a.size).toBe('medium');
    expect(a.energyValue).toBeGreaterThanOrEqual(20);
    expect(a.energyValue).toBeLessThanOrEqual(35);
    expect(a.hp).toBe(40);
    expect(a.maxHp).toBe(40);
  });

  it('creates a large asteroid with correct stats', () => {
    const a = createAsteroid(0, 0, 'large');
    expect(a.size).toBe('large');
    expect(a.energyValue).toBeGreaterThanOrEqual(40);
    expect(a.energyValue).toBeLessThanOrEqual(60);
    expect(a.hp).toBe(80);
    expect(a.maxHp).toBe(80);
  });

  it('creates a random asteroid size when none specified', () => {
    const sizes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      sizes.add(createAsteroid(0, 0).size);
    }
    expect(sizes.has('small')).toBe(true);
    expect(sizes.has('medium')).toBe(true);
    expect(sizes.has('large')).toBe(true);
  });
});
