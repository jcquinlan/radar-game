import { describe, it, expect } from 'vitest';
import { RadarDisplay, DEFAULT_RADAR_CONFIG } from './RadarDisplay';

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
