import { createCanvas } from './canvas';
import { GameLoop } from './engine/GameLoop';
import { RadarDisplay } from './radar/RadarDisplay';
import { BlipRenderer } from './radar/BlipRenderer';
import { Player } from './entities/Player';
import { InputSystem } from './systems/InputSystem';
import { World } from './world/World';
import { HUD } from './ui/HUD';

const canvas = createCanvas('game-canvas');
const ctx = canvas.getContext('2d')!;

const radar = new RadarDisplay();
const blipRenderer = new BlipRenderer();
const player = new Player();
const input = new InputSystem();
const world = new World();
const hud = new HUD();

input.attach();

// Initial entity spawning
world.updateSpawning(player.x, player.y);

let resolutionLevel = 0;

const loop = new GameLoop({
  update(dt) {
    // Player movement
    const { dx, dy } = input.getMovementVector();
    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;

    // Spawn entities in new areas
    world.updateSpawning(player.x, player.y);

    // Radar sweep
    radar.update(dt);
    blipRenderer.update(dt);
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
    ctx.restore();

    // HUD
    hud.render(ctx, player, canvas.width);
  },
});

loop.start();
