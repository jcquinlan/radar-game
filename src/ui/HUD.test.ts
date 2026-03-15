import { describe, it, expect, vi } from 'vitest';
import { HUD, formatTime } from './HUD';
import { Player } from '../entities/Player';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    font: '',
    fillStyle: '',
    strokeStyle: '',
    shadowColor: '',
    shadowBlur: 0,
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: 'left',
  } as unknown as CanvasRenderingContext2D;
}

describe('HUD', () => {
  it('renders without errors', () => {
    const hud = new HUD();
    const ctx = createMockCtx();
    const player = new Player();

    expect(() => hud.render(ctx, player, 800, 600)).not.toThrow();
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('renders health, energy, and score text', () => {
    const hud = new HUD();
    const ctx = createMockCtx();
    const player = new Player();
    player.energy = 42;
    player.score = 100;

    hud.render(ctx, player, 800, 600);

    const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const allText = fillTextCalls.map((c: unknown[]) => c[0] as string);

    expect(allText.some((t: string) => t.includes('HP:'))).toBe(true);
    expect(allText.some((t: string) => t.includes('42'))).toBe(true);
    expect(allText.some((t: string) => t.includes('100'))).toBe(true);
  });

  it('renders the run timer in MM:SS format when runTimer is provided', () => {
    const hud = new HUD();
    const ctx = createMockCtx();
    const player = new Player();

    hud.render(ctx, player, 800, 600, 305); // 5:05

    const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const allText = fillTextCalls.map((c: unknown[]) => c[0] as string);

    expect(allText.some((t: string) => t === '5:05')).toBe(true);
  });

  it('does not render run timer when runTimer is -1 (default)', () => {
    const hud = new HUD();
    const ctx = createMockCtx();
    const player = new Player();

    hud.render(ctx, player, 800, 600);

    const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const allText = fillTextCalls.map((c: unknown[]) => c[0] as string);

    // No MM:SS formatted timer should appear
    expect(allText.some((t: string) => /^\d+:\d{2}$/.test(t))).toBe(false);
  });

  it('renders FINAL WAVE text when runTimer is exactly 0', () => {
    const hud = new HUD();
    const ctx = createMockCtx();
    const player = new Player();

    hud.render(ctx, player, 800, 600, 0);

    const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const allText = fillTextCalls.map((c: unknown[]) => c[0] as string);

    expect(allText.some((t: string) => t === 'FINAL WAVE')).toBe(true);
    // Should NOT show 0:00 countdown
    expect(allText.some((t: string) => t === '0:00')).toBe(false);
  });

  it('renders timer at top-center of the canvas', () => {
    const hud = new HUD();
    const ctx = createMockCtx();
    const player = new Player();

    hud.render(ctx, player, 800, 600, 600); // 10:00

    const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const timerCall = fillTextCalls.find((c: unknown[]) => c[0] === '10:00');

    expect(timerCall).toBeDefined();
    // x should be at canvas center (800 / 2 = 400)
    expect(timerCall![1]).toBe(400);
  });
});

describe('formatTime', () => {
  it('formats 600 seconds as 10:00', () => {
    expect(formatTime(600)).toBe('10:00');
  });

  it('formats 61 seconds as 1:01', () => {
    expect(formatTime(61)).toBe('1:01');
  });

  it('formats 0 seconds as 0:00', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('formats 59.9 seconds as 0:59', () => {
    expect(formatTime(59.9)).toBe('0:59');
  });

  it('clamps negative values to 0:00', () => {
    expect(formatTime(-5)).toBe('0:00');
  });

  it('formats 305 seconds as 5:05', () => {
    expect(formatTime(305)).toBe('5:05');
  });
});
