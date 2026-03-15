import { LevelConfig } from './LevelConfig';

export const LEVELS: LevelConfig[] = [
  {
    id: 'tutorial-movement',
    name: 'Tutorial: Navigation',
    description: 'Learn to pilot your ship and collect energy.',
    features: {
      combat: false,
      upgrades: false,
      abilities: false,
      salvage: false,
      towRope: false,
    },
    world: {
      maxChunks: 25,
      difficultyMultiplier: 0,
      spawnEnemies: false,
      spawnAllies: false,
    },
    objectives: [
      { type: 'collect_energy', target: 50, label: 'Collect 50 energy' },
    ],
    hints: [
      'W / ↑  Forward thrust',
      'S / ↓  Reverse thrust',
      'A / ←  Turn left',
      'D / →  Turn right',
      'Fly through green blips to collect energy!',
    ],
  },
  {
    id: 'tutorial-combat',
    name: 'Tutorial: Combat',
    description: 'Learn to fight enemies with your radar ping.',
    features: {
      combat: true,
      upgrades: false,
      abilities: false,
      salvage: false,
      towRope: false,
    },
    world: {
      maxChunks: 25,
      difficultyMultiplier: 0.5,
      spawnEnemies: true,
      spawnAllies: true,
    },
    objectives: [
      { type: 'kill_enemies', target: 5, label: 'Destroy 5 enemies' },
    ],
    hints: [
      'Your radar ping damages enemies on contact.',
      'Red blips are enemies — fly close and let your ping hit them!',
      'Blue blips are allies — healers, shields, and beacons.',
    ],
    playerOverrides: {
      health: 80,
      maxHealth: 80,
    },
  },
  {
    id: 'full-game',
    name: 'Full Game',
    description: 'All systems online. Survive as long as you can.',
    features: {
      combat: true,
      upgrades: true,
      abilities: true,
      salvage: true,
      towRope: true,
    },
    world: {
      maxChunks: null,
      difficultyMultiplier: null,
      spawnEnemies: true,
      spawnAllies: true,
    },
    objectives: [],
    hints: [],
  },
];
