import { describe, it, expect, vi } from 'vitest';
import { HUD } from './HUD';
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

    expect(() => hud.render(ctx, player, 800)).not.toThrow();
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('renders health, energy, and score text', () => {
    const hud = new HUD();
    const ctx = createMockCtx();
    const player = new Player();
    player.energy = 42;
    player.score = 100;

    hud.render(ctx, player, 800);

    const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const allText = fillTextCalls.map((c: unknown[]) => c[0] as string);

    expect(allText.some((t: string) => t.includes('HP:'))).toBe(true);
    expect(allText.some((t: string) => t.includes('42'))).toBe(true);
    expect(allText.some((t: string) => t.includes('100'))).toBe(true);
  });
});
