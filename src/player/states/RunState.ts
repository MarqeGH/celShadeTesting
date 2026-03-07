import { AIState } from '../../ai/AIState';
import { PlayerContext, checkActionTransitions, hasMovementInput } from './PlayerContext';

export class RunState implements AIState<PlayerContext> {
  readonly name = 'run';

  enter(_ctx: PlayerContext): void {}

  update(dt: number, ctx: PlayerContext): string | null {
    const action = checkActionTransitions(ctx.input, ctx.stats);
    if (action) return action;

    if (!hasMovementInput(ctx.input)) return 'idle';

    // Delegate actual movement to the controller
    ctx.controller.update(dt, ctx.stats);

    return null;
  }

  exit(_ctx: PlayerContext): void {}
}
