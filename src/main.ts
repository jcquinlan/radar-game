import { createCanvas } from './canvas';

const canvas = createCanvas('game-canvas');
const ctx = canvas.getContext('2d')!;

function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

render();
