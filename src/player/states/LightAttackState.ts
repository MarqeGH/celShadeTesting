import * as THREE from 'three';
import { AIState } from '../../ai/AIState';
import { ActiveHitbox } from '../../combat/WeaponSystem';
import { PlayerContext } from './PlayerContext';

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

export class LightAttackState implements AIState<PlayerContext> {
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
