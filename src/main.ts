import { createCanvas } from './canvas';
import { GameLoop } from './engine/GameLoop';
import { RadarDisplay } from './radar/RadarDisplay';

const canvas = createCanvas('game-canvas');
const ctx = canvas.getContext('2d')!;

const radar = new RadarDisplay();
const loop = new GameLoop({
  update(dt) {
    radar.update(dt);
  },
  render() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    radar.render(ctx, canvas.width / 2, canvas.height / 2);
  },
});

loop.start();
