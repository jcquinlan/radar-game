import { THEMES } from './themes';

export interface ColorTheme {
  name: string;

  radar: {
    /** Primary accent color (e.g., #00ff41 neon green) */
    primary: string;
    /** Dim accent for grid/rings */
    dim: string;
    /** Background fill */
    background: string;
    /** Scanline overlay color */
    scanline: string;
    /** RGB components of primary for rgba() construction (e.g., "0, 255, 65") */
    pingRgb: string;
  };

  entities: {
    resource: string;
    enemy: string;
    enemyRanged: string;
    ally: string;
    allyHealer: string;
    allyShield: string;
    allyBeacon: string;
    salvage: string;
    dropoff: string;
    asteroid: string;
    enemyScout: string;
    enemyBrute: string;
    enemyBoss: string;
    miningBot: string;
    combatBot: string;
    botProjectile: string;
  };

  ui: {
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    textDisabled: string;
    barBackground: string;
    panelBackground: string;
    panelBackgroundSolid: string;
    highlight: string;
    highlightSubtle: string;
    border: string;
    borderDim: string;
    cooldownText: string;
    maxedText: string;
    statsText: string;
    labelText: string;
  };

  abilities: {
    damage_blast: string;
    heal_over_time: string;
    dash: string;
    homing_missile: string;
  };

  events: {
    collect: string;
    damage: string;
    heal: string;
    shield: string;
  };

  threats: {
    low: string;
    moderate: string;
    high: string;
    extreme: string;
    critical: string;
  };

  effects: {
    projectile: string;
    projectileGlow: string;
    drone: string;
    missile: string;
    damageFlash: string;
    damageFlashEdge: string;
    particle: string;
  };
}

let currentTheme: ColorTheme = THEMES.classic;

export function getTheme(): ColorTheme {
  return currentTheme;
}

export function setTheme(name: string): void {
  currentTheme = THEMES[name] ?? THEMES.classic;
}

export function getThemeNames(): string[] {
  return Object.keys(THEMES);
}

export function cycleTheme(): void {
  const names = getThemeNames();
  const idx = names.indexOf(currentTheme.name);
  const next = names[(idx + 1) % names.length];
  setTheme(next);
}
