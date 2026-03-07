import { StateMachine } from '../ai/StateMachine';
import { InputManager } from '../app/InputManager';
import { PlayerController } from './PlayerController';
import { PlayerStats } from './PlayerStats';
import { PlayerModel } from './PlayerModel';
import { CameraController } from '../camera/CameraController';
import { WeaponSystem } from '../combat/WeaponSystem';

import {
  PlayerContext,
  IdleState,
  RunState,
  DodgeState,
  LightAttackState,
  HeavyAttackState,
  ParryState,
  HealState,
  TimedStubState,
  DeadState,
} from './states';

/** Stamina recovered on successful parry */
const PARRY_STAMINA_RECOVERY = 10;
/** Duration of parry damage buff (seconds) */
const PARRY_BUFF_DURATION = 3.0;
/** Damage multiplier during parry buff */
const PARRY_BUFF_MULTIPLIER = 1.5;

// Re-export PlayerContext for external consumers
export type { PlayerContext } from './states';

export class PlayerStateMachine {
  readonly fsm: StateMachine<PlayerContext>;
  private readonly context: PlayerContext;
  private readonly dodgeState: DodgeState;
  private readonly lightAttackState: LightAttackState;
  private readonly heavyAttackState: HeavyAttackState;
  private readonly parryState: ParryState;

  /** Time remaining on parry damage buff */
  private _parryBuffTimer = 0;

  constructor(
    input: InputManager,
    controller: PlayerController,
    stats: PlayerStats,
    model: PlayerModel,
    camera: CameraController,
    weaponSystem: WeaponSystem,
  ) {
    this.context = { input, controller, stats, model, camera, weaponSystem };
    this.fsm = new StateMachine<PlayerContext>(this.context);

    this.dodgeState = new DodgeState();
    this.lightAttackState = new LightAttackState();
    this.heavyAttackState = new HeavyAttackState();
    this.parryState = new ParryState();

    // Register all player states
    this.fsm
      .addState(new IdleState())
      .addState(new RunState())
      .addState(this.dodgeState)
      .addState(this.lightAttackState)
      .addState(this.heavyAttackState)
      .addState(this.parryState)
      .addState(new TimedStubState('stagger', 0.5))
      .addState(new HealState())
      .addState(new DeadState());

    // Initial state
    this.fsm.setState('idle');
  }

  update(dt: number): void {
    this.fsm.update(dt);

    // Tick down parry damage buff
    if (this._parryBuffTimer > 0) {
      this._parryBuffTimer = Math.max(0, this._parryBuffTimer - dt);
    }
  }

  getCurrentState(): string | null {
    return this.fsm.getCurrentStateName();
  }

  /** True when the player is in the dodge i-frame window */
  get isInvulnerable(): boolean {
    return this.dodgeState.isInvulnerable;
  }

  /** True when the player is in the parry state's active deflection window (150ms) */
  get isInParryWindow(): boolean {
    return this.fsm.getCurrentStateName() === 'parry' && this.parryState.isInWindow;
  }

  /** True when the player is in the parry state but outside the active window */
  get isInParryRecovery(): boolean {
    return this.fsm.getCurrentStateName() === 'parry' && !this.parryState.isInWindow;
  }

  /** Damage multiplier: 1.5x while parry buff is active, 1.0x otherwise */
  get damageMultiplier(): number {
    return this._parryBuffTimer > 0 ? PARRY_BUFF_MULTIPLIER : 1.0;
  }

  /** True while the parry damage buff is active */
  get hasParryBuff(): boolean {
    return this._parryBuffTimer > 0;
  }

  /** Heavy attack charge-based damage multiplier (1.5x–2.0x) */
  get heavyAttackDamageMultiplier(): number {
    return this.heavyAttackState.getDamageMultiplier();
  }

  /**
   * Called by the CombatSystem when a successful parry deflects an attack.
   * Grants stamina recovery and activates the damage buff.
   */
  notifyParrySuccess(): void {
    this._parryBuffTimer = PARRY_BUFF_DURATION;
    this.context.stats.addStamina(PARRY_STAMINA_RECOVERY);
    this.parryState.triggerSuccessFlash(this.context);
    console.log('[Parry] SUCCESS — 1.5x damage buff for 3s, +10 stamina');
  }

  /**
   * Called by the CombatSystem when a hit lands during parry recovery (failed parry).
   * Forces the player into stagger state as extra punishment.
   */
  notifyParryFail(): void {
    this.fsm.setState('stagger');
    console.log('[Parry] FAIL — extra stagger applied');
  }
}
