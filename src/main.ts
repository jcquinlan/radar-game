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
import { Ally, Enemy, GameEntity, Resource, Dropoff, HomeBase, Defense, createHomeBase } from './entities/Entity';
import { spawnWave } from './systems/WaveSpawner';
import { UpgradeSystem } from './systems/UpgradeSystem';
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
import { MotionTrail } from './radar/MotionTrail';
import { TowRopeSystem } from './systems/TowRopeSystem';
import { Minimap } from './ui/Minimap';
import { ShaderPipeline } from './rendering/ShaderPipeline';
import { CRTEffect } from './rendering/effects/CRTEffect';
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
if (shaderPipeline) {
  shaderPipeline.addEffect(new CRTEffect());
}
const pauseMenu = new PauseMenu();
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
let upgradeSystem: UpgradeSystem;
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
let towRopeSystem: TowRopeSystem;
let minimap: Minimap;
let homeBase: HomeBase;
let defenses: Defense[] = [];
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
/** Bounds for the START RUN button in base_mode (recalculated each render) */
let startRunBounds: { x: number; y: number; width: number; height: number } | null = null;
/** Click handler for base_mode START RUN button */
let baseModeClickHandler: ((e: MouseEvent) => void) | null = null;

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
  cleanupCurrentGame();
  player = new Player();
  world.reset();
  floatingText = new FloatingText();
  screenShake = new ScreenShake();
  sweepEffects = new SweepEffects();
  ambientParticles = new AmbientParticles();
  motionTrail = new MotionTrail();
  combatSystem = new CombatSystem();
  towRopeSystem = new TowRopeSystem();
  abilitySystem = new AbilitySystem(player);
  abilityEffects = new AbilityEffects();
  pingSystem = new PingSystem({ maxRadius: radar.getRadius() });
  upgradeSystem = new UpgradeSystem(player, radar, (lvl) => {
    resolutionLevel = lvl;
  }, pingSystem);
  homeBase = createHomeBase(0, 0);
  resolutionLevel = 0;
  prevHealth = player.health;
  damageFlash = 0;

  // Disable Canvas 2D scanlines when shader pipeline is active
  radar.scanlineEnabled = !shaderPipeline || !shaderPipeline.enabled;

  input.attach();
  keyRemapScreen.load(abilitySystem.abilities);
  keyRemapScreen.attach(canvas, abilitySystem.abilities);
  upgradePanel.attach(canvas, upgradeSystem, player);
  world.updateSpawning(player.x, player.y);
  runTimer = 600; // 10 minutes
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
  homeBase = createHomeBase(0, 0);
  defenses = [];
  resolutionLevel = 0;
  prevHealth = player.health;
  damageFlash = 0;

  upgradeSystem = new UpgradeSystem(player, radar, (lvl) => {
    resolutionLevel = lvl;
  }, pingSystem);
  abilitySystem = new AbilitySystem(player);
  abilityEffects = new AbilityEffects();
  abilityBar = new AbilityBar();
  motionTrail = new MotionTrail();
  towRopeSystem = new TowRopeSystem();
  minimap = new Minimap();
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

  // Disable Canvas 2D scanlines when shader pipeline is active
  radar.scanlineEnabled = !shaderPipeline || !shaderPipeline.enabled;

  input.attach();
  keyRemapScreen.attach(canvas, abilitySystem.abilities);
  upgradePanel.attach(canvas, upgradeSystem, player);
  world.updateSpawning(player.x, player.y);
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
  if (input) input.detach();
  if (upgradePanel) upgradePanel.detach(canvas);
  if (keyRemapScreen) keyRemapScreen.detach(canvas);
  if (towRopeSystem) towRopeSystem.clear();
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
          radar.scanlineEnabled = !shaderPipeline.enabled;
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

// Toggle panels (registered once, outside init)
window.addEventListener('keydown', (e) => {
  // Escape toggles pause from any active gameplay state or base_mode
  if (e.key === 'Escape') {
    if (gameState === 'paused' || isActiveGameplay(gameState) || gameState === 'base_mode') {
      togglePause();
      return;
    }
  }

  // Only handle remaining keys during active gameplay or pause
  if (!isActiveGameplay(gameState) && gameState !== 'paused') return;

  // Key remap screen captures keys when listening — skip other handlers
  if (keyRemapScreen && keyRemapScreen.isListening()) return;

  // Don't process other keys while paused
  if (gameState === 'paused') return;

  // Only show upgrades panel if upgrades are enabled
  const features = currentLevelConfig?.features;
  if (features?.upgrades !== false) {
    const upgradesBinding = keyRemapScreen.getExtraBinding('upgrades');
    const upgradesKey = upgradesBinding ? upgradesBinding.key : 'e';
    if ((e.key === upgradesKey || e.key === upgradesKey.toUpperCase()) && isActiveGameplay(gameState) && !keyRemapScreen.isVisible()) {
      upgradePanel.toggle();
    }
  }
  if ((e.key === 'k' || e.key === 'K') && isActiveGameplay(gameState)) {
    keyRemapScreen.toggle();
  }

  // Ability keybinds — only if abilities are enabled
  if (!isActiveGameplay(gameState) || keyRemapScreen.isVisible()) return;
  if (features?.abilities === false) return;

  const addText = (text: string, x: number, y: number, color: string) =>
    floatingText.add(text, x, y, color);

  for (const ability of abilitySystem.abilities) {
    if (e.key === ability.keybind) {
      if (ability.id === 'damage_blast') {
        if (abilitySystem.activate('damage_blast', world.entities, addText)) {
          abilityEffects.triggerBlast();
          screenShake.trigger(4);
        }
      } else if (ability.id === 'heal_over_time') {
        if (abilitySystem.activate('heal_over_time', world.entities, addText)) {
          const t = getTheme();
          floatingText.add('REGEN!', player.x, player.y - 25, t.abilities.heal_over_time);
        }
      } else if (ability.id === 'helper_drone') {
        if (abilitySystem.activate('helper_drone', world.entities, addText)) {
          const t = getTheme();
          abilityEffects.triggerDroneSpawn(player.x, player.y);
          floatingText.add('DRONE!', player.x, player.y - 25, t.abilities.helper_drone);
        }
      } else if (ability.id === 'dash') {
        if (abilitySystem.activate('dash', world.entities, addText)) {
          const t = getTheme();
          floatingText.add('DASH!', player.x, player.y - 25, t.abilities.dash);
          screenShake.trigger(2);
        }
      } else if (ability.id === 'homing_missile') {
        if (abilitySystem.activate('homing_missile', world.entities, addText)) {
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

// Start on main menu
showMainMenu();

const loop = new GameLoop({
  update(dt) {
    if (!isActiveGameplay(gameState)) return;

    // Run timer countdown — only during timed runs
    if (gameState === 'run_active' && runTimer >= 0) {
      runTimer -= dt;
      if (runTimer <= 0) {
        runTimer = 0;
        // Spawn the final wave and transition to final_wave state
        const waveEnemies = spawnWave(runCount);
        // Clear non-wave entities from the world before adding wave enemies
        world.entities.length = 0;
        for (const enemy of waveEnemies) {
          world.entities.push(enemy);
        }
        gameState = 'final_wave';
        return;
      }
    }

    const features = currentLevelConfig?.features;

    // Tank-style movement: A/D turn, W/S thrust along heading
    const { turn, thrust } = input.getTankInput();
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

    // Blip + particle + HUD updates
    blipRenderer.update(dt);
    ambientParticles.update(dt);
    hud.update(dt);

    // Ping system — expanding circle detection
    const events = pingSystem.update(world.entities, player, dt);

    // Feed ping state to radar for rendering
    radar.setPingState(pingSystem.getState());

    // Track score and floating text from ping events
    const theme = getTheme();
    for (const event of events) {
      if (event.type === 'collect') {
        player.totalEnergyCollected += event.value;
        player.score += event.value;
        floatingText.add(`+${event.value}E`, event.entity.x, event.entity.y, theme.events.collect);
      }
      if (event.type === 'heal') {
        floatingText.add(`+${event.value}HP`, player.x, player.y - 20, theme.events.heal);
      }
      if (event.type === 'shield') {
        floatingText.add('SHIELD!', player.x, player.y - 20, theme.events.shield);
      }
    }

    // Visual effects from ping interactions
    sweepEffects.addEvents(events, player.x, player.y);
    sweepEffects.update(dt);
    floatingText.update(dt);

    // Energy magnet: auto-collect nearby resources
    if (player.magnetRange > 0) {
      for (const entity of world.entities) {
        if (!entity.active || entity.type !== 'resource') continue;
        const resource = entity as Resource;
        const mdx = entity.x - player.x;
        const mdy = entity.y - player.y;
        if (mdx * mdx + mdy * mdy < player.magnetRange * player.magnetRange) {
          player.addEnergy(resource.energyValue);
          player.totalEnergyCollected += resource.energyValue;
          player.score += resource.energyValue;
          floatingText.add(`+${resource.energyValue}E`, resource.x, resource.y, theme.events.collect);
          resource.active = false;
        }
      }
    }

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

    // Beacon passive energy generation
    for (const entity of world.entities) {
      if (!entity.active || entity.type !== 'ally') continue;
      const ally = entity as Ally;
      if (ally.subtype !== 'beacon') continue;
      const bdx = ally.x - player.x;
      const bdy = ally.y - player.y;
      if (bdx * bdx + bdy * bdy < ally.beaconRange * ally.beaconRange) {
        player.addEnergy(ally.energyPerSecond * dt);
      }
    }

    // Abilities — only if enabled
    if (features?.abilities !== false) {
      const addText = (text: string, x: number, y: number, color: string) =>
        floatingText.add(text, x, y, color);
      abilitySystem.update(dt, world.entities, addText);

      const hotAbility = abilitySystem.getAbility('heal_over_time');
      if (hotAbility) {
        abilityEffects.setRegenActive(hotAbility.active, hotAbility.durationRemaining);
      }
      abilityEffects.update(dt);
    }

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
      alive = combatSystem.update(
        world.entities, player, dt, abilitySystem.isDashing(), 15,
        (text, x, y, color) => floatingText.add(text, x, y, color),
        targetPos,
        baseTarget,
      );
    }

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
      for (let i = 0; i < abilitySystem.drones.length; i++) {
        const drone = abilitySystem.drones[i];
        const did = `d${i}`;
        motionTrail.track(did, drone.x, drone.y, drone.vx, drone.vy, theme.effects.drone, dt);
        activeTrailIds.add(did);
      }
      for (let i = 0; i < abilitySystem.missiles.length; i++) {
        const missile = abilitySystem.missiles[i];
        const mid = `m${i}`;
        motionTrail.track(mid, missile.x, missile.y, missile.vx, missile.vy, theme.effects.missile, dt);
        activeTrailIds.add(mid);
      }
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

      // All wave enemies dead — wave survived, show results
      const waveEnemiesAlive = world.entities.some(
        (e: GameEntity) => e.active && e.type === 'enemy' && (e as Enemy).waveEnemy
      );
      if (!waveEnemiesAlive) {
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

      ctx.restore();

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
    ctx.fillStyle = theme.radar.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Radar (drawn without rotation — rings/crosshair are fixed)
    radar.render(ctx, cx, cy);

    // Rotated world layer — full screen visibility, no circular clip
    ctx.save();

    // Rotate world around center by negative heading (world rotates opposite to player turn)
    ctx.translate(cx, cy);
    ctx.rotate(-player.heading - Math.PI / 2); // Offset so heading=0 (up) maps to screen-up
    ctx.translate(-cx, -cy);

    // View radius covers the full screen (corner-to-corner distance)
    const viewRadius = Math.sqrt(canvas.width * canvas.width + canvas.height * canvas.height) / 2;
    const viewRadiusSq = viewRadius * viewRadius;

    ambientParticles.renderDeep(ctx, cx, cy, viewRadius, player.x, player.y);

    // Motion trails (rendered behind blips)
    motionTrail.render(ctx, player.x, player.y, cx, cy);

    // Home base — boundary ring and center marker (tints toward red when damaged)
    {
      const hbx = homeBase.x - player.x;
      const hby = homeBase.y - player.y;
      if (hbx * hbx + hby * hby <= viewRadiusSq) {
        const hsx = cx + hbx;
        const hsy = cy + hby;
        const pulse = 1 + Math.sin(player.survivalTime * 1.5) * 0.05;

        // Interpolate color from cyan (100,220,255) to red (255,60,60) based on damage
        const hpRatio = homeBase.maxHealth > 0 ? homeBase.health / homeBase.maxHealth : 1;
        const hbR = Math.round(100 + (255 - 100) * (1 - hpRatio));
        const hbG = Math.round(220 * hpRatio + 60 * (1 - hpRatio));
        const hbB = Math.round(255 * hpRatio + 60 * (1 - hpRatio));
        const hbHex = `#${hbR.toString(16).padStart(2, '0')}${hbG.toString(16).padStart(2, '0')}${hbB.toString(16).padStart(2, '0')}`;

        ctx.save();

        // Outer boundary ring
        ctx.beginPath();
        ctx.arc(hsx, hsy, homeBase.radius * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${hbR}, ${hbG}, ${hbB}, 0.25)`;
        ctx.lineWidth = 2;
        ctx.shadowColor = hbHex;
        ctx.shadowBlur = 10;
        ctx.stroke();

        // Inner glow fill
        ctx.beginPath();
        ctx.arc(hsx, hsy, homeBase.radius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${hbR}, ${hbG}, ${hbB}, 0.03)`;
        ctx.fill();

        // Inner ring (second boundary line for depth)
        ctx.beginPath();
        ctx.arc(hsx, hsy, homeBase.radius * 0.6 * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${hbR}, ${hbG}, ${hbB}, 0.12)`;
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
        ctx.stroke();

        // Center structure — hexagon shape
        ctx.translate(hsx, hsy);
        const hexRadius = 10;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          const hxp = Math.cos(angle) * hexRadius;
          const hyp = Math.sin(angle) * hexRadius;
          if (i === 0) ctx.moveTo(hxp, hyp);
          else ctx.lineTo(hxp, hyp);
        }
        ctx.closePath();
        ctx.fillStyle = `rgba(${hbR}, ${hbG}, ${hbB}, 0.4)`;
        ctx.strokeStyle = `rgba(${hbR}, ${hbG}, ${hbB}, 0.7)`;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = hbHex;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      }
    }

    // Defense entities — turrets and repair stations
    for (const def of defenses) {
      if (!def.active) continue;
      const ddx = def.x - player.x;
      const ddy = def.y - player.y;
      if (ddx * ddx + ddy * ddy > viewRadiusSq) continue;
      const dsx = cx + ddx;
      const dsy = cy + ddy;

      if (def.type === 'turret') {
        // Cyan square (6x6) with aim-direction line
        ctx.fillStyle = '#00ddff';
        ctx.fillRect(dsx - 3, dsy - 3, 6, 6);
        // Aim direction line (8px long)
        ctx.beginPath();
        ctx.moveTo(dsx, dsy);
        ctx.lineTo(dsx + Math.cos(def.aimDirection) * 8, dsy + Math.sin(def.aimDirection) * 8);
        ctx.strokeStyle = '#00ddff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        // Repair station: green cross/plus with pulsing glow
        const pulseAlpha = 0.5 + Math.sin(player.survivalTime * 3) * 0.3;
        ctx.globalAlpha = pulseAlpha;
        ctx.fillStyle = '#00ff41';
        // Horizontal bar of cross
        ctx.fillRect(dsx - 6, dsy - 1.5, 12, 3);
        // Vertical bar of cross
        ctx.fillRect(dsx - 1.5, dsy - 6, 3, 12);
        ctx.globalAlpha = 1;
      }
    }

    // Dropoff zones — pulsing ring markers
    for (const entity of world.entities) {
      if (!entity.active || entity.type !== 'dropoff') continue;
      const dropoff = entity as Dropoff;
      const ddx = dropoff.x - player.x;
      const ddy = dropoff.y - player.y;
      if (ddx * ddx + ddy * ddy > viewRadiusSq) continue;
      const dsx = cx + (dropoff.x - player.x);
      const dsy = cy + (dropoff.y - player.y);
      const pulse = 1 + Math.sin(player.survivalTime * 2) * 0.08;

      const dropoffColor = theme.entities.dropoff;
      ctx.save();
      // Outer ring
      ctx.beginPath();
      ctx.arc(dsx, dsy, dropoff.radius * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = dropoffColor;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 2;
      ctx.shadowColor = dropoffColor;
      ctx.shadowBlur = 8;
      ctx.stroke();

      // Inner glow fill
      ctx.globalAlpha = 0.04;
      ctx.beginPath();
      ctx.arc(dsx, dsy, dropoff.radius * pulse, 0, Math.PI * 2);
      ctx.fillStyle = dropoffColor;
      ctx.fill();

      // Center diamond marker
      ctx.globalAlpha = 0.6;
      ctx.translate(dsx, dsy);
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.rect(-5, -5, 10, 10);
      ctx.strokeStyle = dropoffColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // Tow ropes and towed salvage blips (hub-and-spoke: all anchored to player)
    const towedItems = towRopeSystem.getTowedItems();
    if (towedItems.length > 0) {
      ctx.save();
      for (const item of towedItems) {
        const sal = item.salvage;
        const itemSX = cx + (sal.x - player.x);
        const itemSY = cy + (sal.y - player.y);

        // Fade-out alpha
        const alpha = item.fadeOut !== null ? Math.max(0, item.fadeOut / 0.3) : 1;
        ctx.globalAlpha = alpha;

        // Bezier rope: control point offset perpendicular to line by velocity delta
        const midX = (cx + itemSX) / 2;
        const midY = (cy + itemSY) / 2;
        const dvx = player.vx - item.vx;
        const dvy = player.vy - item.vy;
        const cpX = midX + (-dvy) * 0.3;
        const cpY = midY + dvx * 0.3;

        // Draw rope
        const salvageColor = theme.entities.salvage;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(cpX, cpY, itemSX, itemSY);
        ctx.strokeStyle = salvageColor;
        ctx.globalAlpha = 0.5 * alpha;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = salvageColor;
        ctx.shadowBlur = 4;
        ctx.stroke();

        // Draw towed salvage blip (diamond shape)
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(itemSX, itemSY);
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.rect(-4.5, -4.5, 9, 9);
        ctx.fillStyle = salvageColor;
        ctx.shadowColor = salvageColor;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Entity blips (positions are rotated by the canvas transform)
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
      worldRot
    );
    sweepEffects.render(ctx, cx, cy);

    // Ability visual effects
    abilityEffects.render(ctx, cx, cy, player.x, player.y, player.survivalTime);

    // Render projectiles
    for (const p of combatSystem.projectiles) {
      const prx = p.x - player.x;
      const pry = p.y - player.y;
      if (prx * prx + pry * pry > viewRadiusSq) continue;
      const px = cx + prx;
      const py = cy + pry;
      ctx.save();
      ctx.shadowColor = theme.effects.projectileGlow;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fillStyle = theme.effects.projectile;
      ctx.fill();
      ctx.restore();
    }

    // Render drones
    for (const drone of abilitySystem.drones) {
      const drx = drone.x - player.x;
      const dry = drone.y - player.y;
      if (drx * drx + dry * dry > viewRadiusSq) continue;
      const droneX = cx + drx;
      const droneY = cy + dry;
      ctx.save();
      ctx.shadowColor = theme.effects.drone;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(droneX, droneY, 4, 0, Math.PI * 2);
      ctx.fillStyle = theme.effects.drone;
      ctx.fill();
      ctx.restore();
    }

    // Render missiles
    for (const missile of abilitySystem.missiles) {
      const mrx = missile.x - player.x;
      const mry = missile.y - player.y;
      if (mrx * mrx + mry * mry > viewRadiusSq) continue;
      const mx = cx + mrx;
      const my = cy + mry;
      ctx.save();
      ctx.shadowColor = theme.effects.missile;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(mx, my, 3, 0, Math.PI * 2);
      ctx.fillStyle = theme.effects.missile;
      ctx.fill();
      ctx.restore();
    }

    // Floating text (counter-rotated so text stays upright)
    const worldRotation = -player.heading - Math.PI / 2;
    floatingText.render(ctx, player.x, player.y, cx, cy, worldRotation);

    // Foreground particles (on top of entities — closer to camera)
    ambientParticles.renderForeground(ctx, cx, cy, viewRadius, player.x, player.y);

    ctx.restore();

    // Subtle darkening outside the ping range ring
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.arc(cx, cy, radar.getRadius(), 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fill();
    ctx.restore();

    // Player heading indicator (fixed to screen, always points up)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = theme.radar.primary;
    ctx.shadowColor = theme.radar.primary;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(-5, 5);
    ctx.lineTo(5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

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
    hud.render(ctx, player, canvas.width, canvas.height, runTimer, homeBase);

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
    minimap.render(ctx, player, world.entities, canvas.width, canvas.height, homeBase);

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

    // Upgrade panel — only if upgrades enabled
    if (currentLevelConfig?.features.upgrades !== false) {
      upgradePanel.render(ctx, upgradeSystem, player, canvas.width, canvas.height);
    }

    // Game over overlay
    gameOverScreen.render(ctx, canvas.width, canvas.height);

    // Results screen overlay (win or lose from run mode)
    resultsScreen.render(ctx, canvas.width, canvas.height);

    // Level complete overlay
    levelCompleteScreen.render(ctx, canvas.width, canvas.height);

    // Key remap screen (on top of everything)
    keyRemapScreen.render(ctx, abilitySystem.abilities, canvas.width, canvas.height);

    // Pause menu (on top of everything except shader)
    pauseMenu.render(ctx, canvas.width, canvas.height);

    // Post-processing shader pass (reads the completed 2D canvas as a texture)
    if (shaderPipeline) {
      shaderPipeline.render(performance.now() / 1000);
    }
  },
});

loop.start();
