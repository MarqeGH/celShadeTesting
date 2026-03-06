export class Clock {
  readonly fixedStep: number = 1 / 60; // 60Hz = ~16.67ms

  private lastTime: number = 0;
  private _deltaTime: number = 0;
  private _elapsed: number = 0;
  private started: boolean = false;

  /** Raw deltaTime since last tick (seconds), capped at 250ms to prevent spiral of death */
  get deltaTime(): number {
    return this._deltaTime;
  }

  /** Total elapsed time since clock started (seconds) */
  get elapsed(): number {
    return this._elapsed;
  }

  /** Call once per rAF. Returns capped deltaTime in seconds. */
  tick(timestamp: number): number {
    // timestamp comes from rAF in milliseconds — convert to seconds
    const timeSeconds = timestamp / 1000;

    if (!this.started) {
      this.lastTime = timeSeconds;
      this.started = true;
      this._deltaTime = 0;
      return 0;
    }

    const raw = timeSeconds - this.lastTime;
    this.lastTime = timeSeconds;

    // Cap at 250ms to avoid spiral of death after tab-away
    this._deltaTime = Math.min(raw, 0.25);
    this._elapsed += this._deltaTime;

    return this._deltaTime;
  }

  reset(): void {
    this.lastTime = 0;
    this._deltaTime = 0;
    this._elapsed = 0;
    this.started = false;
  }
}
