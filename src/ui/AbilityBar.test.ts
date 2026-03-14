import { describe, it, expect, vi } from 'vitest';
import { AbilityBar } from './AbilityBar';
import type { Ability } from '../systems/AbilitySystem';

function buildAbility(overrides: Partial<Ability> = {}): Ability {
  return {
    id: 'damage_blast',
    name: 'Blast',
    keybind: '1',
    cooldown: 6,
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

describe('AbilityBar', () => {
  it('renders ability icons with keybind labels', () => {
    const bar = new AbilityBar();
    const ctx = createMockCtx();
    const abilities = [
      buildAbility({ id: 'damage_blast', name: 'Blast', keybind: '1' }),
      buildAbility({ id: 'heal_over_time', name: 'Regen', keybind: '2' }),
    ];

    bar.render(ctx, abilities, 800, 600);

    const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const allText = fillTextCalls.map((c: unknown[]) => c[0] as string);

    expect(allText.some((t: string) => t === 'B')).toBe(true);
    expect(allText.some((t: string) => t === 'H')).toBe(true);
    expect(allText.some((t: string) => t === '1')).toBe(true);
    expect(allText.some((t: string) => t === '2')).toBe(true);
  });

  it('shows cooldown seconds when ability is on cooldown', () => {
    const bar = new AbilityBar();
    const ctx = createMockCtx();
    const abilities = [
      buildAbility({ cooldownRemaining: 3.5, cooldown: 6 }),
    ];

    bar.render(ctx, abilities, 800, 600);

    const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const allText = fillTextCalls.map((c: unknown[]) => c[0] as string);
    expect(allText.some((t: string) => t === '4s')).toBe(true); // ceil(3.5)
  });

  it('shows duration remaining when ability is active', () => {
    const bar = new AbilityBar();
    const ctx = createMockCtx();
    const abilities = [
      buildAbility({ active: true, durationRemaining: 2.3, cooldownRemaining: 8 }),
    ];

    bar.render(ctx, abilities, 800, 600);

    const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const allText = fillTextCalls.map((c: unknown[]) => c[0] as string);
    expect(allText.some((t: string) => t === '3s')).toBe(true); // ceil(2.3)
  });
});
