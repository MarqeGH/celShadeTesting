/**
 * A reusable cooldown timer that tracks elapsed time against a duration.
 * Call start() to begin, update(dt) each frame, and check isReady() to see
 * if the cooldown has elapsed.
 */
export class CooldownTimer {
  private duration = 0;
  private elapsed = 0;
  private running = false;

  /** Start (or restart) the cooldown for the given duration in seconds. */
  start(duration: number): void {
    this.duration = duration;
    this.elapsed = 0;
    this.running = true;
  }

  /** Advance the timer by dt seconds. */
  update(dt: number): void {
    if (!this.running) return;
    this.elapsed += dt;
    if (this.elapsed >= this.duration) {
      this.running = false;
    }
  }

  /** Returns true when the cooldown has finished (or was never started). */
  isReady(): boolean {
    return !this.running;
  }

  /** Reset the timer to its initial idle state. */
  reset(): void {
    this.duration = 0;
    this.elapsed = 0;
    this.running = false;
  }

  /** Fraction of cooldown elapsed (0–1). Useful for progress bars. */
  get progress(): number {
    if (this.duration <= 0) return 1;
    return Math.min(this.elapsed / this.duration, 1);
  }

  /** Seconds remaining until ready. */
  get remaining(): number {
    if (!this.running) return 0;
    return Math.max(this.duration - this.elapsed, 0);
  }
}
