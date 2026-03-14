import { describe, it, expect } from 'vitest';
import { RadarDisplay, DEFAULT_RADAR_CONFIG } from './RadarDisplay';

describe('RadarDisplay', () => {
  it('initializes with default config', () => {
    const radar = new RadarDisplay();
    expect(radar.getConfig()).toEqual(DEFAULT_RADAR_CONFIG);
    expect(radar.getSweepAngle()).toBe(0);
  });

  it('accepts custom config overrides', () => {
    const radar = new RadarDisplay({ radius: 400, sweepSpeed: Math.PI * 2 });
    expect(radar.getRadius()).toBe(400);
    expect(radar.getConfig().sweepSpeed).toBe(Math.PI * 2);
  });

  it('advances sweep angle on update', () => {
    const radar = new RadarDisplay({ sweepSpeed: Math.PI }); // half rotation per second
    radar.update(1); // 1 second
    expect(radar.getSweepAngle()).toBeCloseTo(Math.PI, 5);
  });

  it('wraps sweep angle at 2*PI', () => {
    const radar = new RadarDisplay({ sweepSpeed: Math.PI * 2 }); // full rotation per second
    radar.update(1.5); // 1.5 rotations
    expect(radar.getSweepAngle()).toBeCloseTo(Math.PI, 5);
  });

  it('allows changing radius', () => {
    const radar = new RadarDisplay();
    radar.setRadius(500);
    expect(radar.getRadius()).toBe(500);
  });

  it('allows changing sweep speed', () => {
    const radar = new RadarDisplay();
    radar.setSweepSpeed(Math.PI * 4);
    radar.update(0.5);
    // 0.5s at 4*PI rad/s = 2*PI = full rotation, wraps to 0
    expect(radar.getSweepAngle()).toBeCloseTo(0, 5);
  });
});
