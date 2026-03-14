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
import { Ally, Enemy, Resource, Dropoff } from './entities/Entity';
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
import { ShaderPipeline } from './rendering/ShaderPipeline';
import { CRTEffect } from './rendering/effects/CRTEffect';

const canvas = createCanvas('game-canvas');
const ctx = canvas.getContext('2d')!;

// Shader pipeline and pause menu (persist across game restarts)
const shaderPipeline = ShaderPipeline.create(canvas);
if (shaderPipeline) {
  shaderPipeline.addEffect(new CRTEffect());
}
const pauseMenu = new PauseMenu();
let paused = false;

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
let resolutionLevel: number;
let gameOver: boolean;
let prevHealth: number;
let damageFlash: number;

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
  resolutionLevel = 0;
  gameOver = false;
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
  keyRemapScreen = new KeyRemapScreen();
  keyRemapScreen.addExtraBinding({
    id: 'upgrades',
    name: 'Upgrades',
    description: 'Open the upgrades panel',
    key: 'e',
  });
  keyRemapScreen.load(abilitySystem.abilities);

  // Disable Canvas 2D scanlines when shader pipeline is active
  radar.scanlineEnabled = !shaderPipeline || !shaderPipeline.enabled;

  input.attach();
  keyRemapScreen.attach(canvas, abilitySystem.abilities);
  upgradePanel.attach(canvas, upgradeSystem, player);
  world.updateSpawning(player.x, player.y);
}

function togglePause() {
  if (paused) {
    paused = false;
    pauseMenu.close(canvas);
  } else {
    paused = true;
    // Close other panels when pausing
    if (keyRemapScreen && keyRemapScreen.isVisible()) keyRemapScreen.toggle();
    pauseMenu.open(canvas, {
      onResume: () => togglePause(),
      onRestart: () => {
        paused = false;
        pauseMenu.close(canvas);
        input.detach();
        upgradePanel.detach(canvas);
        keyRemapScreen.detach(canvas);
        init();
      },
      onToggleShaders: () => {
        if (shaderPipeline) {
          shaderPipeline.setEnabled(!shaderPipeline.enabled);
          radar.scanlineEnabled = !shaderPipeline.enabled;
        }
      },
      onOpenKeybinds: () => {
        paused = false;
        pauseMenu.close(canvas);
        keyRemapScreen.toggle();
      },
      isShaderEnabled: () => shaderPipeline ? shaderPipeline.enabled : false,
    });
  }
}

// Toggle panels (registered once, outside init)
window.addEventListener('keydown', (e) => {
  // Key remap screen captures keys when listening — skip other handlers
  if (keyRemapScreen && keyRemapScreen.isListening()) return;

  // Escape toggles pause menu
  if (e.key === 'Escape') {
    if (gameOver) return;
    togglePause();
    return;
  }

  // Don't process other keys while paused
  if (paused) return;

  const upgradesBinding = keyRemapScreen.getExtraBinding('upgrades');
  const upgradesKey = upgradesBinding ? upgradesBinding.key : 'e';
  if ((e.key === upgradesKey || e.key === upgradesKey.toUpperCase()) && !gameOver && !keyRemapScreen.isVisible()) {
    upgradePanel.toggle();
  }
  if ((e.key === 'k' || e.key === 'K') && !gameOver) {
    keyRemapScreen.toggle();
  }

  // Ability keybinds (dynamic from ability.keybind)
  if (gameOver || keyRemapScreen.isVisible()) return;

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
          floatingText.add('REGEN!', player.x, player.y - 25, '#00ff41');
        }
      } else if (ability.id === 'helper_drone') {
        if (abilitySystem.activate('helper_drone', world.entities, addText)) {
          abilityEffects.triggerDroneSpawn(player.x, player.y);
          floatingText.add('DRONE!', player.x, player.y - 25, '#00ffff');
        }
      } else if (ability.id === 'dash') {
        if (abilitySystem.activate('dash', world.entities, addText)) {
          floatingText.add('DASH!', player.x, player.y - 25, '#ffff00');
          screenShake.trigger(2);
        }
      } else if (ability.id === 'homing_missile') {
        if (abilitySystem.activate('homing_missile', world.entities, addText)) {
          abilityEffects.triggerMissileLaunch(player.x, player.y);
          floatingText.add('MISSILE!', player.x, player.y - 25, '#ff8800');
          screenShake.trigger(3);
        }
      }
      break;
    }
  }
});

init();

const loop = new GameLoop({
  update(dt) {
    if (gameOver || paused) return;

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
    for (const event of events) {
      if (event.type === 'collect') {
        player.totalEnergyCollected += event.value;
        player.score += event.value;
        floatingText.add(`+${event.value}E`, event.entity.x, event.entity.y, '#00ff41');
      }
      if (event.type === 'damage') {
        floatingText.add(`-${event.value}`, event.entity.x, event.entity.y, '#ff4141');
        if (!event.entity.active) {
          player.kills++;
          player.score += 50;
          floatingText.add('+50', event.entity.x, event.entity.y - 15, '#ffaa00');
        }
      }
      if (event.type === 'heal') {
        floatingText.add(`+${event.value}HP`, player.x, player.y - 20, '#4488ff');
      }
      if (event.type === 'shield') {
        floatingText.add('SHIELD!', player.x, player.y - 20, '#00ffff');
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
          floatingText.add(`+${resource.energyValue}E`, resource.x, resource.y, '#00ff41');
          resource.active = false;
        }
      }
    }

    // Salvage proximity pickup — player must fly close to attach
    const pickedUp = towRopeSystem.checkPickups(world.entities, player);
    for (const salvage of pickedUp) {
      floatingText.add('SALVAGE!', salvage.x, salvage.y, '#ffaa00');
    }

    // Update tow rope physics
    towRopeSystem.update(player, dt);

    // Check if towed salvage entered a dropoff zone
    const deposited = towRopeSystem.checkDropoffs(world.entities);
    for (const { salvage, dropoff } of deposited) {
      player.addEnergy(dropoff.rewardPerItem);
      player.score += dropoff.rewardPerItem;
      floatingText.add(`+${dropoff.rewardPerItem}E`, salvage.x, salvage.y, '#ffdd00');
      screenShake.trigger(2);
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

    // Abilities
    const addText = (text: string, x: number, y: number, color: string) =>
      floatingText.add(text, x, y, color);
    abilitySystem.update(dt, world.entities, addText);

    // Ability visual effects
    const hotAbility = abilitySystem.getAbility('heal_over_time');
    if (hotAbility) {
      abilityEffects.setRegenActive(hotAbility.active, hotAbility.durationRemaining);
    }
    abilityEffects.update(dt);

    // Combat
    const alive = combatSystem.update(world.entities, player, dt);

    // Motion trails — track fast-moving entities
    motionTrail.track('player', player.x, player.y, player.vx, player.vy, '#00ff41', dt);
    const activeTrailIds = new Set(['player']);
    for (let i = 0; i < world.entities.length; i++) {
      const entity = world.entities[i];
      if (!entity.active || entity.type !== 'enemy') continue;
      const enemy = entity as Enemy;
      const eid = `e${i}`;
      motionTrail.track(eid, enemy.x, enemy.y, enemy.vx, enemy.vy, '#ff4141', dt);
      activeTrailIds.add(eid);
    }
    for (let i = 0; i < combatSystem.projectiles.length; i++) {
      const p = combatSystem.projectiles[i];
      if (!p.active) continue;
      const pid = `p${i}`;
      motionTrail.track(pid, p.x, p.y, p.vx, p.vy, '#ff6641', dt);
      activeTrailIds.add(pid);
    }
    for (let i = 0; i < abilitySystem.drones.length; i++) {
      const drone = abilitySystem.drones[i];
      const did = `d${i}`;
      motionTrail.track(did, drone.x, drone.y, drone.vx, drone.vy, '#00ffff', dt);
      activeTrailIds.add(did);
    }
    const missiles = (abilitySystem as any).missiles as Array<{x: number; y: number; vx: number; vy: number}> | undefined;
    if (missiles) {
      for (let i = 0; i < missiles.length; i++) {
        const missile = missiles[i];
        const mid = `m${i}`;
        motionTrail.track(mid, missile.x, missile.y, missile.vx, missile.vy, '#ff8800', dt);
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

    if (!alive) {
      gameOver = true;
      towRopeSystem.clear();
      gameOverScreen.show(canvas, player, () => {
        input.detach();
        upgradePanel.detach(canvas);
        keyRemapScreen.detach(canvas);
        init();
      });
    }

    // Periodic cleanup
    world.cleanup(player.x, player.y);
  },
  render() {
    const cx = canvas.width / 2 + screenShake.offsetX;
    const cy = canvas.height / 2 + screenShake.offsetY;

    ctx.fillStyle = '#0a0a0a';
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

    ambientParticles.renderDeep(ctx, cx, cy, viewRadius, player.x, player.y);

    // Motion trails (rendered behind blips)
    motionTrail.render(ctx, player.x, player.y, cx, cy);

    // Dropoff zones — pulsing ring markers
    for (const entity of world.entities) {
      if (!entity.active || entity.type !== 'dropoff') continue;
      const dropoff = entity as Dropoff;
      const dsx = cx + (dropoff.x - player.x);
      const dsy = cy + (dropoff.y - player.y);
      const pulse = 1 + Math.sin(player.survivalTime * 2) * 0.08;

      ctx.save();
      // Outer ring
      ctx.beginPath();
      ctx.arc(dsx, dsy, dropoff.radius * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 221, 0, 0.3)';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ffdd00';
      ctx.shadowBlur = 8;
      ctx.stroke();

      // Inner glow fill
      ctx.beginPath();
      ctx.arc(dsx, dsy, dropoff.radius * pulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 221, 0, 0.04)';
      ctx.fill();

      // Center diamond marker
      ctx.translate(dsx, dsy);
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.rect(-5, -5, 10, 10);
      ctx.strokeStyle = 'rgba(255, 221, 0, 0.6)';
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

        // Draw rope (amber)
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(cpX, cpY, itemSX, itemSY);
        ctx.strokeStyle = `rgba(255, 170, 0, ${0.5 * alpha})`;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 4;
        ctx.stroke();

        // Draw towed salvage blip (diamond shape, amber/gold)
        ctx.save();
        ctx.translate(itemSX, itemSY);
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.rect(-4.5, -4.5, 9, 9);
        ctx.fillStyle = `rgba(255, 170, 0, ${alpha})`;
        ctx.shadowColor = '#ffaa00';
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
      const px = cx + (p.x - player.x);
      const py = cy + (p.y - player.y);
      ctx.save();
      ctx.shadowColor = '#ff4141';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ff6641';
      ctx.fill();
      ctx.restore();
    }

    // Render drones
    for (const drone of abilitySystem.drones) {
      const droneX = cx + (drone.x - player.x);
      const droneY = cy + (drone.y - player.y);
      ctx.save();
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(droneX, droneY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#00ffff';
      ctx.fill();
      ctx.restore();
    }

    // Render missiles
    const renderMissiles = (abilitySystem as any).missiles as Array<{x: number; y: number}> | undefined;
    for (const missile of renderMissiles ?? []) {
      const mx = cx + (missile.x - player.x);
      const my = cy + (missile.y - player.y);
      ctx.save();
      ctx.shadowColor = '#ff8800';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(mx, my, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ff8800';
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
    ctx.fillStyle = '#00ff41';
    ctx.shadowColor = '#00ff41';
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
      gradient.addColorStop(0, 'rgba(255, 0, 0, 0)');
      gradient.addColorStop(1, `rgba(255, 0, 0, ${damageFlash})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Red border glow at screen edges
      const edgeGradient = ctx.createRadialGradient(cx, cy, vignetteRadius * 0.7, cx, cy, vignetteRadius);
      edgeGradient.addColorStop(0, 'rgba(255, 65, 65, 0)');
      edgeGradient.addColorStop(1, `rgba(255, 65, 65, ${damageFlash * 1.5})`);
      ctx.fillStyle = edgeGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    // HUD
    hud.render(ctx, player, canvas.width, canvas.height);

    // Ability bar (bottom center)
    abilityBar.render(ctx, abilitySystem.abilities, canvas.width, canvas.height);

    // Upgrade panel
    upgradePanel.render(ctx, upgradeSystem, player, canvas.width, canvas.height);

    // Game over overlay
    gameOverScreen.render(ctx, canvas.width, canvas.height);

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
