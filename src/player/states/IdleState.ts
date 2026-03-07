import { AIState } from '../../ai/AIState';
import { PlayerContext, checkActionTransitions, hasMovementInput } from './PlayerContext';

export class IdleState implements AIState<PlayerContext> {
  readonly name = 'idle';

  enter(_ctx: PlayerContext): void {}

  update(_dt: number, ctx: PlayerContext): string | null {
    const action = checkActionTransitions(ctx.input, ctx.stats);
    if (action) return action;

    if (hasMovementInput(ctx.input)) return 'run';

    return null;
  }

  exit(_ctx: PlayerContext): void {}
}
