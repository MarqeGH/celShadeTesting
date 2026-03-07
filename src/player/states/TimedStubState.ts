import { AIState } from '../../ai/AIState';
import { PlayerContext } from './PlayerContext';

/** Timed stub state (placeholder for future implementation) */
export class TimedStubState implements AIState<PlayerContext> {
  readonly name: string;
  private readonly duration: number;
  private readonly returnState: string;
  private timer = 0;

  constructor(name: string, durationSeconds: number, returnState = 'idle') {
    this.name = name;
    this.duration = durationSeconds;
    this.returnState = returnState;
  }

  enter(_ctx: PlayerContext): void {
    this.timer = 0;
  }

  update(dt: number, _ctx: PlayerContext): string | null {
    this.timer += dt;
    if (this.timer >= this.duration) {
      return this.returnState;
    }
    return null;
  }

  exit(_ctx: PlayerContext): void {}
}
