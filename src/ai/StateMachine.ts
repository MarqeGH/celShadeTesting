import { AIState } from './AIState';

/**
 * Generic finite state machine.
 *
 * States are registered by name. The machine holds a current state
 * and delegates enter/update/exit lifecycle calls. State.update()
 * returns the name of the next state (or null to stay).
 *
 * No re-entry: calling setState with the current state name is a no-op.
 */
export class StateMachine<TContext = unknown> {
  private states = new Map<string, AIState<TContext>>();
  private current: AIState<TContext> | null = null;
  private context: TContext;

  constructor(context: TContext) {
    this.context = context;
  }

  addState(state: AIState<TContext>): this {
    this.states.set(state.name, state);
    return this;
  }

  setState(name: string): void {
    const next = this.states.get(name);
    if (!next) {
      console.warn(`[StateMachine] Unknown state: ${name}`);
      return;
    }
    // No re-entry
    if (this.current === next) return;

    const prev = this.current?.name ?? 'none';

    if (this.current) {
      this.current.exit(this.context);
    }

    this.current = next;
    this.current.enter(this.context);

    console.log(`[StateMachine] ${prev} → ${name}`);
  }

  update(dt: number): void {
    if (!this.current) return;

    const next = this.current.update(dt, this.context);
    if (next !== null) {
      this.setState(next);
    }
  }

  getCurrentStateName(): string | null {
    return this.current?.name ?? null;
  }
}
