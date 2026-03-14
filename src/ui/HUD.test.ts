import { describe, it, expect, vi } from 'vitest';
import { HUD } from './HUD';
import { Player } from '../entities/Player';
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
    ...overrides,
  };
}

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
  it('renders without errors when no abilities provided', () => {
    const hud = new HUD();
    const ctx = createMockCtx();
    const player = new Player();

    expect(() => hud.render(ctx, player, 800)).not.toThrow();
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('renders ability cooldown bars when abilities are provided', () => {
    const hud = new HUD();
    const ctx = createMockCtx();
    const player = new Player();
    const abilities = [
      buildAbility({ id: 'blast', name: 'Blast', keybind: '1' }),
      buildAbility({ id: 'heal', name: 'Regen', keybind: '2', cooldownRemaining: 5, cooldown: 15 }),
      buildAbility({ id: 'drone', name: 'Drone', keybind: '3' }),
    ];

    hud.render(ctx, player, 800, abilities);

    // Should render ability bars (fillRect for bar backgrounds + fills)
    const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const barLabels = fillTextCalls.map((c: unknown[]) => c[0] as string);

    // Check that ability keybinds appear in rendered text
    expect(barLabels.some((t: string) => t.includes('[1]'))).toBe(true);
    expect(barLabels.some((t: string) => t.includes('[2]'))).toBe(true);
    expect(barLabels.some((t: string) => t.includes('[3]'))).toBe(true);
  });

  it('shows cooldown remaining for abilities on cooldown', () => {
    const hud = new HUD();
    const ctx = createMockCtx();
    const player = new Player();
    const abilities = [
      buildAbility({ name: 'Blast', keybind: '1', cooldownRemaining: 3, cooldown: 8 }),
    ];

    hud.render(ctx, player, 800, abilities);

    const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const barLabels = fillTextCalls.map((c: unknown[]) => c[0] as string);
    expect(barLabels.some((t: string) => t.includes('3s'))).toBe(true);
  });

  it('shows ACTIVE indicator for duration abilities', () => {
    const hud = new HUD();
    const ctx = createMockCtx();
    const player = new Player();
    const abilities = [
      buildAbility({ name: 'Regen', keybind: '2', active: true, durationRemaining: 2 }),
    ];

    hud.render(ctx, player, 800, abilities);

    const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const allText = fillTextCalls.map((c: unknown[]) => c[0] as string);
    expect(allText.some((t: string) => t.includes('ACTIVE'))).toBe(true);
  });
});
