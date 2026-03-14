const FIXED_TIMESTEP = 1000 / 60; // ~16.67ms for 60 updates/sec
const MAX_DELTA = 250; // Cap to prevent spiral of death

export interface GameLoopCallbacks {
  update(dt: number): void;
  render(): void;
}

export class GameLoop {
  private running = false;
  private rafId: number | null = null;
  private lastTime = 0;
  private accumulator = 0;
  private callbacks: GameLoopCallbacks;

  constructor(callbacks: GameLoopCallbacks) {
    this.callbacks = callbacks;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame((t) => this.tick(t));
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  private tick(now: number): void {
    if (!this.running) return;

    let delta = now - this.lastTime;
    this.lastTime = now;

    // Cap delta to prevent spiral of death when tab is backgrounded
    if (delta > MAX_DELTA) {
      delta = MAX_DELTA;
    }

    this.accumulator += delta;

    // Fixed timestep updates
    const dt = FIXED_TIMESTEP / 1000; // Convert to seconds for game logic
    while (this.accumulator >= FIXED_TIMESTEP) {
      this.callbacks.update(dt);
      this.accumulator -= FIXED_TIMESTEP;
    }

    this.callbacks.render();

    this.rafId = requestAnimationFrame((t) => this.tick(t));
  }
}
