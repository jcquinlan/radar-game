export function createCanvas(elementId: string): HTMLCanvasElement {
  const canvas = document.getElementById(elementId) as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error(`Canvas element with id "${elementId}" not found`);
  }

  function resize() {
    canvas!.width = window.innerWidth;
    canvas!.height = window.innerHeight;
  }

  resize();
  window.addEventListener('resize', resize);

  return canvas;
}
