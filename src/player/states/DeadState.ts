import { AIState } from '../../ai/AIState';
import { PlayerContext } from './PlayerContext';

/** Dead state (terminal — no exit) */
export class DeadState implements AIState<PlayerContext> {
  readonly name = 'dead';
  enter(_ctx: PlayerContext): void {}
  update(_dt: number, _ctx: PlayerContext): string | null {
    return null;
  }
  exit(_ctx: PlayerContext): void {}
}
