/**
 * Interface for a state in a finite state machine.
 * TContext is the data available to the state during updates.
 *
 * States return the name of the next state from update(),
 * or null to remain in the current state.
 */
export interface AIState<TContext = unknown> {
  readonly name: string;
  enter(context: TContext): void;
  update(dt: number, context: TContext): string | null;
  exit(context: TContext): void;
}
