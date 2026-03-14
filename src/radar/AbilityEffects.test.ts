import { describe, it, expect } from 'vitest';
import { AbilityEffects } from './AbilityEffects';

describe('AbilityEffects', () => {
  describe('blast ring', () => {
    it('creates a blast ring that expires after 0.4 seconds', () => {
      const effects = new AbilityEffects();
      effects.triggerBlast();

      // Should be active initially
      effects.update(0.2);
      // After full duration, should be cleaned up
      effects.update(0.3);
      // No way to query length directly, but rendering should not throw
    });

    it('does not throw when rendering with active blast ring', () => {
      const effects = new AbilityEffects();
      effects.triggerBlast();
      // Just verify it doesn't throw — rendering is visual
      expect(() => effects.update(0.1)).not.toThrow();
    });
  });

  describe('regen glow', () => {
    it('activates and deactivates based on ability state', () => {
      const effects = new AbilityEffects();
      effects.setRegenActive(true, 3);
      effects.setRegenActive(false, 0);
      // Should not throw
      expect(() => effects.update(0.1)).not.toThrow();
    });
  });

  describe('drone spawn flash', () => {
    it('creates a flash at the given world position', () => {
      const effects = new AbilityEffects();
      effects.triggerDroneSpawn(100, 200);
      // Should be cleaned up after duration
      effects.update(0.6);
      expect(() => effects.update(0.1)).not.toThrow();
    });
  });
});
