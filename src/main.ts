import { createCanvas } from './canvas';
import { GameLoop } from './engine/GameLoop';
import { RadarDisplay } from './radar/RadarDisplay';
import { BlipRenderer } from './radar/BlipRenderer';
import { SweepEffects } from './radar/SweepEffects';
import { Player } from './entities/Player';
import { InputSystem } from './systems/InputSystem';
import { SweepSystem } from './systems/SweepSystem';
import { CombatSystem } from './systems/CombatSystem';
import { Ally } from './entities/Entity';
import { UpgradeSystem } from './systems/UpgradeSystem';
import { World } from './world/World';
import { HUD } from './ui/HUD';
import { UpgradePanel } from './ui/UpgradePanel';
import { GameOverScreen } from './ui/GameOverScreen';

const canvas = createCanvas('game-canvas');
const ctx = canvas.getContext('2d')!;

let radar: RadarDisplay;
let blipRenderer: BlipRenderer;
let sweepEffects: SweepEffects;
let player: Player;
let input: InputSystem;
let sweepSystem: SweepSystem;
let combatSystem: CombatSystem;
let upgradeSystem: UpgradeSystem;
let world: World;
let hud: HUD;
let upgradePanel: UpgradePanel;
let gameOverScreen: GameOverScreen;
let resolutionLevel: number;
let gameOver: boolean;

function init() {
  radar = new RadarDisplay();
  blipRenderer = new BlipRenderer();
  sweepEffects = new SweepEffects();
  player = new Player();
  input = new InputSystem();
  sweepSystem = new SweepSystem();
  combatSystem = new CombatSystem();
  world = new World();
  hud = new HUD();
  upgradePanel = new UpgradePanel();
  gameOverScreen = new GameOverScreen();
  resolutionLevel = 0;
  gameOver = false;

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
    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;

    // Spawn entities in new areas
    world.updateSpawning(player.x, player.y);

    // Radar sweep
    radar.update(dt);
    blipRenderer.update(dt);

    // Sweep interactions
    const events = sweepSystem.update(
      radar.getSweepAngle(),
      world.entities,
      player,
      radar.getRadius(),
      dt
    );

    // Visual effects from sweep interactions
    sweepEffects.addEvents(events, player.x, player.y);
    sweepEffects.update(dt);

    // Shield buff countdown
    player.updateShield(dt);

    // Beacon passive energy generation
    for (const entity of world.entities) {
      if (!entity.active || entity.type !== 'ally') continue;
      const ally = entity as Ally;
      if (ally.subtype !== 'beacon') continue;
      const dx = ally.x - player.x;
      const dy = ally.y - player.y;
      if (dx * dx + dy * dy < ally.beaconRange * ally.beaconRange) {
        player.addEnergy(ally.energyPerSecond * dt);
      }
    }

    // Combat
    const alive = combatSystem.update(world.entities, player, dt);
    if (!alive) {
      gameOver = true;
      gameOverScreen.show(canvas, () => {
        input.detach();
        upgradePanel.detach(canvas);
        init();
      });
    }

    // Periodic cleanup
    world.cleanup(player.x, player.y);
  },
  render() {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Radar
    radar.render(ctx, cx, cy);

    // Entity blips (clipped to radar circle)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radar.getRadius(), 0, Math.PI * 2);
    ctx.clip();
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
