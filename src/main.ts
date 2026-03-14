import { createCanvas } from './canvas';
import { GameLoop } from './engine/GameLoop';
import { RadarDisplay } from './radar/RadarDisplay';
import { Player } from './entities/Player';
import { InputSystem } from './systems/InputSystem';
import { HUD } from './ui/HUD';

const canvas = createCanvas('game-canvas');
const ctx = canvas.getContext('2d')!;

const radar = new RadarDisplay();
const player = new Player();
const input = new InputSystem();
const hud = new HUD();

input.attach();

const loop = new GameLoop({
  update(dt) {
    // Player movement
    const { dx, dy } = input.getMovementVector();
    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;

    // Radar sweep
    radar.update(dt);
  },
  render() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Radar centered on screen (player is always at center)
    radar.render(ctx, canvas.width / 2, canvas.height / 2);

    // HUD
    hud.render(ctx, player, canvas.width);
  },
});

loop.start();
