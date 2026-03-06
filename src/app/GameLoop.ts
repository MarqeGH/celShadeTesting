import { Clock } from '../engine/Clock';

export interface GameLoopCallbacks {
  /** Called at fixed 60Hz rate with fixedStep deltaTime */
  update(dt: number): void;
  /** Called every frame with interpolation alpha (0..1) */
  render(alpha: number): void;
}

export class GameLoop {
  private clock: Clock;
  private callbacks: GameLoopCallbacks;
  private accumulator: number = 0;
  private rafId: number = 0;
  private running: boolean = false;

  constructor(callbacks: GameLoopCallbacks) {
    this.clock = new Clock();
    this.callbacks = callbacks;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.reset();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private frame = (timestamp: number): void => {
    if (!this.running) return;

    const dt = this.clock.tick(timestamp);
    this.accumulator += dt;

    const fixedStep = this.clock.fixedStep;

    // Fixed-timestep updates
    while (this.accumulator >= fixedStep) {
      this.callbacks.update(fixedStep);
      this.accumulator -= fixedStep;
    }

    // Interpolation alpha for rendering between fixed steps
    const alpha = this.accumulator / fixedStep;
    this.callbacks.render(alpha);

    this.rafId = requestAnimationFrame(this.frame);
  };
}
