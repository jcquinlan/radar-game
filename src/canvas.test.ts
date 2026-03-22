import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCanvas } from './canvas';

describe('createCanvas', () => {
  beforeEach(() => {
    document.body.innerHTML = '<canvas id="game-canvas"></canvas>';
  });

  it('returns the canvas element by id', () => {
    const canvas = createCanvas('game-canvas');
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(canvas.id).toBe('game-canvas');
  });

  it('throws if the element does not exist', () => {
    expect(() => createCanvas('nonexistent')).toThrow(
      'Canvas element with id "nonexistent" not found'
    );
  });

  it('sets canvas dimensions to the window size', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });

    const canvas = createCanvas('game-canvas');
    expect(canvas.width).toBe(1024);
    expect(canvas.height).toBe(768);
  });

  it('positions canvas with z-index for 3D layering', () => {
    const canvas = createCanvas('game-canvas');
    expect(canvas.style.position).toBe('absolute');
    expect(canvas.style.zIndex).toBe('1');
  });

  it('resizes canvas when the window resizes', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 600, writable: true });

    const canvas = createCanvas('game-canvas');
    expect(canvas.width).toBe(800);

    Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });
    window.dispatchEvent(new Event('resize'));

    expect(canvas.width).toBe(1920);
    expect(canvas.height).toBe(1080);
  });
});
