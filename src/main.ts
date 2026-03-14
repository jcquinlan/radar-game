import { createCanvas } from './canvas';
import { GameLoop } from './engine/GameLoop';
import { RadarDisplay } from './radar/RadarDisplay';
import { BlipRenderer } from './radar/BlipRenderer';
import { SweepEffects } from './radar/SweepEffects';
import { AmbientParticles } from './radar/AmbientParticles';
import { Player } from './entities/Player';
import { InputSystem } from './systems/InputSystem';
import { SweepSystem } from './systems/SweepSystem';
import { CombatSystem } from './systems/CombatSystem';
import { Ally, Resource } from './entities/Entity';
import { UpgradeSystem } from './systems/UpgradeSystem';
import { World } from './world/World';
import { HUD } from './ui/HUD';
import { UpgradePanel } from './ui/UpgradePanel';
import { GameOverScreen } from './ui/GameOverScreen';
import { FloatingText } from './ui/FloatingText';
import { ScreenShake } from './ui/ScreenShake';

const canvas = createCanvas('game-canvas');
const ctx = canvas.getContext('2d')!;

let radar: RadarDisplay;
let blipRenderer: BlipRenderer;
let sweepEffects: SweepEffects;
let ambientParticles: AmbientParticles;
let player: Player;
let input: InputSystem;
let sweepSystem: SweepSystem;
let combatSystem: CombatSystem;
let upgradeSystem: UpgradeSystem;
let world: World;
let hud: HUD;
let upgradePanel: UpgradePanel;
let gameOverScreen: GameOverScreen;
let floatingText: FloatingText;
let screenShake: ScreenShake;
let resolutionLevel: number;
let gameOver: boolean;
let prevHealth: number;
let lastSweepAngle: number;

function init() {
  radar = new RadarDisplay();
  blipRenderer = new BlipRenderer();
  sweepEffects = new SweepEffects();
  ambientParticles = new AmbientParticles();
  player = new Player();
  input = new InputSystem();
  sweepSystem = new SweepSystem();
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
  lastSweepAngle = 0;

  upgradeSystem = new UpgradeSystem(player, radar, (lvl) => {
    resolutionLevel = lvl;
  });

  input.attach();
  upgradePanel.attach(canvas, upgradeSystem, player);
  world.updateSpawning(player.x, player.y);
}

// Toggle upgrade panel with E key (registered once, outside init)
window.addEventListener('keydown', (e) => {
  if ((e.key === 'e' || e.key === 'E') && !gameOver) {
    upgradePanel.toggle();
  }
});

init();

const loop = new GameLoop({
  update(dt) {
    if (gameOver) return;

    // Player movement
    const { dx, dy } = input.getMovementVector();
    const oldX = player.x;
    const oldY = player.y;
    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;

    // Track stats
    const moveDx = player.x - oldX;
    const moveDy = player.y - oldY;
    player.distanceTraveled += Math.sqrt(moveDx * moveDx + moveDy * moveDy);
    player.survivalTime += dt;

    // Spawn entities in new areas
    world.updateSpawning(player.x, player.y);

    // Radar sweep
    radar.update(dt);
    blipRenderer.update(dt);
    ambientParticles.update(dt);

    // Sweep interactions
    const events = sweepSystem.update(
      radar.getSweepAngle(),
      world.entities,
      player,
      radar.getRadius(),
      dt
    );

    // Track score and floating text from sweep events
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

    // Visual effects from sweep interactions
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

    // Combat
    const alive = combatSystem.update(world.entities, player, dt);

    // Screen shake on damage
    if (player.health < prevHealth) {
      const dmgTaken = prevHealth - player.health;
      screenShake.trigger(Math.min(dmgTaken * 0.8, 12));
    }
    prevHealth = player.health;
    screenShake.update(dt);

    if (!alive) {
      gameOver = true;
      gameOverScreen.show(canvas, () => {
        input.detach();
        upgradePanel.detach(canvas);
        init();
      });
    }

    // Detect sweep rotation completion for ping flash
    const currentAngle = radar.getSweepAngle();
    if (lastSweepAngle > currentAngle + Math.PI) {
      // Full rotation completed — ping flash handled in render
    }
    lastSweepAngle = currentAngle;

    // Periodic cleanup
    world.cleanup(player.x, player.y);
  },
  render() {
    const cx = canvas.width / 2 + screenShake.offsetX;
    const cy = canvas.height / 2 + screenShake.offsetY;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Radar
    radar.render(ctx, cx, cy);

    // Ambient particles (clipped to radar)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radar.getRadius(), 0, Math.PI * 2);
    ctx.clip();
    ambientParticles.render(ctx, cx, cy, radar.getRadius());

    // Entity blips
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

    // Floating text
    floatingText.render(ctx, player.x, player.y, cx, cy);

    ctx.restore();

    // HUD
    hud.render(ctx, player, canvas.width);

    // Upgrade panel
    upgradePanel.render(ctx, upgradeSystem, player, canvas.width, canvas.height);

    // Game over overlay
    gameOverScreen.render(ctx, canvas.width, canvas.height);
  },
});

loop.start();
