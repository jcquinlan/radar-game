export function createCanvas(elementId: string): HTMLCanvasElement {
  const canvas = document.getElementById(elementId) as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error(`Canvas element with id "${elementId}" not found`);
  }

  // Position the 2D canvas for z-index layering:
  // 3D canvas (z-index 0, behind) -> 2D canvas (z-index 1, middle) -> ShaderPipeline (z-index 2, top)
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.zIndex = '1';

  function resize() {
    canvas!.width = window.innerWidth;
    canvas!.height = window.innerHeight;
  }

  resize();
  window.addEventListener('resize', resize);

  return canvas;
}
