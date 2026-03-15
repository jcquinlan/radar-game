import { describe, it, expect } from 'vitest';
import { detectCombo } from './ComboDetector';

describe('detectCombo', () => {
  describe('Blast then Drone combo', () => {
    it('returns 2x drone damage when blast was used within 3 seconds', () => {
      const result = detectCombo('damage_blast', 10, 'helper_drone', 12);
      expect(result).toEqual({ droneDamageMultiplier: 2 });
    });

    it('does not trigger in reverse order (Drone then Blast)', () => {
      const result = detectCombo('helper_drone', 10, 'damage_blast', 12);
      expect(result).toBeUndefined();
    });
  });

  describe('HoT then Dash combo', () => {
    it('returns 1.5x dash speed when heal was used within 3 seconds', () => {
      const result = detectCombo('heal_over_time', 5, 'dash', 7);
      expect(result).toEqual({ dashSpeedMultiplier: 1.5 });
    });

    it('does not trigger in reverse order (Dash then HoT)', () => {
      const result = detectCombo('dash', 5, 'heal_over_time', 7);
      expect(result).toBeUndefined();
    });
  });

  describe('Dash then Blast combo', () => {
    it('returns 300px blast radius when dash was used within 3 seconds', () => {
      const result = detectCombo('dash', 8, 'damage_blast', 10);
      expect(result).toEqual({ blastRadius: 300 });
    });

    it('does not trigger in reverse order (Blast then Dash)', () => {
      const result = detectCombo('damage_blast', 8, 'dash', 10);
      expect(result).toBeUndefined();
    });
  });

  describe('combo window', () => {
    it('does not trigger if more than 3 seconds have passed', () => {
      const result = detectCombo('damage_blast', 10, 'helper_drone', 13.01);
      expect(result).toBeUndefined();
    });

    it('triggers at exactly 3 seconds', () => {
      const result = detectCombo('damage_blast', 10, 'helper_drone', 13);
      expect(result).toEqual({ droneDamageMultiplier: 2 });
    });

    it('triggers within the window for all combo types', () => {
      expect(detectCombo('heal_over_time', 0, 'dash', 2.9)).toBeDefined();
      expect(detectCombo('dash', 0, 'damage_blast', 0.1)).toBeDefined();
    });
  });

  describe('no combo cases', () => {
    it('returns undefined when no previous ability was used', () => {
      const result = detectCombo(null, 0, 'damage_blast', 5);
      expect(result).toBeUndefined();
    });

    it('returns undefined when the same ability is used twice', () => {
      const result = detectCombo('damage_blast', 10, 'damage_blast', 11);
      expect(result).toBeUndefined();
    });

    it('returns undefined for non-combo ability pairs', () => {
      // heal then drone is not a combo
      const result = detectCombo('heal_over_time', 10, 'helper_drone', 11);
      expect(result).toBeUndefined();
    });

    it('returns undefined for homing_missile combinations', () => {
      expect(detectCombo('homing_missile', 10, 'damage_blast', 11)).toBeUndefined();
      expect(detectCombo('damage_blast', 10, 'homing_missile', 11)).toBeUndefined();
    });
  });
});
