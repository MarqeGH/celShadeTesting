import * as THREE from 'three';
import { StateMachine } from '../ai/StateMachine';
import { AIState } from '../ai/AIState';
import { InputManager } from '../app/InputManager';
import { PlayerController } from './PlayerController';
import { PlayerStats } from './PlayerStats';
import { CameraController } from '../camera/CameraController';
import { PlayerModel } from './PlayerModel';
import { WeaponSystem, ActiveHitbox } from '../combat/WeaponSystem';

// ── Context shared by all player states ─────────────────────────

export interface PlayerContext {
  input: InputManager;
  controller: PlayerController;
  stats: PlayerStats;
  model: PlayerModel;
  camera: CameraController;
  weaponSystem: WeaponSystem;
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

// ── Light Attack State ──────────────────────────────────────────

/** Attack phase timing in seconds */
const LIGHT_TELEGRAPH = 0.1;
const LIGHT_ACTIVE = 0.15;
const LIGHT_RECOVERY = 0.2;
const LIGHT_TOTAL = LIGHT_TELEGRAPH + LIGHT_ACTIVE + LIGHT_RECOVERY;

/** Combo window: last 100ms of recovery */
const COMBO_WINDOW = 0.1;

/** Hitbox params */
const LIGHT_HITBOX_RADIUS = 2.5;
const LIGHT_HITBOX_ARC_DEG = 120;

/** Scale deformation during attack swing */
const ATTACK_SCALE_X = 1.4;
const ATTACK_SCALE_RETURN_SPEED = 8;

/** Max combo count (2-hit chain) */
const MAX_LIGHT_COMBO = 2;

class LightAttackState implements AIState<PlayerContext> {
  readonly name = 'light_attack';

  private timer = 0;
  private hitbox: ActiveHitbox | null = null;
  private comboCount = 0;
  private comboQueued = false;
  private readonly _attackDir = new THREE.Vector3();

  enter(ctx: PlayerContext): void {
    this.timer = 0;
    this.hitbox = null;
    this.comboQueued = false;
    this.comboCount++;

    // Compute attack direction from player facing
    const meshY = ctx.model.mesh.rotation.y;
    this._attackDir.set(Math.sin(meshY), 0, Math.cos(meshY));
  }

  update(dt: number, ctx: PlayerContext): string | null {
    this.timer += dt;

    // ── Phase: Telegraph (0 to 0.1s) ────────────────────────
    if (this.timer < LIGHT_TELEGRAPH) {
      const t = this.timer / LIGHT_TELEGRAPH;
      const scaleX = 1.0 + (ATTACK_SCALE_X - 1.0) * t;
      ctx.model.mesh.scale.x = scaleX;
      return null;
    }

    // ── Phase: Active (0.1s to 0.25s) ───────────────────────
    const activeEnd = LIGHT_TELEGRAPH + LIGHT_ACTIVE;
    if (this.timer < activeEnd) {
      // Create hitbox on first active frame
      if (!this.hitbox) {
        this.hitbox = ctx.weaponSystem.createHitbox(
          ctx.model.mesh.position,
          this._attackDir,
          LIGHT_HITBOX_RADIUS,
          LIGHT_HITBOX_ARC_DEG,
        );
        // Peak deformation at active start
        ctx.model.mesh.scale.x = ATTACK_SCALE_X;
      }

      // Update hitbox position to follow player
      ctx.weaponSystem.updateHitbox(this.hitbox, ctx.model.mesh.position, this._attackDir);
      return null;
    }

    // ── Phase: Recovery (0.25s to 0.45s) ────────────────────

    // Remove hitbox when entering recovery
    if (this.hitbox) {
      ctx.weaponSystem.removeHitbox(this.hitbox);
      this.hitbox = null;
    }

    // Smoothly return scale to normal during recovery
    const mesh = ctx.model.mesh;
    mesh.scale.x += (1.0 - mesh.scale.x) * Math.min(1, ATTACK_SCALE_RETURN_SPEED * dt);

    // Check combo input during combo window (last 100ms of recovery)
    const comboWindowStart = LIGHT_TOTAL - COMBO_WINDOW;
    if (
      this.timer >= comboWindowStart &&
      !this.comboQueued &&
      this.comboCount < MAX_LIGHT_COMBO
    ) {
      if (
        ctx.input.justPressed('lightAttack') ||
        ctx.input.consumeBuffer('lightAttack')
      ) {
        if (ctx.stats.canPerformAction('light_attack')) {
          ctx.stats.drainStamina('light_attack');
          this.comboQueued = true;
        }
      }
    }

    // End of recovery
    if (this.timer >= LIGHT_TOTAL) {
      mesh.scale.x = 1.0;

      if (this.comboQueued) {
        // Chain into next hit by resetting internal state
        this.startNextComboHit(ctx);
        return null; // stay in light_attack
      }

      // Combo finished — reset counter for next fresh attack
      this.comboCount = 0;
      return 'idle';
    }

    return null;
  }

  exit(ctx: PlayerContext): void {
    // Clean up hitbox if interrupted
    if (this.hitbox) {
      ctx.weaponSystem.removeHitbox(this.hitbox);
      this.hitbox = null;
    }
    // Reset scale and combo
    ctx.model.mesh.scale.x = 1.0;
    this.comboCount = 0;
  }

  /**
   * Internal combo chain: reset timer and direction for the next swing
   * without leaving the state (avoids FSM re-entry issue).
   */
  private startNextComboHit(ctx: PlayerContext): void {
    this.timer = 0;
    this.hitbox = null;
    this.comboQueued = false;
    this.comboCount++;

    // Re-read facing direction for the new swing
    const meshY = ctx.model.mesh.rotation.y;
    this._attackDir.set(Math.sin(meshY), 0, Math.cos(meshY));

    console.log(`[LightAttack] combo hit ${this.comboCount}`);
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
  private readonly lightAttackState: LightAttackState;

  constructor(
    input: InputManager,
    controller: PlayerController,
    stats: PlayerStats,
    model: PlayerModel,
    camera: CameraController,
    weaponSystem: WeaponSystem,
  ) {
    const context: PlayerContext = { input, controller, stats, model, camera, weaponSystem };
    this.fsm = new StateMachine<PlayerContext>(context);

    this.dodgeState = new DodgeState();
    this.lightAttackState = new LightAttackState();

    // Register all player states
    this.fsm
      .addState(new IdleState())
      .addState(new RunState())
      .addState(this.dodgeState)
      .addState(this.lightAttackState)
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
