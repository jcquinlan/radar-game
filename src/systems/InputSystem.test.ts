import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InputSystem } from './InputSystem';

describe('InputSystem', () => {
  let input: InputSystem;

  beforeEach(() => {
    input = new InputSystem();
    input.attach();
  });

  afterEach(() => {
    input.detach();
  });

  it('tracks key state via keydown/keyup events', () => {
    expect(input.isDown('w')).toBe(false);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    expect(input.isDown('w')).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
    expect(input.isDown('w')).toBe(false);
  });

  it('returns correct movement vector for WASD', () => {
    expect(input.getMovementVector()).toEqual({ dx: 0, dy: 0 });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    expect(input.getMovementVector()).toEqual({ dx: 0, dy: -1 });

    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    expect(input.getMovementVector()).toEqual({ dx: 1, dy: 0 });
  });

  it('normalizes diagonal movement', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));

    const { dx, dy } = input.getMovementVector();
    const magnitude = Math.sqrt(dx * dx + dy * dy);
    expect(magnitude).toBeCloseTo(1, 5);
  });

  it('clears keys on detach', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    input.detach();
    expect(input.isDown('w')).toBe(false);
  });
});
