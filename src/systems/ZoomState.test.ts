import { describe, it, expect } from 'vitest';
import {
  createZoomState,
  clampZoom,
  adjustZoom,
  updateZoom,
  resetZoom,
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_DEFAULT,
  ZOOM_KEY_STEP,
} from './ZoomState';

describe('ZoomState', () => {
  describe('createZoomState', () => {
    it('starts at default zoom level', () => {
      const state = createZoomState();
      expect(state.target).toBe(ZOOM_DEFAULT);
      expect(state.current).toBe(ZOOM_DEFAULT);
    });
  });

  describe('clampZoom', () => {
    it('clamps values below minimum to minimum', () => {
      expect(clampZoom(0.1)).toBe(ZOOM_MIN);
      expect(clampZoom(-5)).toBe(ZOOM_MIN);
    });

    it('clamps values above maximum to maximum', () => {
      expect(clampZoom(3.0)).toBe(ZOOM_MAX);
      expect(clampZoom(100)).toBe(ZOOM_MAX);
    });

    it('passes through values within range', () => {
      expect(clampZoom(1.0)).toBe(1.0);
      expect(clampZoom(0.75)).toBe(0.75);
      expect(clampZoom(1.5)).toBe(1.5);
    });
  });

  describe('adjustZoom', () => {
    it('increases target zoom with positive delta', () => {
      const state = createZoomState();
      adjustZoom(state, 0.2);
      expect(state.target).toBe(1.2);
    });

    it('decreases target zoom with negative delta', () => {
      const state = createZoomState();
      adjustZoom(state, -0.3);
      expect(state.target).toBeCloseTo(0.7);
    });

    it('clamps target to maximum', () => {
      const state = createZoomState();
      adjustZoom(state, 5.0);
      expect(state.target).toBe(ZOOM_MAX);
    });

    it('clamps target to minimum', () => {
      const state = createZoomState();
      adjustZoom(state, -5.0);
      expect(state.target).toBe(ZOOM_MIN);
    });

    it('does not change current zoom (only target)', () => {
      const state = createZoomState();
      adjustZoom(state, 0.5);
      expect(state.current).toBe(ZOOM_DEFAULT);
    });
  });

  describe('updateZoom', () => {
    it('lerps current toward target over time', () => {
      const state = createZoomState();
      state.target = 2.0;

      updateZoom(state, 0.016); // ~1 frame at 60Hz
      expect(state.current).toBeGreaterThan(ZOOM_DEFAULT);
      expect(state.current).toBeLessThan(2.0);
    });

    it('converges to target after enough frames', () => {
      const state = createZoomState();
      state.target = 1.5;

      // Simulate ~2 seconds of updates
      for (let i = 0; i < 120; i++) {
        updateZoom(state, 1 / 60);
      }
      expect(state.current).toBeCloseTo(1.5, 2);
    });

    it('snaps to target when very close', () => {
      const state = createZoomState();
      state.target = 1.0005;

      updateZoom(state, 0.016);
      expect(state.current).toBe(state.target);
    });

    it('does nothing when current equals target', () => {
      const state = createZoomState();
      updateZoom(state, 0.016);
      expect(state.current).toBe(ZOOM_DEFAULT);
    });
  });

  describe('resetZoom', () => {
    it('resets both target and current to default', () => {
      const state = createZoomState();
      state.target = 1.8;
      state.current = 1.5;

      resetZoom(state);
      expect(state.target).toBe(ZOOM_DEFAULT);
      expect(state.current).toBe(ZOOM_DEFAULT);
    });
  });

  describe('keyboard zoom steps', () => {
    it('stepping up by ZOOM_KEY_STEP increases zoom correctly', () => {
      const state = createZoomState();
      adjustZoom(state, ZOOM_KEY_STEP);
      expect(state.target).toBeCloseTo(ZOOM_DEFAULT + ZOOM_KEY_STEP);
    });

    it('stepping down by ZOOM_KEY_STEP decreases zoom correctly', () => {
      const state = createZoomState();
      adjustZoom(state, -ZOOM_KEY_STEP);
      expect(state.target).toBeCloseTo(ZOOM_DEFAULT - ZOOM_KEY_STEP);
    });

    it('multiple steps up clamp at maximum', () => {
      const state = createZoomState();
      for (let i = 0; i < 20; i++) {
        adjustZoom(state, ZOOM_KEY_STEP);
      }
      expect(state.target).toBe(ZOOM_MAX);
    });
  });
});
