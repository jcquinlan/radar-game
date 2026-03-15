import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResultsScreen, RunStats } from './ResultsScreen';

// Mock getTheme to return a simple theme object
vi.mock('../themes/theme', () => ({
  getTheme: () => ({
    entities: { enemy: '#ff0000' },
    ui: { textPrimary: '#ffffff', statsText: '#cccccc', border: '#444444' },
    radar: { primary: '#00ff41' },
    events: { collect: '#ffaa00' },
  }),
}));

function makeStats(overrides: Partial<RunStats> = {}): RunStats {
  return {
    salvageDeposited: 5,
    enemiesKilled: 10,
    baseHpPercent: 0.75,
    currencyEarned: 475,
    ...overrides,
  };
}

describe('ResultsScreen', () => {
  let screen: ResultsScreen;

  beforeEach(() => {
    screen = new ResultsScreen();
  });

  it('starts not visible', () => {
    expect(screen.isVisible()).toBe(false);
  });

  it('becomes visible after show()', () => {
    const canvas = document.createElement('canvas');
    screen.show(canvas, makeStats(), () => {});
    expect(screen.isVisible()).toBe(true);
  });

  it('becomes not visible after hide()', () => {
    const canvas = document.createElement('canvas');
    screen.show(canvas, makeStats(), () => {});
    screen.hide(canvas);
    expect(screen.isVisible()).toBe(false);
  });

  it('calls onContinue and hides when Continue button is clicked', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON: () => ({}) });

    const onContinue = vi.fn();
    screen.show(canvas, makeStats(), onContinue);

    // Set button bounds manually (render would normally do this but jsdom has no canvas context)
    screen.setButtonBounds({ x: 300, y: 350, width: 200, height: 50 });

    // Click inside button bounds
    const clickEvent = new MouseEvent('click', { clientX: 400, clientY: 375 });
    canvas.dispatchEvent(clickEvent);

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(screen.isVisible()).toBe(false);
  });

  it('does not call onContinue when clicking outside button', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON: () => ({}) });

    const onContinue = vi.fn();
    screen.show(canvas, makeStats(), onContinue);
    screen.setButtonBounds({ x: 300, y: 350, width: 200, height: 50 });

    // Click outside button bounds
    const clickEvent = new MouseEvent('click', { clientX: 100, clientY: 100 });
    canvas.dispatchEvent(clickEvent);

    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.isVisible()).toBe(true);
  });

  it('stores stats for rendering', () => {
    const canvas = document.createElement('canvas');
    const stats = makeStats({ currencyEarned: 999 });
    screen.show(canvas, stats, () => {});
    expect(screen.getStats()).toEqual(stats);
  });
});

describe('ResultsScreen for game_over (failed run)', () => {
  it('shows failed state with reduced currency', () => {
    const screen = new ResultsScreen();
    const canvas = document.createElement('canvas');
    const stats = makeStats({ currencyEarned: 60 });
    screen.show(canvas, stats, () => {}, true);
    expect(screen.isVisible()).toBe(true);
    expect(screen.isFailed()).toBe(true);
  });
});
