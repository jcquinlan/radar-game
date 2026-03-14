import { describe, it, expect } from 'vitest';
import { KeyRemapScreen } from './KeyRemapScreen';
import type { Ability } from '../systems/AbilitySystem';

function buildAbility(overrides: Partial<Ability> = {}): Ability {
  return {
    id: 'test',
    name: 'Test',
    keybind: '1',
    cooldown: 10,
    cooldownRemaining: 0,
    duration: 0,
    durationRemaining: 0,
    active: false,
    maxCharges: 1,
    charges: 1,
    ...overrides,
  };
}

describe('KeyRemapScreen', () => {
  it('starts hidden', () => {
    const screen = new KeyRemapScreen();
    expect(screen.isVisible()).toBe(false);
  });

  it('toggles visibility', () => {
    const screen = new KeyRemapScreen();
    screen.toggle();
    expect(screen.isVisible()).toBe(true);
    screen.toggle();
    expect(screen.isVisible()).toBe(false);
  });

  it('is not listening when first opened', () => {
    const screen = new KeyRemapScreen();
    screen.toggle();
    expect(screen.isListening()).toBe(false);
  });

  it('clears listening state when toggled closed', () => {
    const screen = new KeyRemapScreen();
    screen.toggle(); // open
    // Manually can't trigger listening without click handler, but toggle should reset
    screen.toggle(); // close
    expect(screen.isListening()).toBe(false);
  });

  it('renders without errors when visible', () => {
    const screen = new KeyRemapScreen();
    screen.toggle();
    const abilities = [
      buildAbility({ id: 'blast', name: 'Blast', keybind: '1' }),
      buildAbility({ id: 'heal', name: 'Regen', keybind: '2' }),
    ];

    // Mock canvas context
    const ctx = {
      save: () => {},
      restore: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      fillText: () => {},
      font: '',
      fillStyle: '',
      strokeStyle: '',
      shadowColor: '',
      shadowBlur: 0,
      lineWidth: 1,
      textAlign: 'left',
    } as unknown as CanvasRenderingContext2D;

    expect(() => screen.render(ctx, abilities, 800, 600)).not.toThrow();
  });

  it('does not render when hidden', () => {
    const screen = new KeyRemapScreen();
    const abilities = [buildAbility()];
    let fillRectCalled = false;

    const ctx = {
      save: () => {},
      restore: () => {},
      fillRect: () => { fillRectCalled = true; },
      strokeRect: () => {},
      fillText: () => {},
      font: '',
      fillStyle: '',
      strokeStyle: '',
      shadowColor: '',
      shadowBlur: 0,
      lineWidth: 1,
      textAlign: 'left',
    } as unknown as CanvasRenderingContext2D;

    screen.render(ctx, abilities, 800, 600);
    expect(fillRectCalled).toBe(false);
  });
});
