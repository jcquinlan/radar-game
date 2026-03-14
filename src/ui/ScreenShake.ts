export class ScreenShake {
  private intensity = 0;
  private duration = 0;
  private remaining = 0;
  offsetX = 0;
  offsetY = 0;

  trigger(intensity: number, duration: number = 0.15): void {
    this.intensity = intensity;
    this.duration = duration;
    this.remaining = duration;
  }

  update(dt: number): void {
    if (this.remaining <= 0) {
      this.offsetX = 0;
      this.offsetY = 0;
      return;
    }

    this.remaining -= dt;
    const progress = this.remaining / this.duration;
    const currentIntensity = this.intensity * progress;

    this.offsetX = (Math.random() - 0.5) * 2 * currentIntensity;
    this.offsetY = (Math.random() - 0.5) * 2 * currentIntensity;
  }
}
