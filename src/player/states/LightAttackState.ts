import * as THREE from 'three';
import { AIState } from '../../ai/AIState';
import { ActiveHitbox } from '../../combat/WeaponSystem';
import { PlayerContext } from './PlayerContext';

/** Base attack phase timing in seconds (scaled by weapon attackSpeed) */
const BASE_TELEGRAPH = 0.1;
const BASE_ACTIVE = 0.15;
const BASE_RECOVERY = 0.2;

/** Combo window: last 100ms of recovery */
const COMBO_WINDOW = 0.1;

/** Scale deformation during attack swing */
const ATTACK_SCALE_X = 1.4;
const ATTACK_SCALE_RETURN_SPEED = 8;

export class LightAttackState implements AIState<PlayerContext> {
  readonly name = 'light_attack';

  private timer = 0;
  private hitbox: ActiveHitbox | null = null;
  private comboCount = 0;
  private comboQueued = false;
  private readonly _attackDir = new THREE.Vector3();

  // Cached per-enter values from weapon data
  private telegraph = BASE_TELEGRAPH;
  private active = BASE_ACTIVE;
  private recovery = BASE_RECOVERY;
  private total = BASE_TELEGRAPH + BASE_ACTIVE + BASE_RECOVERY;
  private hitboxRadius = 2.5;
  private hitboxArcDeg = 120;
  private maxCombo = 2;

  enter(ctx: PlayerContext): void {
    this.timer = 0;
    this.hitbox = null;
    this.comboQueued = false;
    this.comboCount++;

    // Read weapon data for timing and hitbox params
    const weapon = ctx.weaponSystem.getEquipped();
    const speedScale = 1 / weapon.attackSpeed; // higher speed = shorter timings
    this.telegraph = BASE_TELEGRAPH * speedScale;
    this.active = BASE_ACTIVE * speedScale;
    this.recovery = BASE_RECOVERY * speedScale;
    this.total = this.telegraph + this.active + this.recovery;
    this.hitboxRadius = weapon.hitboxSize.radius;
    this.hitboxArcDeg = weapon.hitboxSize.angle;
    this.maxCombo = weapon.comboHits;

    // Compute attack direction from player facing
    const meshY = ctx.model.mesh.rotation.y;
    this._attackDir.set(Math.sin(meshY), 0, Math.cos(meshY));
  }

  update(dt: number, ctx: PlayerContext): string | null {
    this.timer += dt;

    // ── Phase: Telegraph (0 to telegraph) ────────────────────
    if (this.timer < this.telegraph) {
      const t = this.timer / this.telegraph;
      const scaleX = 1.0 + (ATTACK_SCALE_X - 1.0) * t;
      ctx.model.mesh.scale.x = scaleX;
      return null;
    }

    // ── Phase: Active (telegraph to telegraph+active) ────────
    const activeEnd = this.telegraph + this.active;
    if (this.timer < activeEnd) {
      // Create hitbox on first active frame
      if (!this.hitbox) {
        this.hitbox = ctx.weaponSystem.createHitbox(
          ctx.model.mesh.position,
          this._attackDir,
          this.hitboxRadius,
          this.hitboxArcDeg,
        );
        // Peak deformation at active start
        ctx.model.mesh.scale.x = ATTACK_SCALE_X;
      }

      // Update hitbox position to follow player
      ctx.weaponSystem.updateHitbox(this.hitbox, ctx.model.mesh.position, this._attackDir);
      return null;
    }

    // ── Phase: Recovery (activeEnd to total) ─────────────────

    // Remove hitbox when entering recovery
    if (this.hitbox) {
      ctx.weaponSystem.removeHitbox(this.hitbox);
      this.hitbox = null;
    }

    // Smoothly return scale to normal during recovery
    const mesh = ctx.model.mesh;
    mesh.scale.x += (1.0 - mesh.scale.x) * Math.min(1, ATTACK_SCALE_RETURN_SPEED * dt);

    // Check combo input during combo window (last 100ms of recovery)
    const comboWindowStart = this.total - COMBO_WINDOW;
    if (
      this.timer >= comboWindowStart &&
      !this.comboQueued &&
      this.comboCount < this.maxCombo
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
    if (this.timer >= this.total) {
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
