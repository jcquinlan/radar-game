export class InputSystem {
  private keys = new Set<string>();

  constructor() {
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
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

  private onKeyDown(e: KeyboardEvent): void {
    this.keys.add(e.key.toLowerCase());
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.key.toLowerCase());
  }
}
