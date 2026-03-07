/**
 * PlayerStats — tracks HP, Stamina, and heal charges.
 *
 * Stamina drains on actions and regens after a pause.
 * Exhaustion state activates at 0 stamina; clears at threshold.
 * Call update(dt) each frame for regen logic.
 */

// ── Stamina costs per action ────────────────────────────────────

export const STAMINA_COSTS: Record<string, number> = {
  dodge: 20,
  light_attack: 12,
  heavy_attack: 25,
  parry: 8,
};

/** Stamina cost per second while sprinting */
export const SPRINT_STAMINA_PER_SEC = 3;

// ── Tuning constants ────────────────────────────────────────────

const MAX_HP = 100;
const MAX_STAMINA = 100;
const MAX_HEAL_CHARGES = 3;
const HEAL_AMOUNT = 40;
const STAMINA_REGEN_RATE = 25;    // per second
const STAMINA_REGEN_DELAY = 0.4;  // seconds after last drain
const EXHAUSTION_CLEAR_THRESHOLD = 20;
const EXHAUSTED_WALK_SPEED = 3;

// ── PlayerStats class ───────────────────────────────────────────

export class PlayerStats {
  private _hp = MAX_HP;
  private _maxHp = MAX_HP;
  private _stamina = MAX_STAMINA;
  private _maxStamina = MAX_STAMINA;
  private _healCharges = MAX_HEAL_CHARGES;
  private _exhausted = false;

  /** Time since last stamina drain (for regen delay) */
  private _regenTimer = 0;

  // ── Getters ─────────────────────────────────────────────────

  get hp(): number { return this._hp; }
  get maxHp(): number { return this._maxHp; }
  get stamina(): number { return this._stamina; }
  get maxStamina(): number { return this._maxStamina; }
  get healCharges(): number { return this._healCharges; }
  get exhausted(): boolean { return this._exhausted; }

  // ── Stamina ─────────────────────────────────────────────────

  /**
   * Returns true if the player can afford the stamina cost for an action.
   * When exhausted, dodge/attack/sprint are blocked regardless of current stamina.
   */
  canPerformAction(action: string): boolean {
    if (this._exhausted) return false;
    const cost = STAMINA_COSTS[action];
    if (cost === undefined) return true; // actions without cost are always allowed
    return this._stamina >= cost;
  }

  /** Returns true if the player can sprint (not exhausted). */
  canSprint(): boolean {
    return !this._exhausted && this._stamina > 0;
  }

  /**
   * Drain stamina for a discrete action (dodge, attack).
   * Returns true if the drain succeeded.
   */
  drainStamina(action: string): boolean {
    const cost = STAMINA_COSTS[action];
    if (cost === undefined) return true;
    if (!this.canPerformAction(action)) return false;

    this._stamina = Math.max(0, this._stamina - cost);
    this._regenTimer = 0;

    if (this._stamina <= 0) {
      this._exhausted = true;
    }

    return true;
  }

  /**
   * Add stamina directly (e.g. parry recovery).
   * Resets regen delay timer since stamina was just modified.
   */
  addStamina(amount: number): void {
    this._stamina = Math.min(this._maxStamina, this._stamina + amount);
  }

  /**
   * Drain stamina continuously (e.g. sprinting).
   * Call each frame with dt.
   */
  drainStaminaContinuous(costPerSecond: number, dt: number): void {
    this._stamina = Math.max(0, this._stamina - costPerSecond * dt);
    this._regenTimer = 0;

    if (this._stamina <= 0) {
      this._exhausted = true;
    }
  }

  /**
   * Call each frame. Handles regen delay and stamina regeneration.
   */
  update(dt: number): void {
    // Regen delay timer
    this._regenTimer += dt;

    if (this._regenTimer >= STAMINA_REGEN_DELAY && this._stamina < this._maxStamina) {
      this._stamina = Math.min(this._maxStamina, this._stamina + STAMINA_REGEN_RATE * dt);
    }

    // Clear exhaustion once stamina reaches threshold
    if (this._exhausted && this._stamina >= EXHAUSTION_CLEAR_THRESHOLD) {
      this._exhausted = false;
    }
  }

  // ── HP ──────────────────────────────────────────────────────

  /**
   * Apply damage to the player. Returns remaining HP.
   */
  takeDamage(amount: number): number {
    this._hp = Math.max(0, this._hp - amount);
    return this._hp;
  }

  get isDead(): boolean {
    return this._hp <= 0;
  }

  // ── Healing ─────────────────────────────────────────────────

  /** Returns true if the player has charges and isn't at full HP. */
  canHeal(): boolean {
    return this._healCharges > 0 && this._hp < this._maxHp;
  }

  /**
   * Consume a heal charge and restore HP.
   * Returns true if healing occurred.
   */
  heal(): boolean {
    if (!this.canHeal()) return false;
    this._healCharges--;
    this._hp = Math.min(this._maxHp, this._hp + HEAL_AMOUNT);
    return true;
  }

  // ── Speed modifier ──────────────────────────────────────────

  /** Returns the walk speed modifier when exhausted. */
  get exhaustedWalkSpeed(): number {
    return EXHAUSTED_WALK_SPEED;
  }

  // ── Reset ───────────────────────────────────────────────────

  /** Reset all stats to max (e.g. on new run). */
  reset(): void {
    this._hp = MAX_HP;
    this._stamina = MAX_STAMINA;
    this._healCharges = MAX_HEAL_CHARGES;
    this._exhausted = false;
    this._regenTimer = 0;
  }
}
