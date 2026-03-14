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
import { Ally, Resource } from './entities/Entity';
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

const canvas = createCanvas('game-canvas');
const ctx = canvas.getContext('2d')!;

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
  keyRemapScreen = new KeyRemapScreen();
  keyRemapScreen.addExtraBinding({
    id: 'upgrades',
    name: 'Upgrades',
    description: 'Open the upgrades panel',
    key: 'e',
  });
  keyRemapScreen.load(abilitySystem.abilities);

  input.attach();
  keyRemapScreen.attach(canvas, abilitySystem.abilities);
  upgradePanel.attach(canvas, upgradeSystem, player);
  world.updateSpawning(player.x, player.y);
}

// Toggle panels (registered once, outside init)
window.addEventListener('keydown', (e) => {
  // Key remap screen captures keys when listening — skip other handlers
  if (keyRemapScreen && keyRemapScreen.isListening()) return;

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
      }
      break;
    }
  }
});

init();

const loop = new GameLoop({
  update(dt) {
    if (gameOver) return;

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

    // Radar + blip updates
    blipRenderer.update(dt);
    ambientParticles.update(dt);

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
        const mdx = entity.x - player.x;
        const mdy = entity.y - player.y;
        if (mdx * mdx + mdy * mdy < player.magnetRange * player.magnetRange) {
          const resource = entity as Resource;
          player.addEnergy(resource.energyValue);
          player.totalEnergyCollected += resource.energyValue;
          player.score += resource.energyValue;
          floatingText.add(`+${resource.energyValue}E`, resource.x, resource.y, '#00ff41');
          resource.active = false;
        }
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

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Radar (drawn without rotation — rings/crosshair are fixed)
    radar.render(ctx, cx, cy);

    // Rotated world layer — everything inside the radar rotates with player heading
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radar.getRadius(), 0, Math.PI * 2);
    ctx.clip();

    // Rotate world around center by negative heading (world rotates opposite to player turn)
    ctx.translate(cx, cy);
    ctx.rotate(-player.heading - Math.PI / 2); // Offset so heading=0 (up) maps to screen-up
    ctx.translate(-cx, -cy);

    ambientParticles.render(ctx, cx, cy, radar.getRadius());

    // Entity blips (positions are rotated by the canvas transform)
    blipRenderer.renderBlips(
      ctx,
      world.entities,
      player.x,
      player.y,
      cx,
      cy,
      radar.getRadius(),
      resolutionLevel
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

    // Floating text
    floatingText.render(ctx, player.x, player.y, cx, cy);

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
      const gradient = ctx.createRadialGradient(cx, cy, radar.getRadius() * 0.5, cx, cy, radar.getRadius());
      gradient.addColorStop(0, 'rgba(255, 0, 0, 0)');
      gradient.addColorStop(1, `rgba(255, 0, 0, ${damageFlash})`);
      ctx.beginPath();
      ctx.arc(cx, cy, radar.getRadius(), 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Red border flash
      ctx.beginPath();
      ctx.arc(cx, cy, radar.getRadius(), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 65, 65, ${damageFlash * 1.5})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    // HUD
    hud.render(ctx, player, canvas.width);

    // Ability bar (bottom center)
    abilityBar.render(ctx, abilitySystem.abilities, canvas.width, canvas.height);

    // Upgrade panel
    upgradePanel.render(ctx, upgradeSystem, player, canvas.width, canvas.height);

    // Game over overlay
    gameOverScreen.render(ctx, canvas.width, canvas.height);

    // Key remap screen (on top of everything)
    keyRemapScreen.render(ctx, abilitySystem.abilities, canvas.width, canvas.height);
  },
});

loop.start();
