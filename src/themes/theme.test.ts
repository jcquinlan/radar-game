import { describe, it, expect, beforeEach } from 'vitest';
import { getTheme, setTheme, getThemeNames, cycleTheme, getEnemyColor } from './theme';
import type { Enemy } from '../entities/Entity';

describe('theme system', () => {
  beforeEach(() => {
    setTheme('classic');
  });

  it('returns the classic theme by default', () => {
    const theme = getTheme();
    expect(theme.name).toBe('classic');
  });

  it('classic theme has all required color categories', () => {
    const theme = getTheme();

    // Radar colors
    expect(theme.radar.primary).toBeDefined();
    expect(theme.radar.dim).toBeDefined();
    expect(theme.radar.background).toBeDefined();
    expect(theme.radar.scanline).toBeDefined();
    expect(theme.radar.pingRgb).toBeDefined();

    // Entity colors
    expect(theme.entities.resource).toBeDefined();
    expect(theme.entities.enemy).toBeDefined();
    expect(theme.entities.enemyRanged).toBeDefined();
    expect(theme.entities.ally).toBeDefined();
    expect(theme.entities.allyHealer).toBeDefined();
    expect(theme.entities.allyShield).toBeDefined();
    expect(theme.entities.allyBeacon).toBeDefined();
    expect(theme.entities.salvage).toBeDefined();
    expect(theme.entities.dropoff).toBeDefined();
    expect(theme.entities.enemyScout).toBeDefined();
    expect(theme.entities.enemyBrute).toBeDefined();
    expect(theme.entities.enemyBoss).toBeDefined();
    expect(theme.entities.miningBot).toBeDefined();
    expect(theme.entities.combatBot).toBeDefined();
    expect(theme.entities.botProjectile).toBeDefined();

    // UI colors
    expect(theme.ui.textPrimary).toBeDefined();
    expect(theme.ui.textSecondary).toBeDefined();
    expect(theme.ui.textTertiary).toBeDefined();
    expect(theme.ui.textDisabled).toBeDefined();
    expect(theme.ui.barBackground).toBeDefined();
    expect(theme.ui.panelBackground).toBeDefined();
    expect(theme.ui.panelBackgroundSolid).toBeDefined();
    expect(theme.ui.highlight).toBeDefined();
    expect(theme.ui.highlightSubtle).toBeDefined();
    expect(theme.ui.border).toBeDefined();
    expect(theme.ui.borderDim).toBeDefined();
    expect(theme.ui.cooldownText).toBeDefined();
    expect(theme.ui.maxedText).toBeDefined();
    expect(theme.ui.statsText).toBeDefined();
    expect(theme.ui.labelText).toBeDefined();

    // Ability colors
    expect(theme.abilities.damage_blast).toBeDefined();
    expect(theme.abilities.heal_over_time).toBeDefined();
    expect(theme.abilities.dash).toBeDefined();
    expect(theme.abilities.homing_missile).toBeDefined();

    // Event colors
    expect(theme.events.collect).toBeDefined();
    expect(theme.events.damage).toBeDefined();
    expect(theme.events.heal).toBeDefined();
    expect(theme.events.shield).toBeDefined();

    // Threat level colors
    expect(theme.threats.low).toBeDefined();
    expect(theme.threats.moderate).toBeDefined();
    expect(theme.threats.high).toBeDefined();
    expect(theme.threats.extreme).toBeDefined();
    expect(theme.threats.critical).toBeDefined();

    // Effects
    expect(theme.effects.projectile).toBeDefined();
    expect(theme.effects.projectileGlow).toBeDefined();
    expect(theme.effects.drone).toBeDefined();
    expect(theme.effects.missile).toBeDefined();
    expect(theme.effects.damageFlash).toBeDefined();
    expect(theme.effects.damageFlashEdge).toBeDefined();
    expect(theme.effects.particle).toBeDefined();
  });

  it('switches to ocean theme', () => {
    setTheme('ocean');
    const theme = getTheme();
    expect(theme.name).toBe('ocean');
    expect(theme.radar.primary).not.toBe(getClassicPrimary());
  });

  it('switches to ember theme', () => {
    setTheme('ember');
    const theme = getTheme();
    expect(theme.name).toBe('ember');
  });

  it('switches back to classic', () => {
    setTheme('ocean');
    setTheme('classic');
    expect(getTheme().name).toBe('classic');
  });

  it('falls back to classic for unknown theme name', () => {
    setTheme('nonexistent');
    expect(getTheme().name).toBe('classic');
  });

  it('getThemeNames returns all available theme names', () => {
    const names = getThemeNames();
    expect(names).toContain('classic');
    expect(names).toContain('ocean');
    expect(names).toContain('ember');
    expect(names.length).toBe(3);
  });

  it('getTheme returns the same reference on consecutive calls without switching', () => {
    const a = getTheme();
    const b = getTheme();
    expect(a).toBe(b);
  });

  it('cycleTheme advances to the next theme and wraps around', () => {
    expect(getTheme().name).toBe('classic');
    cycleTheme();
    expect(getTheme().name).toBe('ocean');
    cycleTheme();
    expect(getTheme().name).toBe('ember');
    cycleTheme();
    expect(getTheme().name).toBe('classic');
  });

  it('classic theme matches the original hardcoded neon green palette', () => {
    const theme = getTheme();
    expect(theme.radar.primary).toBe('#00ff41');
    expect(theme.radar.dim).toBe('#003b0f');
    expect(theme.radar.background).toBe('#0a0a0a');
    expect(theme.entities.resource).toBe('#00ff41');
    expect(theme.entities.enemy).toBe('#ff4141');
    expect(theme.entities.salvage).toBe('#ffaa00');
    expect(theme.entities.dropoff).toBe('#ffdd00');
  });

  describe('getEnemyColor', () => {
    it('returns enemyScout color for scout subtype', () => {
      const enemy = { subtype: 'scout', isBoss: false } as Enemy;
      expect(getEnemyColor(enemy)).toBe(getTheme().entities.enemyScout);
    });

    it('returns enemyBrute color for brute subtype', () => {
      const enemy = { subtype: 'brute', isBoss: false } as Enemy;
      expect(getEnemyColor(enemy)).toBe(getTheme().entities.enemyBrute);
    });

    it('returns enemyRanged color for ranged subtype', () => {
      const enemy = { subtype: 'ranged', isBoss: false } as Enemy;
      expect(getEnemyColor(enemy)).toBe(getTheme().entities.enemyRanged);
    });

    it('returns enemyBoss color for boss enemies regardless of subtype', () => {
      const enemy = { subtype: 'ranged', isBoss: true } as Enemy;
      expect(getEnemyColor(enemy)).toBe(getTheme().entities.enemyBoss);
    });

    it('returns base enemy color for unknown subtype', () => {
      const enemy = { subtype: 'unknown' as string, isBoss: false } as Enemy;
      expect(getEnemyColor(enemy)).toBe(getTheme().entities.enemy);
    });
  });
});

// Helper to get the classic primary color without importing themes directly
function getClassicPrimary(): string {
  setTheme('classic');
  const color = getTheme().radar.primary;
  return color;
}
