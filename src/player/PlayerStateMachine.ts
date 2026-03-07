import * as THREE from 'three';
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

// ── Dodge State ─────────────────────────────────────────────────

/** Dodge distance in meters */
const DODGE_DISTANCE = 4;
/** Dodge movement phase duration in seconds */
const DODGE_DURATION = 0.3;
/** Recovery phase after dodge (no actions allowed) */
const DODGE_RECOVERY = 0.1;
/** I-frame window start (seconds after dodge begins) */
const IFRAME_START = 0.05;
/** I-frame window end (seconds after dodge begins) */
const IFRAME_END = 0.25;
/** Opacity during i-frames */
const IFRAME_OPACITY = 0.35;

class DodgeState implements AIState<PlayerContext> {
  readonly name = 'dodge';

  private timer = 0;
  private readonly dodgeDir = new THREE.Vector3();
  private readonly _forward = new THREE.Vector3();
  private readonly _right = new THREE.Vector3();
  private _invulnerable = false;

  get isInvulnerable(): boolean { return this._invulnerable; }

  enter(ctx: PlayerContext): void {
    this.timer = 0;
    this._invulnerable = false;

    // Determine dodge direction from current WASD input
    const input = ctx.input;
    let inputX = 0;
    let inputZ = 0;

    if (input.isPressed('moveForward')) inputZ += 1;
    if (input.isPressed('moveBack'))    inputZ -= 1;
    if (input.isPressed('moveLeft'))    inputX -= 1;
    if (input.isPressed('moveRight'))   inputX += 1;

    ctx.camera.getForward(this._forward);
    ctx.camera.getRight(this._right);

    if (inputX !== 0 || inputZ !== 0) {
      // Dodge in camera-relative input direction
      this.dodgeDir
        .set(0, 0, 0)
        .addScaledVector(this._forward, inputZ)
        .addScaledVector(this._right, inputX);
      this.dodgeDir.y = 0;
      this.dodgeDir.normalize();
    } else {
      // No directional input → dodge backward (opposite player facing)
      const meshY = ctx.model.mesh.rotation.y;
      this.dodgeDir.set(-Math.sin(meshY), 0, -Math.cos(meshY));
    }
  }

  update(dt: number, ctx: PlayerContext): string | null {
    this.timer += dt;

    const totalDuration = DODGE_DURATION + DODGE_RECOVERY;

    // Done → return to idle
    if (this.timer >= totalDuration) {
      return 'idle';
    }

    // Movement phase: translate player along dodge direction
    if (this.timer < DODGE_DURATION) {
      const speed = DODGE_DISTANCE / DODGE_DURATION;
      ctx.model.mesh.position.addScaledVector(this.dodgeDir, speed * dt);
    }

    // I-frame logic
    const wasInvulnerable = this._invulnerable;
    this._invulnerable = this.timer >= IFRAME_START && this.timer <= IFRAME_END;

    // Visual: toggle translucency on i-frame edges
    if (this._invulnerable !== wasInvulnerable) {
      const material = ctx.model.mesh.material as THREE.ShaderMaterial;
      if (this._invulnerable) {
        material.transparent = true;
        material.uniforms.uOpacity.value = IFRAME_OPACITY;
      } else {
        material.uniforms.uOpacity.value = 1.0;
        material.transparent = false;
      }
    }

    return null;
  }

  exit(ctx: PlayerContext): void {
    this._invulnerable = false;

    // Ensure material is restored
    const material = ctx.model.mesh.material as THREE.ShaderMaterial;
    material.uniforms.uOpacity.value = 1.0;
    material.transparent = false;
  }
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
  private readonly dodgeState: DodgeState;

  constructor(
    input: InputManager,
    controller: PlayerController,
    stats: PlayerStats,
    model: PlayerModel,
    camera: CameraController,
  ) {
    const context: PlayerContext = { input, controller, stats, model, camera };
    this.fsm = new StateMachine<PlayerContext>(context);

    this.dodgeState = new DodgeState();

    // Register all player states
    this.fsm
      .addState(new IdleState())
      .addState(new RunState())
      .addState(this.dodgeState)
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

  /** True when the player is in the dodge i-frame window */
  get isInvulnerable(): boolean {
    return this.dodgeState.isInvulnerable;
  }
}
