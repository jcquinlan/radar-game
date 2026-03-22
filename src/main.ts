import { createCanvas } from './canvas';
import { GameLoop } from './engine/GameLoop';
import { RadarDisplay } from './radar/RadarDisplay';
import { BlipRenderer } from './radar/BlipRenderer';
import { SweepEffects } from './radar/SweepEffects';
import { AmbientParticles } from './radar/AmbientParticles';
import { Player } from './entities/Player';
import { InputSystem } from './systems/InputSystem';
import { PingSystem } from './systems/PingSystem';
import { CombatSystem } from './systems/CombatSystem';
import { Enemy, GameEntity, HomeBase, createHomeBase } from './entities/Entity';
import { spawnWave, spawnBoss } from './systems/WaveSpawner';
import { BossSystem } from './systems/BossSystem';
import { HomebaseUpgradeSystem } from './systems/HomebaseUpgradeSystem';
import { World } from './world/World';
import { HUD } from './ui/HUD';
import { UpgradePanel } from './ui/UpgradePanel';
import { GameOverScreen } from './ui/GameOverScreen';
import { FloatingText } from './ui/FloatingText';
import { ScreenShake } from './ui/ScreenShake';
import { AbilitySystem } from './systems/AbilitySystem';
import { AbilityEffects } from './radar/AbilityEffects';
import { AbilityBar } from './ui/AbilityBar';
import { KeyRemapScreen } from './ui/KeyRemapScreen';
import { PauseMenu } from './ui/PauseMenu';
import { HelpScreen } from './ui/HelpScreen';
import { MotionTrail } from './radar/MotionTrail';
import { DeathParticles } from './radar/DeathParticles';
import { TowRopeSystem } from './systems/TowRopeSystem';
import { CombatBotSystem } from './systems/CombatBotSystem';
import { MiningBotSystem } from './systems/MiningBotSystem';
import { BotSlotSystem, SlotState } from './systems/BotSlotSystem';
import { createZoomState, adjustZoom, updateZoom, resetZoom, ZOOM_WHEEL_SENSITIVITY, ZOOM_KEY_STEP, ZoomState } from './systems/ZoomState';
import { Minimap } from './ui/Minimap';
import { ShaderPipeline } from './rendering/ShaderPipeline';
import { Renderer3D } from './rendering/Renderer3D';
import { EntityRenderer3D } from './rendering/EntityRenderer3D';
import { BloomEffect } from './rendering/effects/BloomEffect';
import { DamageDistortionEffect } from './rendering/effects/DamageDistortionEffect';
import { getTheme, cycleTheme } from './themes/theme';
import { LevelManager } from './levels/LevelManager';
import { LevelConfig, checkAllObjectivesComplete, getObjectiveProgress } from './levels/LevelConfig';
import { MainMenuScreen } from './ui/MainMenuScreen';
import { LevelCompleteScreen } from './ui/LevelCompleteScreen';
import { ResultsScreen } from './ui/ResultsScreen';
import { calculateCurrency, calculateReducedCurrency, loadSaveData, saveSaveData, SaveData } from './systems/SaveSystem';

type GameState = 'menu' | 'playing' | 'level_complete' | 'base_mode' | 'run_active' | 'final_wave' | 'results' | 'game_over' | 'paused';

const canvas = createCanvas('game-canvas');
const ctx = canvas.getContext('2d')!;

// Shader pipeline and pause menu (persist across game restarts)
const shaderPipeline = ShaderPipeline.create(canvas);
let damageDistortionEffect: DamageDistortionEffect | null = null;
if (shaderPipeline) {
  shaderPipeline.addEffect(new BloomEffect());
  const dmgEffect = new DamageDistortionEffect();
  shaderPipeline.addEffect(dmgEffect);
  damageDistortionEffect = dmgEffect;
}
// 3D renderer (renders behind the 2D canvas — optional, null if WebGL2 unavailable)
let renderer3d = Renderer3D.create(canvas);
let entityRenderer3d: EntityRenderer3D | null = null;
if (renderer3d) {
  entityRenderer3d = new EntityRenderer3D(renderer3d);
}
/** Whether to use 3D rendering. Set to false when WebGL2 is unavailable or user disables it. */
let use3D = renderer3d !== null;
const pauseMenu = new PauseMenu();
const helpScreen = new HelpScreen();
const levelManager = new LevelManager();
const mainMenuScreen = new MainMenuScreen();
const levelCompleteScreen = new LevelCompleteScreen();
const resultsScreen = new ResultsScreen();
let gameState: GameState = 'menu';
/** Persistent save data loaded from localStorage */
let saveData: SaveData = loadSaveData();
/** Tracks the state before pausing so we can restore it on unpause */
let previousState: GameState = 'menu';

let radar: RadarDisplay;
let blipRenderer: BlipRenderer;
let sweepEffects: SweepEffects;
let ambientParticles: AmbientParticles;
let player: Player;
let input: InputSystem;
let pingSystem: PingSystem;
let combatSystem: CombatSystem;
let world: World;
let hud: HUD;
let upgradePanel: UpgradePanel;
let gameOverScreen: GameOverScreen;
let floatingText: FloatingText;
let screenShake: ScreenShake;
let abilitySystem: AbilitySystem;
let abilityEffects: AbilityEffects;
let abilityBar: AbilityBar;
let keyRemapScreen: KeyRemapScreen;
let motionTrail: MotionTrail;
let deathParticles: DeathParticles;
let towRopeSystem: TowRopeSystem;
let combatBotSystem: CombatBotSystem;
let miningBotSystem: MiningBotSystem;
let botSlotSystem: BotSlotSystem;
let minimap: Minimap;
let homeBase: HomeBase;
let homebaseUpgradeSystem: HomebaseUpgradeSystem;
let resolutionLevel: number;
let prevHealth: number;
let damageFlash: number;
/** Countdown timer for timed runs (seconds). -1 means no active timer. */
let runTimer: number = -1;
/** Current run number (1-based). Controls wave size and difficulty scaling. */
let runCount: number = 1;
let currentLevelConfig: LevelConfig | null = null;
/** Pre-allocated Set for motion trail pruning — reused every frame to avoid GC pressure */
const activeTrailIds = new Set<string>();
/** Pre-allocated target position object — reused every frame to avoid GC pressure */
const waveTargetPos = { x: 0, y: 0 };
/** Camera zoom state — purely visual, does not affect gameplay mechanics */
const zoom: ZoomState = createZoomState();
/** Pre-allocated salvage array — reused every frame to pass active salvage to CombatSystem */
const salvageBuffer: import('./entities/Entity').Salvage[] = [];
/** Bounds for the START RUN button in base_mode (recalculated each render) */
let startRunBounds: { x: number; y: number; width: number; height: number } | null = null;
/** Click handler for base_mode START RUN button */
let baseModeClickHandler: ((e: MouseEvent) => void) | null = null;
/** Boss system for phase-based boss behavior */
let bossSystem: BossSystem = new BossSystem();
/** Current boss reference during final_wave (null when no boss is active) */
let currentBoss: Enemy | null = null;
/** Last frame's thrust input — captured in update, used in render for 3D player glow */
let lastThrust = 0;

function showMainMenu() {
  gameState = 'menu';
  levelManager.returnToMenu();
  mainMenuScreen.show(
    canvas,
    levelManager.getLevels(),
    (index) => {
      const config = levelManager.selectLevel(index);
      if (config) {
        currentLevelConfig = config;
        gameState = 'playing';
        init();
      }
    },
    () => {
      // Start Game -> base_mode (free play)
      currentLevelConfig = null;
      init();
      enterBaseMode();
    },
  );
}

/** Reset per-run state for a new run without recreating one-time systems (canvas, shaders, etc.) */
function startRun() {
  resetZoom(zoom);
  cleanupCurrentGame();
  player = new Player();
  world.reset();
  floatingText = new FloatingText();
  screenShake = new ScreenShake();
  sweepEffects = new SweepEffects();
  ambientParticles = new AmbientParticles();
  motionTrail = new MotionTrail();
  combatSystem = new CombatSystem();
  combatSystem.onShake = (intensity) => screenShake.trigger(intensity);
  towRopeSystem = new TowRopeSystem();
  abilitySystem = new AbilitySystem(player);
  abilitySystem.onShake = (intensity) => screenShake.trigger(intensity);
  abilityEffects = new AbilityEffects();
  combatBotSystem = new CombatBotSystem();
  combatBotSystem.onShake = (intensity) => screenShake.trigger(intensity);
  miningBotSystem = new MiningBotSystem();
  miningBotSystem.onShake = (intensity) => screenShake.trigger(intensity);
  botSlotSystem = new BotSlotSystem();
  // Wire slot release callbacks
  miningBotSystem.onSlotRelease = (slotIndex) => botSlotSystem.releaseSlot(slotIndex);
  combatBotSystem.onSlotRelease = (slotIndex) => botSlotSystem.releaseSlot(slotIndex);
  bossSystem = new BossSystem();
  currentBoss = null;
  pingSystem = new PingSystem({ maxRadius: radar.getRadius() });
  homeBase = createHomeBase(0, 0);
  resolutionLevel = 0;
  prevHealth = player.health;
  damageFlash = 0;

  // Apply persistent homebase upgrades to this run's systems
  homebaseUpgradeSystem.applyUpgrades(player, radar, pingSystem, miningBotSystem, combatBotSystem, botSlotSystem);

  input.attach();
  input.attachMouse(canvas);
  input.setCoordinateConverter(canvasToWorld);
  keyRemapScreen.load(abilitySystem.abilities);
  keyRemapScreen.attach(canvas, abilitySystem.abilities);
  upgradePanel.attach(canvas, homebaseUpgradeSystem, saveData, () => saveSaveData(saveData));
  world.updateSpawning(player.x, player.y);
  runTimer = 60; // 1 minute — compressed loop for rapid playtesting
  gameState = 'run_active';
}

function enterBaseMode() {
  gameState = 'base_mode';
  baseModeClickHandler = (e: MouseEvent) => {
    if (gameState !== 'base_mode' || !startRunBounds) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const b = startRunBounds;
    if (mx >= b.x && mx <= b.x + b.width && my >= b.y && my <= b.y + b.height) {
      leaveBaseMode();
      startRun();
    }
  };
  canvas.addEventListener('click', baseModeClickHandler);
}

function leaveBaseMode() {
  if (baseModeClickHandler) {
    canvas.removeEventListener('click', baseModeClickHandler);
    baseModeClickHandler = null;
  }
  startRunBounds = null;
}

function init() {
  resetZoom(zoom);
  radar = new RadarDisplay();
  blipRenderer = new BlipRenderer();
  sweepEffects = new SweepEffects();
  ambientParticles = new AmbientParticles();
  player = new Player();
  input = new InputSystem();
  pingSystem = new PingSystem({ maxRadius: radar.getRadius() });
  combatSystem = new CombatSystem();
  world = new World();
  hud = new HUD();
  upgradePanel = new UpgradePanel();
  gameOverScreen = new GameOverScreen();
  floatingText = new FloatingText();
  screenShake = new ScreenShake();
  combatSystem.onShake = (intensity) => screenShake.trigger(intensity);
  homeBase = createHomeBase(0, 0);
  homebaseUpgradeSystem = new HomebaseUpgradeSystem();
  homebaseUpgradeSystem.loadFromSave(saveData);
  resolutionLevel = 0;
  prevHealth = player.health;
  damageFlash = 0;

  abilitySystem = new AbilitySystem(player);
  abilitySystem.onShake = (intensity) => screenShake.trigger(intensity);
  abilityEffects = new AbilityEffects();
  combatBotSystem = new CombatBotSystem();
  combatBotSystem.onShake = (intensity) => screenShake.trigger(intensity);
  miningBotSystem = new MiningBotSystem();
  miningBotSystem.onShake = (intensity) => screenShake.trigger(intensity);
  botSlotSystem = new BotSlotSystem();
  miningBotSystem.onSlotRelease = (slotIndex) => botSlotSystem.releaseSlot(slotIndex);
  combatBotSystem.onSlotRelease = (slotIndex) => botSlotSystem.releaseSlot(slotIndex);
  abilityBar = new AbilityBar();
  motionTrail = new MotionTrail();
  deathParticles = new DeathParticles(200);
  towRopeSystem = new TowRopeSystem();
  minimap = new Minimap();
  minimap.initBounds(canvas.width, canvas.height);
  keyRemapScreen = new KeyRemapScreen();
  keyRemapScreen.addExtraBinding({
    id: 'upgrades',
    name: 'Upgrades',
    description: 'Open the upgrades panel',
    key: 'e',
  });
  keyRemapScreen.load(abilitySystem.abilities);

  // Apply level config to world
  if (currentLevelConfig) {
    world.setLevelConfig(currentLevelConfig);

    // Apply player overrides
    const overrides = currentLevelConfig.playerOverrides;
    if (overrides) {
      if (overrides.maxHealth != null) {
        player.maxHealth = overrides.maxHealth;
        player.health = overrides.maxHealth;
      }
      if (overrides.health != null) player.health = overrides.health;
      if (overrides.speed != null) {
        player.speed = overrides.speed;
        player.baseSpeed = overrides.speed;
      }
      if (overrides.energy != null) player.energy = overrides.energy;
    }
  }

  prevHealth = player.health;


  input.attach();
  input.attachMouse(canvas);
  input.setCoordinateConverter(canvasToWorld);
  keyRemapScreen.attach(canvas, abilitySystem.abilities);
  upgradePanel.attach(canvas, homebaseUpgradeSystem, saveData, () => saveSaveData(saveData));
  world.updateSpawning(player.x, player.y);
}

/** Convert canvas pixel coordinates to world coordinates, inverting the render transform */
function canvasToWorld(canvasX: number, canvasY: number): { worldX: number; worldY: number } {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const z = zoom.current;
  const R = -player.heading - Math.PI / 2;

  // Undo translate(cx,cy) and scale
  const dx = (canvasX - cx) / z;
  const dy = (canvasY - cy) / z;

  // Undo rotate(R) by rotating by -R
  const cosNR = Math.cos(-R);
  const sinNR = Math.sin(-R);
  const offX = cosNR * dx - sinNR * dy;
  const offY = sinNR * dx + cosNR * dy;

  return { worldX: player.x + offX, worldY: player.y + offY };
}

/** Show results screen after a successful run (wave survived) */
function showRunResults() {
  const baseHpPercent = homeBase.maxHealth > 0 ? homeBase.health / homeBase.maxHealth : 0;
  const currency = calculateCurrency(player.salvageDeposited, player.kills, baseHpPercent);
  saveData.currency += currency;
  saveData.runCount++;
  saveSaveData(saveData);

  gameState = 'results';
  towRopeSystem.clear();
  deathParticles.reset();
  resultsScreen.show(canvas, {
    salvageDeposited: player.salvageDeposited,
    enemiesKilled: player.kills,
    baseHpPercent,
    currencyEarned: currency,
  }, () => {
    cleanupCurrentGame();
    enterBaseMode();
  });
}

/** Show results screen after a failed run (player died or base destroyed) */
function showRunFailed() {
  const baseHpPercent = homeBase.maxHealth > 0 ? homeBase.health / homeBase.maxHealth : 0;
  const currency = calculateReducedCurrency(player.salvageDeposited, player.kills, baseHpPercent);
  saveData.currency += currency;
  saveData.runCount++;
  saveSaveData(saveData);

  gameState = 'game_over';
  towRopeSystem.clear();
  deathParticles.reset();
  resultsScreen.show(canvas, {
    salvageDeposited: player.salvageDeposited,
    enemiesKilled: player.kills,
    baseHpPercent,
    currencyEarned: currency,
  }, () => {
    cleanupCurrentGame();
    enterBaseMode();
  }, true);
}

function cleanupCurrentGame() {
  if (input) {
    input.detach();
    input.detachMouse(canvas);
  }
  if (upgradePanel) upgradePanel.detach(canvas);
  if (keyRemapScreen) keyRemapScreen.detach(canvas);
  if (towRopeSystem) towRopeSystem.clear();
  if (combatBotSystem) combatBotSystem.reset();
  if (deathParticles) deathParticles.reset();
  if (gameOverScreen) gameOverScreen.hide(canvas);
  if (resultsScreen) resultsScreen.hide(canvas);
  if (levelCompleteScreen) levelCompleteScreen.hide(canvas);
  leaveBaseMode();
}

function onLevelComplete() {
  gameState = 'level_complete';
  const hasNext = levelManager.hasNextLevel();
  levelCompleteScreen.show(
    canvas,
    currentLevelConfig!,
    hasNext,
    () => {
      // Next level
      const nextConfig = levelManager.advance();
      cleanupCurrentGame();
      if (nextConfig) {
        currentLevelConfig = nextConfig;
        gameState = 'playing';
        init();
      } else {
        showMainMenu();
      }
    },
    () => {
      // Back to menu
      cleanupCurrentGame();
      showMainMenu();
    },
  );
}

function togglePause() {
  if (gameState === 'paused') {
    gameState = previousState;
    pauseMenu.close(canvas);
  } else {
    previousState = gameState;
    gameState = 'paused';
    // Close other panels when pausing
    if (keyRemapScreen && keyRemapScreen.isVisible()) keyRemapScreen.toggle();
    pauseMenu.open(canvas, {
      onResume: () => togglePause(),
      onRestart: () => {
        pauseMenu.close(canvas);
        cleanupCurrentGame();
        if (currentLevelConfig) {
          gameState = 'playing';
          init();
        } else {
          showMainMenu();
        }
      },
      onToggleShaders: () => {
        if (shaderPipeline) {
          shaderPipeline.setEnabled(!shaderPipeline.enabled);
        }
      },
      onCycleTheme: () => cycleTheme(),
      onOpenKeybinds: () => {
        gameState = previousState;
        pauseMenu.close(canvas);
        keyRemapScreen.toggle();
      },
      isShaderEnabled: () => shaderPipeline ? shaderPipeline.enabled : false,
      getThemeName: () => getTheme().name,
    });
  }
}

/** States where the game loop is actively running (gameplay states) */
function isActiveGameplay(state: GameState): boolean {
  return state === 'playing' || state === 'run_active' || state === 'final_wave';
}

// Mouse wheel: zoom during gameplay, scroll when help screen is open
window.addEventListener('wheel', (e) => {
  if (helpScreen.isVisible()) {
    helpScreen.scroll(-e.deltaY * 0.5);
    e.preventDefault();
    return;
  }
  if (isActiveGameplay(gameState) || gameState === 'base_mode') {
    // Normalize deltaY for different deltaMode values (pixel vs line vs page)
    const normalizedDelta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    adjustZoom(zoom, -normalizedDelta * ZOOM_WHEEL_SENSITIVITY);
    e.preventDefault();
  }
}, { passive: false });

// Toggle panels (registered once, outside init)
window.addEventListener('keydown', (e) => {
  // Escape closes help screen first, then toggles pause
  if (e.key === 'Escape') {
    if (helpScreen.isVisible()) {
      helpScreen.toggle();
      return;
    }
    if (gameState === 'paused' || isActiveGameplay(gameState) || gameState === 'base_mode') {
      togglePause();
      return;
    }
  }

  // Only handle remaining keys during active gameplay, pause, or base_mode
  if (!isActiveGameplay(gameState) && gameState !== 'paused' && gameState !== 'base_mode') return;

  // Key remap screen captures keys when listening — skip other handlers
  if (keyRemapScreen && keyRemapScreen.isListening()) return;

  // Don't process other keys while paused
  if (gameState === 'paused') return;

  // Zoom in/out with +/- keys
  if (e.key === '=' || e.key === '+') {
    adjustZoom(zoom, ZOOM_KEY_STEP);
    return;
  }
  if (e.key === '-' || e.key === '_') {
    adjustZoom(zoom, -ZOOM_KEY_STEP);
    return;
  }

  // Only show upgrades panel if upgrades are enabled
  const features = currentLevelConfig?.features;
  // Upgrade panel — only available in base_mode (homebase upgrades are persistent between runs)
  {
    const upgradesBinding = keyRemapScreen ? keyRemapScreen.getExtraBinding('upgrades') : null;
    const upgradesKey = upgradesBinding ? upgradesBinding.key : 'e';
    if ((e.key === upgradesKey || e.key === upgradesKey.toUpperCase()) && gameState === 'base_mode') {
      upgradePanel.toggle();
    }
  }
  if ((e.key === 'k' || e.key === 'K') && isActiveGameplay(gameState)) {
    keyRemapScreen.toggle();
  }
  if ((e.key === 'h' || e.key === 'H') && (isActiveGameplay(gameState) || gameState === 'base_mode')) {
    helpScreen.toggle();
    return;
  }
  if ((e.key === 'm' || e.key === 'M') && (isActiveGameplay(gameState) || gameState === 'base_mode')) {
    minimap.toggle();
    return;
  }

  // Ability keybinds — only if abilities are enabled
  if (!isActiveGameplay(gameState) || keyRemapScreen.isVisible()) return;
  if (features?.abilities === false) return;

  const addText = (text: string, x: number, y: number, color: string) =>
    floatingText.add(text, x, y, color);
  const onDeath = (x: number, y: number, srcX: number, srcY: number, color: string) =>
    deathParticles.emitFromSource(x, y, srcX, srcY, color);

  for (const ability of abilitySystem.abilities) {
    if (e.key === ability.keybind) {
      if (ability.id === 'damage_blast') {
        if (abilitySystem.activate('damage_blast', world.entities, addText, onDeath)) {
          abilityEffects.triggerBlast();
          screenShake.trigger(4);
        }
      } else if (ability.id === 'heal_over_time') {
        if (abilitySystem.activate('heal_over_time', world.entities, addText, onDeath)) {
          const t = getTheme();
          floatingText.add('REGEN!', player.x, player.y - 25, t.abilities.heal_over_time);
        }
      } else if (ability.id === 'dash') {
        if (abilitySystem.activate('dash', world.entities, addText, onDeath)) {
          const t = getTheme();
          floatingText.add('DASH!', player.x, player.y - 25, t.abilities.dash);
          screenShake.trigger(2);
        }
      } else if (ability.id === 'homing_missile') {
        if (abilitySystem.activate('homing_missile', world.entities, addText, onDeath)) {
          const t = getTheme();
          abilityEffects.triggerMissileLaunch(player.x, player.y);
          floatingText.add('MISSILE!', player.x, player.y - 25, t.abilities.homing_missile);
          screenShake.trigger(3);
        }
      }
      break;
    }
  }
});

// Minimap click handler: click inside to expand, click outside to collapse
canvas.addEventListener('click', (e) => {
  if (!isActiveGameplay(gameState) && gameState !== 'base_mode') return;
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const my = (e.clientY - rect.top) * (canvas.height / rect.height);

  if (minimap.isExpanded()) {
    // Click outside the expanded minimap to collapse
    if (!minimap.hitTest(mx, my)) {
      minimap.collapse();
    }
  } else {
    // Click inside the collapsed minimap to expand
    if (minimap.hitTest(mx, my)) {
      minimap.expand();
    }
  }
});

// Start on main menu
showMainMenu();

const loop = new GameLoop({
  update(dt) {
    if (!isActiveGameplay(gameState)) return;

    // Zoom lerp
    updateZoom(zoom, dt);

    // Minimap animation
    minimap.update(dt);

    // Run timer countdown — only during timed runs
    if (gameState === 'run_active' && runTimer >= 0) {
      runTimer -= dt;
      if (runTimer <= 0) {
        runTimer = 0;

        // Auto-deposit towed salvage before clearing entities
        const towedItems = towRopeSystem.getTowedItems();
        for (const item of towedItems) {
          player.addEnergy(50);
          player.score += 50;
          player.salvageDeposited++;
        }
        towRopeSystem.clear();

        // Teleport player to home base position
        player.x = 0;
        player.y = 0;
        player.vx = 0;
        player.vy = 0;

        // Close upgrade panel if open
        if (upgradePanel.isVisible()) {
          upgradePanel.toggle();
        }

        // Spawn the final wave and transition to final_wave state
        const waveEnemies = spawnWave(runCount);
        // Clear non-wave entities from the world before adding wave enemies
        world.entities.length = 0;
        for (const enemy of waveEnemies) {
          world.entities.push(enemy);
        }

        // Spawn the boss far from the base
        bossSystem.reset();
        const boss = spawnBoss(runCount);
        currentBoss = boss;
        world.entities.push(boss);

        gameState = 'final_wave';

        // Show WAVE INCOMING floating text
        floatingText.add('WAVE INCOMING', 0, -30, '#ffff00');
        floatingText.add('BOSS DETECTED', 0, -50, '#ff3333');

        return;
      }
    }

    const features = currentLevelConfig?.features;

    // Tank-style movement: A/D turn, W/S thrust along heading
    const { turn, thrust } = input.getTankInput();
    lastThrust = thrust;
    const oldX = player.x;
    const oldY = player.y;

    // Turn with inertia
    const turnAccel = player.turnSpeed * player.turnFriction;
    player.turnVelocity += turn * turnAccel * dt;
    player.turnVelocity *= Math.exp(-player.turnFriction * dt);
    player.heading += player.turnVelocity * dt;

    // Accelerate along heading direction
    const playerAccel = player.speed * player.friction;
    player.vx += Math.cos(player.heading) * thrust * playerAccel * dt;
    player.vy += Math.sin(player.heading) * thrust * playerAccel * dt;
    const decay = Math.exp(-player.friction * dt);
    player.vx *= decay;
    player.vy *= decay;
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // Track stats
    const moveDx = player.x - oldX;
    const moveDy = player.y - oldY;
    player.distanceTraveled += Math.sqrt(moveDx * moveDx + moveDy * moveDy);
    player.survivalTime += dt;

    // Spawn entities in new areas
    world.updateSpawning(player.x, player.y);

    // Left-click: deploy mining bot near asteroid
    const leftClick = input.consumeClick();
    if (leftClick) {
      const slotIdx = botSlotSystem.acquireSlot('mining');
      if (slotIdx >= 0) {
        if (miningBotSystem.deployBot(leftClick.worldX, leftClick.worldY, world.entities, player, slotIdx)) {
          floatingText.add('MINING BOT DEPLOYED', leftClick.worldX, leftClick.worldY - 15, getTheme().entities.miningBot);
        } else {
          // No asteroid in range — cancel the slot (no cooldown)
          botSlotSystem.cancelSlot(slotIdx);
          floatingText.add('NO ASTEROID', leftClick.worldX, leftClick.worldY - 15, '#ff4444');
        }
      } else {
        floatingText.add('NO CHARGES', leftClick.worldX, leftClick.worldY - 15, '#ff4444');
      }
    }

    // Right-click: deploy combat bot
    const rightClick = input.consumeRightClick();
    if (rightClick) {
      const slotIdx = botSlotSystem.acquireSlot('combat');
      if (slotIdx >= 0) {
        combatBotSystem.deployBot(rightClick.worldX, rightClick.worldY, player, slotIdx);
        floatingText.add('COMBAT BOT DEPLOYED', rightClick.worldX, rightClick.worldY - 15, getTheme().entities.combatBot);
        screenShake.trigger(2);
      } else {
        floatingText.add('NO CHARGES', rightClick.worldX, rightClick.worldY - 15, '#ff4444');
      }
    }

    // Blip + particle + HUD updates
    blipRenderer.update(dt);
    ambientParticles.update(dt);
    hud.update(dt);

    // Ping system — expanding circle detection
    const events = pingSystem.update(world.entities, player, dt);

    // Feed ping state to radar for rendering
    radar.setPingState(pingSystem.getState());

    const theme = getTheme();

    // Visual effects from ping interactions
    sweepEffects.addEvents(events, player.x, player.y);
    sweepEffects.update(dt);
    floatingText.update(dt);

    // Salvage & tow rope — only if enabled
    if (features?.towRope !== false) {
      const pickedUp = towRopeSystem.checkPickups(world.entities, player);
      for (const salvage of pickedUp) {
        floatingText.add('SALVAGE!', salvage.x, salvage.y, theme.entities.salvage);
      }
      towRopeSystem.update(player, dt);
      const deposited = towRopeSystem.checkDropoffs(world.entities);
      for (const { salvage, dropoff } of deposited) {
        player.addEnergy(dropoff.rewardPerItem);
        player.score += dropoff.rewardPerItem;
        player.salvageDeposited++;
        floatingText.add(`+${dropoff.rewardPerItem}E`, salvage.x, salvage.y, theme.entities.dropoff);
        screenShake.trigger(2);
      }
      // Home base also acts as a salvage deposit point
      const homeDeposited = towRopeSystem.checkHomeDeposit(homeBase);
      for (const salvage of homeDeposited) {
        const reward = TowRopeSystem.HOME_DEPOSIT_REWARD;
        player.addEnergy(reward);
        player.score += reward;
        player.salvageDeposited++;
        floatingText.add(`+${reward}E`, salvage.x, salvage.y, theme.entities.dropoff);
        screenShake.trigger(2);
      }
    }

    // Shield buff countdown
    player.updateShield(dt);

    // Abilities — only if enabled
    if (features?.abilities !== false) {
      const addText = (text: string, x: number, y: number, color: string) =>
        floatingText.add(text, x, y, color);
      const onAbilityDeath = (x: number, y: number, srcX: number, srcY: number, color: string) =>
        deathParticles.emitFromSource(x, y, srcX, srcY, color);
      const onAbilityImpact = (x: number, y: number, srcX: number, srcY: number, color: string) =>
        deathParticles.emitFromSource(x, y, srcX, srcY, color, 5);
      abilitySystem.update(dt, world.entities, addText, onAbilityDeath, onAbilityImpact);

      // Bot slot cooldowns
      botSlotSystem.update(dt);

      // Mining bots — click-deployed asteroid miners
      miningBotSystem.update(
        dt, player, world.entities,
        (text, x, y, color) => floatingText.add(text, x, y, color),
      );

      const hotAbility = abilitySystem.getAbility('heal_over_time');
      if (hotAbility) {
        abilityEffects.setRegenActive(hotAbility.active, hotAbility.durationRemaining);
      }
      abilityEffects.update(dt);
    }

    // Combat bot AI — auto-attack nearby enemies
    combatBotSystem.update(
      dt, world.entities,
      (text, x, y, color) => floatingText.add(text, x, y, color),
      (x, y, srcX, srcY, color) => deathParticles.emitFromSource(x, y, srcX, srcY, color),
      (x, y, srcX, srcY, color) => deathParticles.emitFromSource(x, y, srcX, srcY, color, 5),
      player,
    );

    // Combat — only if enabled
    let alive = true;
    if (features?.combat !== false) {
      // During final_wave, enemies target the home base instead of the player
      let targetPos: { x: number; y: number } | undefined;
      let baseTarget: HomeBase | undefined;
      if (gameState === 'final_wave') {
        waveTargetPos.x = homeBase.x;
        waveTargetPos.y = homeBase.y;
        targetPos = waveTargetPos;
        baseTarget = homeBase;
      }
      // Build salvage array for combat collision (reuse pre-allocated buffer)
      // Towed salvage remains in world.entities, so this catches all active salvage
      salvageBuffer.length = 0;
      for (let i = 0; i < world.entities.length; i++) {
        const e = world.entities[i];
        if (e.active && e.type === 'salvage') salvageBuffer.push(e as import('./entities/Entity').Salvage);
      }

      alive = combatSystem.update(
        world.entities, player, dt, abilitySystem.isDashing(), 15,
        (text, x, y, color) => floatingText.add(text, x, y, color),
        (x, y, srcX, srcY, color) => deathParticles.emitFromSource(x, y, srcX, srcY, color),
        (x, y, srcX, srcY, color) => deathParticles.emitFromSource(x, y, srcX, srcY, color, 5),
        targetPos,
        baseTarget,
        salvageBuffer.length > 0 ? salvageBuffer : undefined,
      );
    }

    // Boss system update — phase transitions and minion spawning
    if (gameState === 'final_wave' && currentBoss && currentBoss.active) {
      const newMinions = bossSystem.updateBoss(currentBoss, dt, runCount);
      for (const minion of newMinions) {
        world.entities.push(minion);
      }
    }

    // Decrement salvage damage flash timers
    for (let i = 0; i < salvageBuffer.length; i++) {
      const s = salvageBuffer[i];
      if (s.damageFlash > 0) {
        s.damageFlash = Math.max(0, s.damageFlash - dt);
      }
    }

    // Death particles
    deathParticles.update(dt);

    // Motion trails — track fast-moving entities
    motionTrail.track('player', player.x, player.y, player.vx, player.vy, theme.radar.primary, dt);
    activeTrailIds.clear();
    activeTrailIds.add('player');
    for (let i = 0; i < world.entities.length; i++) {
      const entity = world.entities[i];
      if (!entity.active || entity.type !== 'enemy') continue;
      const enemy = entity as Enemy;
      const eid = `e${i}`;
      motionTrail.track(eid, enemy.x, enemy.y, enemy.vx, enemy.vy, theme.entities.enemy, dt);
      activeTrailIds.add(eid);
    }
    if (features?.combat !== false) {
      for (let i = 0; i < combatSystem.projectiles.length; i++) {
        const p = combatSystem.projectiles[i];
        if (!p.active) continue;
        const pid = `p${i}`;
        motionTrail.track(pid, p.x, p.y, p.vx, p.vy, theme.effects.projectile, dt);
        activeTrailIds.add(pid);
      }
    }
    if (features?.abilities !== false) {
      for (let i = 0; i < abilitySystem.missiles.length; i++) {
        const missile = abilitySystem.missiles[i];
        const mid = `m${i}`;
        motionTrail.track(mid, missile.x, missile.y, missile.vx, missile.vy, theme.effects.missile, dt);
        activeTrailIds.add(mid);
      }
    }
    // Combat bot entity trails
    for (let i = 0; i < combatBotSystem.bots.length; i++) {
      const cb = combatBotSystem.bots[i];
      if (!cb.active) continue;
      const cbid = `cb${i}`;
      motionTrail.track(cbid, cb.x, cb.y, cb.vx, cb.vy, theme.entities.combatBot, dt);
      activeTrailIds.add(cbid);
    }
    // Mining bot trails
    const miningBots = miningBotSystem.getBots();
    for (let i = 0; i < miningBots.length; i++) {
      const mb = miningBots[i];
      if (!mb.active) continue;
      const mbid = `mb${i}`;
      motionTrail.track(mbid, mb.x, mb.y, mb.vx, mb.vy, theme.entities.miningBot, dt);
      activeTrailIds.add(mbid);
    }
    // Combat bot projectile trails
    for (let i = 0; i < combatBotSystem.botProjectiles.length; i++) {
      const cbp = combatBotSystem.botProjectiles[i];
      if (!cbp.active) continue;
      const cbpid = `cbp${i}`;
      motionTrail.track(cbpid, cbp.x, cbp.y, cbp.vx, cbp.vy, theme.entities.botProjectile, dt);
      activeTrailIds.add(cbpid);
    }
    motionTrail.prune(activeTrailIds);

    // Screen shake + damage flash on damage
    if (player.health < prevHealth) {
      const dmgTaken = prevHealth - player.health;
      screenShake.trigger(Math.min(dmgTaken * 0.8, 12));
      damageFlash = Math.min(0.5, dmgTaken * 0.03 + 0.1);
    }
    prevHealth = player.health;
    screenShake.update(dt);
    if (damageFlash > 0) {
      damageFlash = Math.max(0, damageFlash - dt * 2);
    }
    if (damageDistortionEffect) {
      damageDistortionEffect.setDamageIntensity(damageFlash * 2);
    }

    // Check level objectives
    if (currentLevelConfig && checkAllObjectivesComplete(currentLevelConfig.objectives, player)) {
      onLevelComplete();
      return;
    }

    if (!alive) {
      if (gameState === 'run_active' || gameState === 'final_wave') {
        showRunFailed();
      } else {
        gameState = 'game_over';
        towRopeSystem.clear();
        deathParticles.reset();
        gameOverScreen.show(canvas, player, () => {
          cleanupCurrentGame();
          showMainMenu();
        });
      }
      return;
    }

    // Wave end conditions during final_wave
    if (gameState === 'final_wave') {
      // Base destroyed — run failed
      if (homeBase.health <= 0) {
        homeBase.health = 0;
        showRunFailed();
        return;
      }

      // Boss killed — round won! (primary win condition)
      if (currentBoss && !currentBoss.active) {
        currentBoss = null;
        runCount++;
        showRunResults();
        return;
      }

      // Fallback: all wave enemies dead (if boss somehow missed) — wave survived
      const waveEnemiesAlive = world.entities.some(
        (e: GameEntity) => e.active && e.type === 'enemy' && (e as Enemy).waveEnemy
      );
      if (!waveEnemiesAlive) {
        currentBoss = null;
        runCount++;
        showRunResults();
        return;
      }
    }

    // Periodic cleanup — preserve wave enemies during final_wave
    if (gameState !== 'final_wave') {
      world.cleanup(player.x, player.y);
    }
  },
  render() {
    // Main menu render
    if (gameState === 'menu') {
      mainMenuScreen.render(ctx, canvas.width, canvas.height);
      if (shaderPipeline) {
        shaderPipeline.render(performance.now() / 1000);
      }
      return;
    }

    // Base mode render — home base + START RUN button
    if (gameState === 'base_mode') {
      const theme = getTheme();
      ctx.fillStyle = theme.radar.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const bcx = canvas.width / 2;
      const bcy = canvas.height / 2;

      // Radar background (static, no ping)
      radar.render(ctx, bcx, bcy);

      // Home base at center — boundary ring and hexagon
      ctx.save();
      const pulse = 1 + Math.sin(performance.now() / 1000 * 1.5) * 0.05;

      // Outer boundary ring
      ctx.beginPath();
      ctx.arc(bcx, bcy, 150 * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100, 220, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner glow fill
      ctx.beginPath();
      ctx.arc(bcx, bcy, 150 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100, 220, 255, 0.03)';
      ctx.fill();

      // Inner ring
      ctx.beginPath();
      ctx.arc(bcx, bcy, 90 * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100, 220, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Center hexagon
      const hexRadius = 14;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const hxp = bcx + Math.cos(angle) * hexRadius;
        const hyp = bcy + Math.sin(angle) * hexRadius;
        if (i === 0) ctx.moveTo(hxp, hyp);
        else ctx.lineTo(hxp, hyp);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(100, 220, 255, 0.4)';
      ctx.strokeStyle = 'rgba(100, 220, 255, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();

      // Player ship indicator at center
      ctx.fillStyle = theme.radar.primary;
      ctx.beginPath();
      ctx.moveTo(bcx, bcy - 10);
      ctx.lineTo(bcx - 6, bcy + 6);
      ctx.lineTo(bcx + 6, bcy + 6);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // "HOME BASE" label
      ctx.save();
      ctx.font = '14px monospace';
      ctx.fillStyle = 'rgba(100, 220, 255, 0.6)';
      ctx.textAlign = 'center';
      ctx.fillText('HOME BASE', bcx, bcy - 170);

      // START RUN button
      const btnWidth = 280;
      const btnHeight = 50;
      const btnX = bcx - btnWidth / 2;
      const btnY = bcy + 200;
      startRunBounds = { x: btnX, y: btnY, width: btnWidth, height: btnHeight };

      ctx.fillStyle = 'rgba(0, 255, 65, 0.08)';
      ctx.fillRect(btnX, btnY, btnWidth, btnHeight);
      ctx.strokeStyle = '#00ff41';
      ctx.lineWidth = 2;
      ctx.strokeRect(btnX, btnY, btnWidth, btnHeight);

      ctx.font = 'bold 20px monospace';
      ctx.fillStyle = '#00ff41';
      ctx.textAlign = 'center';
      ctx.fillText('START RUN', bcx, btnY + 32);

      // Currency display
      ctx.font = '16px monospace';
      ctx.fillStyle = '#ffaa00';
      ctx.textAlign = 'center';
      ctx.fillText(`CURRENCY: ${saveData.currency}`, bcx, bcy + 170);

      // Run count
      if (saveData.runCount > 0) {
        ctx.font = '12px monospace';
        ctx.fillStyle = 'rgba(136, 170, 136, 0.6)';
        ctx.fillText(`Runs completed: ${saveData.runCount}`, bcx, bcy + 190);
      }

      // Upgrades key hint
      {
        const ub = keyRemapScreen.getExtraBinding('upgrades');
        const uk = ub ? ub.key : 'e';
        const displayKey = uk.length === 1 ? uk.toUpperCase() : uk;
        ctx.font = '12px monospace';
        ctx.fillStyle = 'rgba(136, 170, 136, 0.8)';
        ctx.fillText(`Press [${displayKey}] for upgrades`, bcx, bcy + 210);
      }

      // --- Upgrade buildings rendered around the homebase ---
      const buildingRadius = 110;
      const buildingDefs = [
        { angle: -Math.PI / 2, label: 'PLAYER', color: '#00ff41', icon: 'P', tab: 'player' as const },
        { angle: -Math.PI / 2 + (2 * Math.PI / 3), label: 'MINING', color: getTheme().entities.miningBot, icon: 'M', tab: 'mining' as const },
        { angle: -Math.PI / 2 + (4 * Math.PI / 3), label: 'COMBAT', color: getTheme().entities.combatBot, icon: 'C', tab: 'combat' as const },
      ];
      for (const bld of buildingDefs) {
        const bx = bcx + Math.cos(bld.angle) * buildingRadius;
        const by = bcy + Math.sin(bld.angle) * buildingRadius;

        // Building circle
        ctx.beginPath();
        ctx.arc(bx, by, 22, 0, Math.PI * 2);
        ctx.fillStyle = `${bld.color}10`;
        ctx.fill();
        ctx.strokeStyle = `${bld.color}80`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Building icon
        ctx.font = 'bold 16px monospace';
        ctx.fillStyle = bld.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(bld.icon, bx, by);

        // Label below
        ctx.font = '9px monospace';
        ctx.fillStyle = `${bld.color}99`;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(bld.label, bx, by + 34);
      }

      ctx.restore();

      // Upgrade panel (right side) — only in base_mode
      upgradePanel.render(ctx, homebaseUpgradeSystem, saveData, canvas.width, canvas.height);

      // Pause menu (if paused from base_mode — shows on top)
      pauseMenu.render(ctx, canvas.width, canvas.height);

      if (shaderPipeline) {
        shaderPipeline.render(performance.now() / 1000);
      }
      return;
    }

    const cx = canvas.width / 2 + screenShake.offsetX;
    const cy = canvas.height / 2 + screenShake.offsetY;

    const theme = getTheme();

    // 3D renderer pass — renders entities as 3D meshes on a separate WebGL2 canvas
    if (use3D && renderer3d && entityRenderer3d) {
      renderer3d.setClearColor(theme.radar.background);
      renderer3d.beginFrame(player.x, player.y, player.heading, zoom.current);

      // View radius for culling — same formula used for 2D rendering below
      const viewRadius3d = Math.sqrt(canvas.width * canvas.width + canvas.height * canvas.height) / 2 / zoom.current;

      // Render asteroids with rotation, damage flash, mining darkening, and culling
      entityRenderer3d.renderAsteroids(
        world.entities,
        player.x,
        player.y,
        viewRadius3d,
        player.survivalTime,
      );

      // Render home base with HP-based red tinting and pulse
      entityRenderer3d.renderHomeBase(homeBase, player.survivalTime);

      // Render enemies with subtype-specific 3D meshes and animations
      entityRenderer3d.renderEnemies(
        world.entities,
        player.x,
        player.y,
        viewRadius3d,
        player.survivalTime,
      );

      // Render salvage as rotating 3D diamonds
      entityRenderer3d.renderSalvage(
        world.entities,
        player.x,
        player.y,
        viewRadius3d,
        player.survivalTime,
      );

      // Render mining bots as 3D icospheres
      entityRenderer3d.renderMiningBots(
        miningBotSystem.getBots(),
        player.x,
        player.y,
        viewRadius3d,
        player.survivalTime,
      );

      // Render combat bots as 3D chevrons with lifetime pulse
      entityRenderer3d.renderCombatBots(
        combatBotSystem.bots,
        player.x,
        player.y,
        viewRadius3d,
        player.survivalTime,
      );

      // Render all projectile types as 3D shapes
      entityRenderer3d.renderProjectiles(
        combatSystem.projectiles,
        combatBotSystem.botProjectiles,
        abilitySystem.missiles,
        player.x,
        player.y,
        viewRadius3d,
        player.survivalTime,
      );

      // Render player ship with banking and engine glow
      entityRenderer3d.renderPlayer(
        player.x,
        player.y,
        player.turnVelocity,
        lastThrust,
        player.survivalTime,
      );

      renderer3d.endFrame();
    }

    // When 3D is active: clear transparently and blit the 3D canvas as background.
    // When 3D is off: draw an opaque background for the 2D fallback path.
    if (use3D && renderer3d) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(renderer3d.getCanvas(), 0, 0);
    } else {
      ctx.fillStyle = theme.radar.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Radar (drawn without rotation — rings/crosshair are fixed, but scaled with zoom)
    radar.render(ctx, cx, cy, player.x, player.y, player.heading, zoom.current);

    // Rotated world layer — full screen visibility, no circular clip
    ctx.save();

    // Rotate and scale world around center (world rotates opposite to player turn)
    ctx.translate(cx, cy);
    ctx.scale(zoom.current, zoom.current);
    ctx.rotate(-player.heading - Math.PI / 2); // Offset so heading=0 (up) maps to screen-up
    ctx.translate(-cx, -cy);

    // View radius covers the full screen — divide by zoom so we don't cull entities that are
    // visible when zoomed out (zoom < 1 means more world is visible)
    const viewRadius = Math.sqrt(canvas.width * canvas.width + canvas.height * canvas.height) / 2 / zoom.current;
    ambientParticles.renderDeep(ctx, cx, cy, viewRadius, player.x, player.y);

    // Entity blips (2D fallback) — when 3D is active, only render ghost-blips and labels.
    // When 3D is off, render full entity shapes.
    const worldRot = -player.heading - Math.PI / 2;
    blipRenderer.renderBlips(
      ctx,
      world.entities,
      player.x,
      player.y,
      cx,
      cy,
      viewRadius,
      resolutionLevel,
      worldRot,
      !use3D,
    );

    // Sweep effects (radar ping visual feedback — stays on 2D overlay)
    sweepEffects.render(ctx, cx, cy);

    // Ability visual effects (player feedback — stays on 2D overlay)
    abilityEffects.render(ctx, cx, cy, player.x, player.y, player.survivalTime);

    // Floating text (counter-rotated so text stays upright — stays on 2D overlay)
    const worldRotation = -player.heading - Math.PI / 2;
    floatingText.render(ctx, player.x, player.y, cx, cy, worldRotation);

    // Foreground particles (on top of entities — closer to camera)
    ambientParticles.renderForeground(ctx, cx, cy, viewRadius, player.x, player.y);

    ctx.restore();

    // Subtle darkening outside the ping range ring
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.arc(cx, cy, radar.getRadius() * zoom.current, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fill();
    ctx.restore();

    // Player heading indicator — only shown in 2D mode (3D renders the player ship)
    if (!use3D) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 8);
      ctx.lineTo(cx - 5, cy + 5);
      ctx.lineTo(cx + 5, cy + 5);
      ctx.closePath();
      ctx.fillStyle = '#00ff41';
      ctx.fill();
    }

    // Bot slot UI — row of small circles below the player indicator
    {
      const slots = botSlotSystem.getSlots();
      const slotRadius = 4;
      const slotSpacing = 12;
      const totalWidth = (slots.length - 1) * slotSpacing;
      const startX = cx - totalWidth / 2;
      const slotY = cy + 16;

      for (let i = 0; i < slots.length; i++) {
        const sx = startX + i * slotSpacing;
        const slot = slots[i];

        ctx.beginPath();
        ctx.arc(sx, slotY, slotRadius, 0, Math.PI * 2);

        if (slot.state === SlotState.Ready) {
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        } else if (slot.state === SlotState.ActiveMining) {
          ctx.fillStyle = '#ffaa00';
          ctx.fill();
        } else if (slot.state === SlotState.ActiveCombat) {
          ctx.fillStyle = '#ff8844';
          ctx.fill();
        } else {
          // Cooldown — outline only, dim
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    // Damage flash vignette — red overlay that fades when player takes damage
    if (damageFlash > 0) {
      ctx.save();
      const vignetteRadius = Math.max(canvas.width, canvas.height) * 0.7;
      const gradient = ctx.createRadialGradient(cx, cy, vignetteRadius * 0.5, cx, cy, vignetteRadius);
      gradient.addColorStop(0, `rgba(${theme.effects.damageFlash}, 0)`);
      gradient.addColorStop(1, `rgba(${theme.effects.damageFlash}, ${damageFlash})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Border glow at screen edges
      const edgeGradient = ctx.createRadialGradient(cx, cy, vignetteRadius * 0.7, cx, cy, vignetteRadius);
      edgeGradient.addColorStop(0, `rgba(${theme.effects.damageFlashEdge}, 0)`);
      edgeGradient.addColorStop(1, `rgba(${theme.effects.damageFlashEdge}, ${damageFlash * 1.5})`);
      ctx.fillStyle = edgeGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    // HUD
    hud.render(ctx, player, canvas.width, canvas.height, runTimer, homeBase,
      undefined,
      currentBoss);

    // Boss direction indicator — pulsing arrow on screen edge when boss is off-screen
    if (currentBoss && currentBoss.active && gameState === 'final_wave') {
      // World-space offset from player to boss
      const bossDx = currentBoss.x - player.x;
      const bossDy = currentBoss.y - player.y;
      const bossDist = Math.sqrt(bossDx * bossDx + bossDy * bossDy);

      // Only show indicator if boss is outside the visible radar radius
      const visibleRadius = radar.getRadius() * zoom.current;
      if (bossDist > visibleRadius * 0.8) {
        // Calculate angle in screen space (rotated by player heading)
        const worldAngle = Math.atan2(bossDy, bossDx);
        const screenAngle = worldAngle - player.heading - Math.PI / 2;

        // Position the indicator at the edge of the screen
        const edgeMargin = 40;
        const edgeX = cx + Math.cos(screenAngle) * (visibleRadius - edgeMargin);
        const edgeY = cy + Math.sin(screenAngle) * (visibleRadius - edgeMargin);

        // Pulsing alpha
        const pulse = 0.5 + Math.sin(performance.now() / 300) * 0.3;

        ctx.save();
        ctx.translate(edgeX, edgeY);
        ctx.rotate(screenAngle + Math.PI / 2);

        // Arrow triangle pointing outward
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#ff3333';
        ctx.shadowColor = '#ff3333';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(-7, 6);
        ctx.lineTo(7, 6);
        ctx.closePath();
        ctx.fill();

        // Distance label
        ctx.shadowBlur = 0;
        ctx.globalAlpha = pulse * 0.8;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.floor(bossDist)}m`, 0, 18);

        ctx.restore();
      }
    }

    // Tutorial hints
    if (currentLevelConfig && currentLevelConfig.hints.length > 0) {
      ctx.font = '14px monospace';
      ctx.fillStyle = 'rgba(136, 170, 136, 0.8)';
      ctx.textAlign = 'left';
      const hintX = 20;
      let hintY = canvas.height - 20 - (currentLevelConfig.hints.length - 1) * 22;
      for (const hint of currentLevelConfig.hints) {
        ctx.fillText(hint, hintX, hintY);
        hintY += 22;
      }
    }

    // Minimap (bottom left)
    minimap.render(ctx, player, world.entities, canvas.width, canvas.height, homeBase, zoom.current);

    // Objective progress
    if (currentLevelConfig && currentLevelConfig.objectives.length > 0) {
      const progress = getObjectiveProgress(currentLevelConfig.objectives, player);
      ctx.font = '14px monospace';
      ctx.textAlign = 'right';
      const objX = canvas.width - 20;
      let objY = 100;
      for (const p of progress) {
        ctx.fillStyle = p.complete ? '#00ff41' : 'rgba(255, 255, 255, 0.7)';
        ctx.fillText(`${p.label}: ${p.current}/${p.target}${p.complete ? ' ✓' : ''}`, objX, objY);
        objY += 24;
      }
    }

    // Ability bar (bottom center) — only if abilities enabled
    if (currentLevelConfig?.features.abilities !== false) {
      abilityBar.render(ctx, abilitySystem.abilities, canvas.width, canvas.height);
    }

    // Game over overlay
    gameOverScreen.render(ctx, canvas.width, canvas.height);

    // Results screen overlay (win or lose from run mode)
    resultsScreen.render(ctx, canvas.width, canvas.height);

    // Level complete overlay
    levelCompleteScreen.render(ctx, canvas.width, canvas.height);

    // Key remap screen (on top of everything)
    keyRemapScreen.render(ctx, abilitySystem.abilities, canvas.width, canvas.height);

    // Help screen
    const upgradesBinding = keyRemapScreen.getExtraBinding('upgrades');
    helpScreen.render(ctx, canvas.width, canvas.height, upgradesBinding ? upgradesBinding.key : 'e');

    // Pause menu (on top of everything except shader)
    pauseMenu.render(ctx, canvas.width, canvas.height);

    // Post-processing shader pass (reads the completed 2D canvas as a texture)
    if (shaderPipeline) {
      shaderPipeline.render(performance.now() / 1000);
    }
  },
});

loop.start();
