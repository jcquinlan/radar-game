import { describe, it, expect } from 'vitest';
import { LevelManager } from './LevelManager';

describe('LevelManager', () => {
  it('starts on the main menu', () => {
    const mgr = new LevelManager();
    expect(mgr.isOnMenu()).toBe(true);
    expect(mgr.getCurrentLevel()).toBeNull();
  });

  it('selectLevel picks a valid level', () => {
    const mgr = new LevelManager();
    const level = mgr.selectLevel(0);
    expect(level).not.toBeNull();
    expect(level!.id).toBe('tutorial-movement');
    expect(mgr.isOnMenu()).toBe(false);
    expect(mgr.getCurrentLevel()).toBe(level);
  });

  it('selectLevel returns null for out-of-range index', () => {
    const mgr = new LevelManager();
    expect(mgr.selectLevel(-1)).toBeNull();
    expect(mgr.selectLevel(999)).toBeNull();
    expect(mgr.isOnMenu()).toBe(true);
  });

  it('advance moves through levels sequentially', () => {
    const mgr = new LevelManager();
    mgr.selectLevel(0);

    const second = mgr.advance();
    expect(second).not.toBeNull();
    expect(second!.id).toBe('tutorial-combat');

    const third = mgr.advance();
    expect(third).not.toBeNull();
    expect(third!.id).toBe('full-game');
  });

  it('advance returns null and resets to menu after last level', () => {
    const mgr = new LevelManager();
    const levels = mgr.getLevels();
    mgr.selectLevel(levels.length - 1);

    const next = mgr.advance();
    expect(next).toBeNull();
    expect(mgr.isOnMenu()).toBe(true);
  });

  it('returnToMenu resets to menu state', () => {
    const mgr = new LevelManager();
    mgr.selectLevel(1);
    expect(mgr.isOnMenu()).toBe(false);

    mgr.returnToMenu();
    expect(mgr.isOnMenu()).toBe(true);
    expect(mgr.getCurrentLevel()).toBeNull();
  });

  it('hasNextLevel is true when not on last level', () => {
    const mgr = new LevelManager();
    mgr.selectLevel(0);
    expect(mgr.hasNextLevel()).toBe(true);
  });

  it('hasNextLevel is false on the last level', () => {
    const mgr = new LevelManager();
    const levels = mgr.getLevels();
    mgr.selectLevel(levels.length - 1);
    expect(mgr.hasNextLevel()).toBe(false);
  });

  it('hasNextLevel is false on the menu', () => {
    const mgr = new LevelManager();
    expect(mgr.hasNextLevel()).toBe(false);
  });

  it('advance returns null when called from menu state', () => {
    const mgr = new LevelManager();
    expect(mgr.isOnMenu()).toBe(true);
    expect(mgr.advance()).toBeNull();
    expect(mgr.isOnMenu()).toBe(true);
  });

  it('getLevels returns all defined levels', () => {
    const mgr = new LevelManager();
    const levels = mgr.getLevels();
    expect(levels.length).toBeGreaterThanOrEqual(3);
  });
});
