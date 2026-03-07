import { StateMachine } from '../ai/StateMachine';
import { AIState } from '../ai/AIState';
import { InputManager } from '../app/InputManager';
import { PlayerController } from './PlayerController';
import { PlayerStats } from './PlayerStats';
import { CameraController } from '../camera/CameraController';
import { PlayerModel } from './PlayerModel';

// ── Context shared by all player states ─────────────────────────

export interface PlayerContext {
  input: InputManager;
  controller: PlayerController;
  stats: PlayerStats;
  model: PlayerModel;
  camera: CameraController;
}

// ── Helper: check for any movement input ────────────────────────

function hasMovementInput(input: InputManager): boolean {
  return (
    input.isPressed('moveForward') ||
    input.isPressed('moveBack') ||
    input.isPressed('moveLeft') ||
    input.isPressed('moveRight')
  );
}

// ── Helper: check action transitions common to idle/run ─────────

function checkActionTransitions(input: InputManager, stats: PlayerStats): string | null {
  if (input.justPressed('dodge') && stats.canPerformAction('dodge')) {
    stats.drainStamina('dodge');
    return 'dodge';
  }
  if (input.justPressed('lightAttack') && stats.canPerformAction('light_attack')) {
    stats.drainStamina('light_attack');
    return 'light_attack';
  }
  if (input.justPressed('heavyAttack') && stats.canPerformAction('heavy_attack')) {
    stats.drainStamina('heavy_attack');
    return 'heavy_attack';
  }
  if (input.justPressed('heal') && stats.canHeal()) {
    stats.heal();
    return 'heal';
  }
  return null;
}

// ── Idle State ──────────────────────────────────────────────────

class IdleState implements AIState<PlayerContext> {
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

// ── Run State ───────────────────────────────────────────────────

class RunState implements AIState<PlayerContext> {
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

// ── Timed stub state (placeholder for future implementation) ────

class TimedStubState implements AIState<PlayerContext> {
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

// ── Dead State (terminal — no exit) ─────────────────────────────

class DeadState implements AIState<PlayerContext> {
  readonly name = 'dead';
  enter(_ctx: PlayerContext): void {}
  update(_dt: number, _ctx: PlayerContext): string | null {
    return null;
  }
  exit(_ctx: PlayerContext): void {}
}

// ── PlayerStateMachine (facade) ─────────────────────────────────

export class PlayerStateMachine {
  readonly fsm: StateMachine<PlayerContext>;

  constructor(
    input: InputManager,
    controller: PlayerController,
    stats: PlayerStats,
    model: PlayerModel,
    camera: CameraController,
  ) {
    const context: PlayerContext = { input, controller, stats, model, camera };
    this.fsm = new StateMachine<PlayerContext>(context);

    // Register all player states
    this.fsm
      .addState(new IdleState())
      .addState(new RunState())
      .addState(new TimedStubState('dodge', 0.3))
      .addState(new TimedStubState('light_attack', 0.45))
      .addState(new TimedStubState('heavy_attack', 0.6))
      .addState(new TimedStubState('stagger', 0.5))
      .addState(new TimedStubState('heal', 0.8))
      .addState(new DeadState());

    // Initial state
    this.fsm.setState('idle');
  }

  update(dt: number): void {
    this.fsm.update(dt);
  }

  getCurrentState(): string | null {
    return this.fsm.getCurrentStateName();
  }
}
