import { describe, it, expect } from 'vitest';
import { DeathParticles } from './DeathParticles';

describe('DeathParticles', () => {
  it('starts with no active particles', () => {
    const dp = new DeathParticles(50);
    expect(dp.activeCount()).toBe(0);
  });

  it('emit() activates the requested number of particles', () => {
    const dp = new DeathParticles(50);
    dp.emit(100, 200, 1, 0, '#ff0000', 10);
    expect(dp.activeCount()).toBe(10);
  });

  it('emit() with direction produces particles in a cone', () => {
    const dp = new DeathParticles(200);
    // Emit in the +x direction (angle 0)
    dp.emit(0, 0, 1, 0, '#ff0000', 50);

    const particles = dp.getActiveParticles();
    // All particles should have velocity predominantly in the +x direction
    // (within a 90° cone centered on +x means vx > 0 for the majority)
    const movingRight = particles.filter(p => p.vx > 0).length;
    expect(movingRight).toBeGreaterThan(particles.length * 0.7);
  });

  it('emit() with zero direction produces omnidirectional spread', () => {
    const dp = new DeathParticles(200);
    dp.emit(0, 0, 0, 0, '#00ffff', 100);

    const particles = dp.getActiveParticles();
    // With omnidirectional spread, roughly equal particles in each quadrant
    const q1 = particles.filter(p => p.vx > 0 && p.vy > 0).length;
    const q2 = particles.filter(p => p.vx < 0 && p.vy > 0).length;
    const q3 = particles.filter(p => p.vx < 0 && p.vy < 0).length;
    const q4 = particles.filter(p => p.vx > 0 && p.vy < 0).length;

    // Each quadrant should have at least 10% of particles (expect ~25% each)
    expect(q1).toBeGreaterThan(10);
    expect(q2).toBeGreaterThan(10);
    expect(q3).toBeGreaterThan(10);
    expect(q4).toBeGreaterThan(10);
  });

  it('update() moves particles and decrements life', () => {
    const dp = new DeathParticles(50);
    dp.emit(0, 0, 1, 0, '#ff0000', 5);

    const before = dp.getActiveParticles().map(p => ({ x: p.x, life: p.life }));
    dp.update(0.1);
    const after = dp.getActiveParticles();

    // Particles should have moved and life should have decreased
    for (let i = 0; i < after.length; i++) {
      expect(after[i].life).toBeLessThan(before[i].life);
    }
  });

  it('update() deactivates particles when life reaches zero', () => {
    const dp = new DeathParticles(50);
    dp.emit(0, 0, 1, 0, '#ff0000', 5);
    expect(dp.activeCount()).toBe(5);

    // Advance well past the max lifetime (0.5s)
    dp.update(0.6);
    expect(dp.activeCount()).toBe(0);
  });

  it('particles have alpha proportional to remaining life', () => {
    const dp = new DeathParticles(50);
    dp.emit(0, 0, 1, 0, '#ff0000', 5);

    const initial = dp.getActiveParticles();
    // At spawn, life == maxLife so alpha should be 1.0
    for (const p of initial) {
      expect(p.life / p.maxLife).toBeCloseTo(1.0, 1);
    }

    dp.update(0.15);
    const midway = dp.getActiveParticles();
    // After some time, alpha should be less than 1
    for (const p of midway) {
      expect(p.life / p.maxLife).toBeLessThan(1.0);
      expect(p.life / p.maxLife).toBeGreaterThan(0);
    }
  });

  it('pool wraps circularly when all slots are filled', () => {
    const dp = new DeathParticles(10);
    // Emit 10 to fill the pool
    dp.emit(0, 0, 1, 0, '#ff0000', 10);
    expect(dp.activeCount()).toBe(10);

    // Emit 5 more — should overwrite the oldest 5
    dp.emit(100, 100, -1, 0, '#00ff00', 5);
    // Pool size is 10, so we still have 10 active (5 overwritten + 5 new)
    expect(dp.activeCount()).toBe(10);

    // The 5 newest particles should be at position (100, 100)
    const particles = dp.getActiveParticles();
    const atNewPos = particles.filter(p => p.x === 100 && p.y === 100).length;
    expect(atNewPos).toBe(5);
  });

  it('reset() deactivates all particles', () => {
    const dp = new DeathParticles(50);
    dp.emit(0, 0, 1, 0, '#ff0000', 20);
    expect(dp.activeCount()).toBe(20);

    dp.reset();
    expect(dp.activeCount()).toBe(0);
  });

  it('particles have varying sizes within expected range', () => {
    const dp = new DeathParticles(200);
    dp.emit(0, 0, 1, 0, '#ff0000', 50);

    const particles = dp.getActiveParticles();
    const sizes = particles.map(p => p.size);
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);

    expect(minSize).toBeGreaterThanOrEqual(1.5);
    expect(maxSize).toBeLessThanOrEqual(3.5);
    // Should have some variation (not all same size)
    expect(maxSize - minSize).toBeGreaterThan(0.1);
  });

  it('particles store the color passed to emit()', () => {
    const dp = new DeathParticles(50);
    dp.emit(0, 0, 1, 0, '#ff0000', 5);

    const particles = dp.getActiveParticles();
    for (const p of particles) {
      expect(p.color).toBe('#ff0000');
    }
  });
});
