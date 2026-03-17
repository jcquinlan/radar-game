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

describe('InputSystem mouse tracking', () => {
  let input: InputSystem;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    input = new InputSystem();
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    document.body.appendChild(canvas);
  });

  afterEach(() => {
    input.detachMouse(canvas);
    document.body.removeChild(canvas);
  });

  it('tracks canvas mouse position on mousemove', () => {
    input.attachMouse(canvas);

    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 200 }));

    expect(input.mouseX).toBe(100);
    expect(input.mouseY).toBe(200);
    expect(input.mouseOver).toBe(true);
  });

  it('sets mouseOver to false on mouseleave', () => {
    input.attachMouse(canvas);

    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 50 }));
    expect(input.mouseOver).toBe(true);

    canvas.dispatchEvent(new MouseEvent('mouseleave'));
    expect(input.mouseOver).toBe(false);
  });

  it('clears mouseOver and pendingClick on detachMouse', () => {
    input.attachMouse(canvas);

    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 50 }));
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 50 }));

    expect(input.mouseOver).toBe(true);
    expect(input.consumeClick()).not.toBeNull();

    // Re-click so there's a pending click
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 50 }));

    input.detachMouse(canvas);
    expect(input.mouseOver).toBe(false);
    expect(input.consumeClick()).toBeNull();
  });

  it('does not respond to mouse events after detachMouse', () => {
    input.attachMouse(canvas);
    input.detachMouse(canvas);

    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 400 }));
    expect(input.mouseX).toBe(0);
    expect(input.mouseOver).toBe(false);
  });

  it('produces a pending click on mousedown', () => {
    input.attachMouse(canvas);

    // No converter set — world coords default to 0
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 150, clientY: 250 }));

    const click = input.consumeClick();
    expect(click).not.toBeNull();
    expect(click!.worldX).toBe(0);
    expect(click!.worldY).toBe(0);
  });

  it('consumeClick returns click once then null', () => {
    input.attachMouse(canvas);

    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100 }));

    const first = input.consumeClick();
    expect(first).not.toBeNull();

    const second = input.consumeClick();
    expect(second).toBeNull();
  });

  it('uses coordinate converter to compute world coordinates on mousemove', () => {
    input.attachMouse(canvas);
    input.setCoordinateConverter((cx, cy) => ({
      worldX: cx * 2,
      worldY: cy * 3,
    }));

    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 50 }));

    expect(input.mouseWorldX).toBe(200);
    expect(input.mouseWorldY).toBe(150);
  });

  it('uses coordinate converter for click world coordinates', () => {
    input.attachMouse(canvas);
    input.setCoordinateConverter((cx, cy) => ({
      worldX: cx + 1000,
      worldY: cy + 2000,
    }));

    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 75 }));

    const click = input.consumeClick();
    expect(click).not.toBeNull();
    expect(click!.worldX).toBe(1050);
    expect(click!.worldY).toBe(2075);
  });

  it('latest click overwrites previous unconsumed click', () => {
    input.attachMouse(canvas);
    input.setCoordinateConverter((cx, cy) => ({
      worldX: cx,
      worldY: cy,
    }));

    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 10, clientY: 20 }));
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 30, clientY: 40 }));

    const click = input.consumeClick();
    expect(click).not.toBeNull();
    expect(click!.worldX).toBe(30);
    expect(click!.worldY).toBe(40);
  });

  it('right-click produces a pending right-click, not a left-click', () => {
    input.attachMouse(canvas);
    input.setCoordinateConverter((cx, cy) => ({
      worldX: cx + 500,
      worldY: cy + 500,
    }));

    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 200, button: 2 }));

    expect(input.consumeClick()).toBeNull();
    const right = input.consumeRightClick();
    expect(right).not.toBeNull();
    expect(right!.worldX).toBe(600);
    expect(right!.worldY).toBe(700);
  });

  it('consumeRightClick returns click once then null', () => {
    input.attachMouse(canvas);

    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 50, button: 2 }));

    expect(input.consumeRightClick()).not.toBeNull();
    expect(input.consumeRightClick()).toBeNull();
  });

  it('left and right clicks are tracked independently', () => {
    input.attachMouse(canvas);

    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 10, clientY: 10, button: 0 }));
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 90, clientY: 90, button: 2 }));

    expect(input.consumeClick()).not.toBeNull();
    expect(input.consumeRightClick()).not.toBeNull();
  });

  it('detachMouse clears pending right-click', () => {
    input.attachMouse(canvas);

    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 50, button: 2 }));

    input.detachMouse(canvas);
    expect(input.consumeRightClick()).toBeNull();
  });
});
