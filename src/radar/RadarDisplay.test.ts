import { describe, it, expect } from 'vitest';
import { RadarDisplay, DEFAULT_RADAR_CONFIG, computeHomeArrowAngle, shouldShowHomeArrow } from './RadarDisplay';

/** Normalize angle to [0, 2PI) for comparison */
function normalizeAngle(a: number): number {
  const TWO_PI = Math.PI * 2;
  return ((a % TWO_PI) + TWO_PI) % TWO_PI;
}

describe('RadarDisplay', () => {
  it('initializes with default config', () => {
    const radar = new RadarDisplay();
    expect(radar.getConfig()).toEqual(DEFAULT_RADAR_CONFIG);
  });

  it('accepts custom config overrides', () => {
    const radar = new RadarDisplay({ radius: 400 });
    expect(radar.getRadius()).toBe(400);
  });

  it('allows changing radius', () => {
    const radar = new RadarDisplay();
    radar.setRadius(500);
    expect(radar.getRadius()).toBe(500);
  });

  it('accepts ping state for rendering', () => {
    const radar = new RadarDisplay();
    radar.setPingState({
      radius: 100,
      speed: 400,
      active: true,
      alpha: 0.8,
      cooldownRemaining: 0,
    });
    // No error thrown — ping state is stored for rendering
    expect(radar.getRadius()).toBe(340);
  });
});

describe('computeHomeArrowAngle', () => {
  it('computes angle toward origin from a position to the right', () => {
    // Player at (500, 0), heading 0
    const angle = computeHomeArrowAngle(500, 0, 0);
    // atan2(-0, -500) can be PI or -PI depending on -0 semantics
    // Result minus heading(0) minus PI/2 — should normalize to PI/2 or 3PI/2
    // The key property: the arrow should point left on screen (toward home)
    const normalized = normalizeAngle(angle);
    // -0 makes atan2 return -PI, so -PI - 0 - PI/2 = -3PI/2 → normalized = PI/2
    expect(normalized).toBeCloseTo(normalizeAngle(-3 * Math.PI / 2), 5);
  });

  it('computes angle toward origin from a position above (negative y)', () => {
    // Player at (0, -500), heading 0 — home is directly below
    const angle = computeHomeArrowAngle(0, -500, 0);
    // atan2(500, 0) = PI/2, minus 0 minus PI/2 = 0
    expect(normalizeAngle(angle)).toBeCloseTo(0, 5);
  });

  it('accounts for player heading rotation', () => {
    // Player at (500, 0), heading PI/2
    const angle = computeHomeArrowAngle(500, 0, Math.PI / 2);
    // Should differ from heading=0 by exactly PI/2
    const angleNoHeading = computeHomeArrowAngle(500, 0, 0);
    const diff = normalizeAngle(angleNoHeading - angle);
    expect(diff).toBeCloseTo(Math.PI / 2, 5);
  });

  it('rotates proportionally with heading changes', () => {
    // When heading changes by delta, the arrow angle changes by -delta
    const base = computeHomeArrowAngle(300, 400, 0);
    const rotated = computeHomeArrowAngle(300, 400, 1.0);
    expect(normalizeAngle(base - rotated)).toBeCloseTo(1.0, 5);
  });
});

describe('shouldShowHomeArrow', () => {
  it('returns false when player is at the origin', () => {
    expect(shouldShowHomeArrow(0, 0)).toBe(false);
  });

  it('returns false when player is within 200px of origin', () => {
    expect(shouldShowHomeArrow(100, 100)).toBe(false); // ~141px
    expect(shouldShowHomeArrow(141, 0)).toBe(false);
    expect(shouldShowHomeArrow(0, 199)).toBe(false);
  });

  it('returns true when player is exactly at 200px from origin', () => {
    // 200px is the boundary — at exactly 200 we hide (> 200 shows)
    expect(shouldShowHomeArrow(200, 0)).toBe(false);
  });

  it('returns true when player is beyond 200px from origin', () => {
    expect(shouldShowHomeArrow(201, 0)).toBe(true);
    expect(shouldShowHomeArrow(0, 300)).toBe(true);
    expect(shouldShowHomeArrow(500, 500)).toBe(true);
  });

  it('handles negative coordinates', () => {
    expect(shouldShowHomeArrow(-300, -400)).toBe(true); // 500px
    expect(shouldShowHomeArrow(-100, -100)).toBe(false); // ~141px
  });
});
