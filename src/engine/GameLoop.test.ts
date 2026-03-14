import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameLoop } from './GameLoop';

describe('GameLoop', () => {
  let updateFn: ReturnType<typeof vi.fn>;
  let renderFn: ReturnType<typeof vi.fn>;
  let loop: GameLoop;

  beforeEach(() => {
    updateFn = vi.fn();
    renderFn = vi.fn();
    loop = new GameLoop({ update: updateFn, render: renderFn });

    vi.spyOn(performance, 'now').mockReturnValue(0);
  });

  afterEach(() => {
    loop.stop();
    vi.restoreAllMocks();
  });

  it('is not running initially', () => {
    expect(loop.isRunning()).toBe(false);
  });

  it('starts and stops', () => {
    loop.start();
    expect(loop.isRunning()).toBe(true);
    loop.stop();
    expect(loop.isRunning()).toBe(false);
  });

  it('does not start twice', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
    loop.start();
    loop.start();
    // Should only have called rAF once on start
    expect(rafSpy).toHaveBeenCalledTimes(1);
  });

  it('calls update and render each frame', () => {
    // Simulate rAF manually
    const callbacks: ((time: number) => void)[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      callbacks.push(cb);
      return callbacks.length;
    });

    loop.start();

    // Simulate one frame at 16.67ms (one fixed timestep)
    expect(callbacks).toHaveLength(1);
    callbacks[0](16.67);

    expect(updateFn).toHaveBeenCalledTimes(1);
    expect(renderFn).toHaveBeenCalledTimes(1);

    // dt should be roughly 1/60 in seconds
    const dt = updateFn.mock.calls[0][0];
    expect(dt).toBeCloseTo(1 / 60, 2);
  });

  it('caps delta time to prevent spiral of death', () => {
    const callbacks: ((time: number) => void)[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      callbacks.push(cb);
      return callbacks.length;
    });

    loop.start();

    // Simulate a 2-second pause (tab backgrounded)
    callbacks[0](2000);

    // With MAX_DELTA=250ms and FIXED_TIMESTEP=~16.67ms, max updates = floor(250/16.67) = 14
    expect(updateFn.mock.calls.length).toBeLessThanOrEqual(15);
    expect(renderFn).toHaveBeenCalledTimes(1);
  });

  it('calls update multiple times for large frames', () => {
    const callbacks: ((time: number) => void)[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      callbacks.push(cb);
      return callbacks.length;
    });

    loop.start();

    // Simulate 50ms frame (should trigger ~3 updates at 16.67ms each)
    callbacks[0](50);

    expect(updateFn.mock.calls.length).toBe(2); // floor(50/16.67) = 2
    expect(renderFn).toHaveBeenCalledTimes(1);
  });
});
