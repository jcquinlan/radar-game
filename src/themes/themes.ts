import type { ColorTheme } from './theme';

const classic: ColorTheme = {
  name: 'classic',

  radar: {
    primary: '#00ff41',
    dim: '#003b0f',
    background: '#0a0a0a',
    scanline: 'rgba(0, 0, 0, 0.08)',
    pingRgb: '0, 255, 65',
  },

  entities: {
    resource: '#00ff41',
    enemy: '#ff4141',
    enemyRanged: '#ff8841',
    ally: '#4488ff',
    allyHealer: '#4488ff',
    allyShield: '#00ffff',
    allyBeacon: '#88ff41',
    salvage: '#ffaa00',
    dropoff: '#ffdd00',
    asteroid: '#cc8844',
    enemyScout: '#ff4141',
    enemyBrute: '#cc2222',
    enemyBoss: '#ff44aa',
    miningBot: '#44ddff',
    combatBot: '#4488ff',
    botProjectile: '#44ddff',
  },

  ui: {
    textPrimary: '#00ff41',
    textSecondary: '#557755',
    textTertiary: '#335533',
    textDisabled: '#335533',
    barBackground: '#1a1a1a',
    panelBackground: 'rgba(0, 10, 0, 0.9)',
    panelBackgroundSolid: 'rgba(0, 15, 0, 0.95)',
    highlight: 'rgba(0, 255, 65, 0.15)',
    highlightSubtle: 'rgba(0, 255, 65, 0.05)',
    border: '#00ff41',
    borderDim: '#335533',
    cooldownText: '#663333',
    maxedText: '#666',
    statsText: '#88aa88',
    labelText: '#557755',
  },

  abilities: {
    damage_blast: '#ff4141',
    heal_over_time: '#00ff41',
    dash: '#ffff00',
    homing_missile: '#ff8800',
  },

  events: {
    collect: '#00ff41',
    damage: '#ff4141',
    heal: '#4488ff',
    shield: '#00ffff',
  },

  threats: {
    low: '#00ff41',
    moderate: '#88ff41',
    high: '#ffaa00',
    extreme: '#ff4141',
    critical: '#ff00ff',
  },

  effects: {
    projectile: '#ff6641',
    projectileGlow: '#ff4141',
    drone: '#00ffff',
    missile: '#ff8800',
    damageFlash: '255, 0, 0',
    damageFlashEdge: '255, 65, 65',
    particle: '#00ff41',
  },
};

const ocean: ColorTheme = {
  name: 'ocean',

  radar: {
    primary: '#00d4ff',
    dim: '#003344',
    background: '#080c10',
    scanline: 'rgba(0, 0, 0, 0.08)',
    pingRgb: '0, 212, 255',
  },

  entities: {
    resource: '#00d4ff',
    enemy: '#ff5566',
    enemyRanged: '#ff8855',
    ally: '#44ff88',
    allyHealer: '#44ff88',
    allyShield: '#88ffdd',
    allyBeacon: '#aaff44',
    salvage: '#ffcc33',
    dropoff: '#ffee55',
    asteroid: '#aa9966',
    enemyScout: '#ff5566',
    enemyBrute: '#cc3344',
    enemyBoss: '#ff44cc',
    miningBot: '#44ffcc',
    combatBot: '#44aaff',
    botProjectile: '#44ffcc',
  },

  ui: {
    textPrimary: '#00d4ff',
    textSecondary: '#557788',
    textTertiary: '#334455',
    textDisabled: '#334455',
    barBackground: '#1a1a22',
    panelBackground: 'rgba(0, 8, 16, 0.9)',
    panelBackgroundSolid: 'rgba(0, 12, 20, 0.95)',
    highlight: 'rgba(0, 212, 255, 0.15)',
    highlightSubtle: 'rgba(0, 212, 255, 0.05)',
    border: '#00d4ff',
    borderDim: '#334455',
    cooldownText: '#663344',
    maxedText: '#668',
    statsText: '#88aaaa',
    labelText: '#557788',
  },

  abilities: {
    damage_blast: '#ff5566',
    heal_over_time: '#44ff88',
    dash: '#ffee55',
    homing_missile: '#ff8855',
  },

  events: {
    collect: '#00d4ff',
    damage: '#ff5566',
    heal: '#44ff88',
    shield: '#88ffdd',
  },

  threats: {
    low: '#00d4ff',
    moderate: '#44ddaa',
    high: '#ffcc33',
    extreme: '#ff5566',
    critical: '#ff44cc',
  },

  effects: {
    projectile: '#ff6655',
    projectileGlow: '#ff5566',
    drone: '#88ffdd',
    missile: '#ff8855',
    damageFlash: '255, 50, 80',
    damageFlashEdge: '255, 85, 100',
    particle: '#00d4ff',
  },
};

const ember: ColorTheme = {
  name: 'ember',

  radar: {
    primary: '#ff6622',
    dim: '#331100',
    background: '#0c0806',
    scanline: 'rgba(0, 0, 0, 0.08)',
    pingRgb: '255, 102, 34',
  },

  entities: {
    resource: '#ff6622',
    enemy: '#ff2244',
    enemyRanged: '#ff4488',
    ally: '#ffaa22',
    allyHealer: '#ffaa22',
    allyShield: '#ffdd44',
    allyBeacon: '#ffcc00',
    salvage: '#cc88ff',
    dropoff: '#ffdd66',
    asteroid: '#dd7744',
    enemyScout: '#ff2244',
    enemyBrute: '#bb1122',
    enemyBoss: '#ff44aa',
    miningBot: '#44bbff',
    combatBot: '#4488dd',
    botProjectile: '#44bbff',
  },

  ui: {
    textPrimary: '#ff6622',
    textSecondary: '#886644',
    textTertiary: '#553322',
    textDisabled: '#553322',
    barBackground: '#1a1410',
    panelBackground: 'rgba(16, 6, 0, 0.9)',
    panelBackgroundSolid: 'rgba(20, 8, 0, 0.95)',
    highlight: 'rgba(255, 102, 34, 0.15)',
    highlightSubtle: 'rgba(255, 102, 34, 0.05)',
    border: '#ff6622',
    borderDim: '#553322',
    cooldownText: '#664433',
    maxedText: '#886',
    statsText: '#aa8866',
    labelText: '#886644',
  },

  abilities: {
    damage_blast: '#ff2244',
    heal_over_time: '#ffaa22',
    dash: '#ffee88',
    homing_missile: '#ff4488',
  },

  events: {
    collect: '#ff6622',
    damage: '#ff2244',
    heal: '#ffaa22',
    shield: '#ffdd44',
  },

  threats: {
    low: '#ff6622',
    moderate: '#ffaa22',
    high: '#ff4444',
    extreme: '#ff2244',
    critical: '#ff00aa',
  },

  effects: {
    projectile: '#ff4466',
    projectileGlow: '#ff2244',
    drone: '#ffdd44',
    missile: '#ff4488',
    damageFlash: '255, 30, 20',
    damageFlashEdge: '255, 80, 60',
    particle: '#ff6622',
  },
};

export const THEMES: Record<string, ColorTheme> = { classic, ocean, ember };
