/** Callback that converts canvas pixel coordinates to world coordinates */
export type CoordinateConverter = (canvasX: number, canvasY: number) => { worldX: number; worldY: number };

export interface ClickEvent {
  worldX: number;
  worldY: number;
}

export class InputSystem {
  private keys = new Set<string>();

  // Mouse state — canvas coordinates
  mouseX = 0;
  mouseY = 0;
  // Mouse state — world coordinates (updated via converter)
  mouseWorldX = 0;
  mouseWorldY = 0;
  /** Whether the mouse cursor is currently over the game canvas */
  mouseOver = false;

  private pendingClick: ClickEvent | null = null;
  private coordinateConverter: CoordinateConverter | null = null;
  private canvas: HTMLCanvasElement | null = null;

  constructor() {
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
  }

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.keys.clear();
  }

  /** Attach mouse listeners to the canvas element */
  attachMouse(canvasEl: HTMLCanvasElement): void {
    this.canvas = canvasEl;
    canvasEl.addEventListener('mousemove', this.onMouseMove);
    canvasEl.addEventListener('mousedown', this.onMouseDown);
    canvasEl.addEventListener('mouseleave', this.onMouseLeave);
  }

  /** Remove mouse listeners from the canvas element */
  detachMouse(canvasEl: HTMLCanvasElement): void {
    canvasEl.removeEventListener('mousemove', this.onMouseMove);
    canvasEl.removeEventListener('mousedown', this.onMouseDown);
    canvasEl.removeEventListener('mouseleave', this.onMouseLeave);
    this.canvas = null;
    this.mouseOver = false;
    this.pendingClick = null;
  }

  /** Set the callback used to convert canvas coords to world coords */
  setCoordinateConverter(converter: CoordinateConverter): void {
    this.coordinateConverter = converter;
  }

  /**
   * Consume the pending click event. Returns the click data once,
   * then returns null until the next click occurs.
   */
  consumeClick(): ClickEvent | null {
    const click = this.pendingClick;
    this.pendingClick = null;
    return click;
  }

  isDown(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  getMovementVector(): { dx: number; dy: number } {
    let dx = 0;
    let dy = 0;

    if (this.isDown('w') || this.isDown('arrowup')) dy -= 1;
    if (this.isDown('s') || this.isDown('arrowdown')) dy += 1;
    if (this.isDown('a') || this.isDown('arrowleft')) dx -= 1;
    if (this.isDown('d') || this.isDown('arrowright')) dx += 1;

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
    }

    return { dx, dy };
  }

  /** Tank controls: returns turn (-1 left, +1 right) and thrust (-1 back, +1 forward) */
  getTankInput(): { turn: number; thrust: number } {
    let turn = 0;
    let thrust = 0;

    if (this.isDown('a') || this.isDown('arrowleft')) turn -= 1;
    if (this.isDown('d') || this.isDown('arrowright')) turn += 1;
    if (this.isDown('w') || this.isDown('arrowup')) thrust += 1;
    if (this.isDown('s') || this.isDown('arrowdown')) thrust -= 1;

    return { turn, thrust };
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.keys.add(e.key.toLowerCase());
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.key.toLowerCase());
  }

  private updateWorldCoords(canvasX: number, canvasY: number): void {
    if (this.coordinateConverter) {
      const world = this.coordinateConverter(canvasX, canvasY);
      this.mouseWorldX = world.worldX;
      this.mouseWorldY = world.worldY;
    }
  }

  private getCanvasCoords(e: MouseEvent): { x: number; y: number } {
    if (this.canvas) {
      const rect = this.canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    return { x: e.offsetX, y: e.offsetY };
  }

  private onMouseMove(e: MouseEvent): void {
    const { x, y } = this.getCanvasCoords(e);
    this.mouseX = x;
    this.mouseY = y;
    this.mouseOver = true;
    this.updateWorldCoords(x, y);
  }

  private onMouseDown(e: MouseEvent): void {
    const { x, y } = this.getCanvasCoords(e);
    this.mouseX = x;
    this.mouseY = y;
    this.updateWorldCoords(x, y);
    this.pendingClick = { worldX: this.mouseWorldX, worldY: this.mouseWorldY };
  }

  private onMouseLeave(): void {
    this.mouseOver = false;
  }
}
