import * as THREE from 'three';
import { AIState } from '../../ai/AIState';
import { ActiveHitbox } from '../../combat/WeaponSystem';
import { PlayerContext } from './PlayerContext';

/** Base charge timing (scaled by weapon attackSpeed) */
const BASE_CHARGE_MIN = 0.3;
const BASE_CHARGE_MAX = 0.8;

/** Base attack phase timing post-charge (scaled by weapon attackSpeed) */
const BASE_TELEGRAPH = 0.25;
const BASE_ACTIVE = 0.2;
const BASE_RECOVERY = 0.3;

/** Movement speed while charging (m/s) */
const HEAVY_CHARGE_MOVE_SPEED = 2.0;

/** Scale deformation during heavy swing */
const HEAVY_SCALE_X = 1.5;
const HEAVY_SCALE_RETURN_SPEED = 6;

/** Y-axis compression while charging (visual feedback) */
const HEAVY_CHARGE_SCALE_Y = 0.85;

type HeavyPhase = 'charging' | 'telegraph' | 'active' | 'recovery';

export class HeavyAttackState implements AIState<PlayerContext> {
  readonly name = 'heavy_attack';

  private phase: HeavyPhase = 'charging';
  private chargeTimer = 0;
  private phaseTimer = 0;
  private damageMultiplier = 1.5;
  private hitbox: ActiveHitbox | null = null;
  private readonly _attackDir = new THREE.Vector3();
  private readonly _forward = new THREE.Vector3();
  private readonly _right = new THREE.Vector3();
  private readonly _moveDir = new THREE.Vector3();

  // Cached per-enter values from weapon data
  private chargeMin = BASE_CHARGE_MIN;
  private chargeMax = BASE_CHARGE_MAX;
  private telegraph = BASE_TELEGRAPH;
  private active = BASE_ACTIVE;
  private recovery = BASE_RECOVERY;
  private hitboxRadius = 2.5;
  private hitboxArcDeg = 120;
  private heavyMultMin = 1.5;
  private heavyMultMax = 2.0;

  enter(ctx: PlayerContext): void {
    this.phase = 'charging';
    this.chargeTimer = 0;
    this.phaseTimer = 0;
    this.hitbox = null;

    // Read weapon data
    const weapon = ctx.weaponSystem.getEquipped();
    const speedScale = 1 / weapon.attackSpeed;
    this.chargeMin = BASE_CHARGE_MIN * speedScale;
    this.chargeMax = BASE_CHARGE_MAX * speedScale;
    this.telegraph = BASE_TELEGRAPH * speedScale;
    this.active = BASE_ACTIVE * speedScale;
    this.recovery = BASE_RECOVERY * speedScale;
    this.hitboxRadius = weapon.hitboxSize.radius;
    this.hitboxArcDeg = weapon.hitboxSize.angle;
    this.heavyMultMin = weapon.heavyMultiplier * 0.75;
    this.heavyMultMax = weapon.heavyMultiplier;
    this.damageMultiplier = this.heavyMultMin;

    ctx.eventBus?.emit('PLAYER_ATTACK', { type: 'heavy' });

    // Visual: compress Y while charging
    ctx.model.mesh.scale.y = HEAVY_CHARGE_SCALE_Y;
  }

  update(dt: number, ctx: PlayerContext): string | null {
    switch (this.phase) {
      case 'charging':
        return this.updateCharge(dt, ctx);
      case 'telegraph':
        return this.updateTelegraph(dt, ctx);
      case 'active':
        return this.updateActive(dt, ctx);
      case 'recovery':
        return this.updateRecovery(dt, ctx);
    }
  }

  exit(ctx: PlayerContext): void {
    if (this.hitbox) {
      ctx.weaponSystem.removeHitbox(this.hitbox);
      this.hitbox = null;
    }
    ctx.model.mesh.scale.x = 1.0;
    ctx.model.mesh.scale.y = 1.0;
  }

  // ── Charge phase ──────────────────────────────────────────

  private updateCharge(dt: number, ctx: PlayerContext): string | null {
    this.chargeTimer += dt;

    // Allow slow movement while charging
    this.applyChargeMovement(dt, ctx);

    // Auto-release at max charge
    if (this.chargeTimer >= this.chargeMax) {
      this.releaseCharge(ctx);
      return null;
    }

    // Check if button released
    if (!ctx.input.isPressed('heavyAttack')) {
      // If released before minimum charge, cancel and go idle
      if (this.chargeTimer < this.chargeMin) {
        // Refund stamina since attack didn't fire
        const weapon = ctx.weaponSystem.getEquipped();
        ctx.stats.addStamina(weapon.staminaCostHeavy);
        return 'idle';
      }
      this.releaseCharge(ctx);
      return null;
    }

    return null;
  }

  private applyChargeMovement(dt: number, ctx: PlayerContext): void {
    const input = ctx.input;
    let inputX = 0;
    let inputZ = 0;

    if (input.isPressed('moveForward')) inputZ += 1;
    if (input.isPressed('moveBack'))    inputZ -= 1;
    if (input.isPressed('moveLeft'))    inputX -= 1;
    if (input.isPressed('moveRight'))   inputX += 1;

    if (inputX === 0 && inputZ === 0) return;

    ctx.camera.getForward(this._forward);
    ctx.camera.getRight(this._right);

    this._moveDir
      .set(0, 0, 0)
      .addScaledVector(this._forward, inputZ)
      .addScaledVector(this._right, inputX);
    this._moveDir.y = 0;
    this._moveDir.normalize();

    ctx.model.mesh.position.addScaledVector(this._moveDir, HEAVY_CHARGE_MOVE_SPEED * dt);
  }

  private releaseCharge(ctx: PlayerContext): void {
    // Compute damage multiplier from charge time
    const chargeT = Math.min(
      1,
      (this.chargeTimer - this.chargeMin) / (this.chargeMax - this.chargeMin),
    );
    this.damageMultiplier = this.heavyMultMin + chargeT * (this.heavyMultMax - this.heavyMultMin);

    // Compute attack direction from player facing
    const meshY = ctx.model.mesh.rotation.y;
    this._attackDir.set(Math.sin(meshY), 0, Math.cos(meshY));

    // Restore Y scale, begin telegraph
    ctx.model.mesh.scale.y = 1.0;
    this.phase = 'telegraph';
    this.phaseTimer = 0;
  }

  // ── Telegraph phase ───────────────────────────────────────

  private updateTelegraph(dt: number, ctx: PlayerContext): string | null {
    this.phaseTimer += dt;

    // Scale up X-axis during telegraph
    const t = this.phaseTimer / this.telegraph;
    ctx.model.mesh.scale.x = 1.0 + (HEAVY_SCALE_X - 1.0) * t;

    if (this.phaseTimer >= this.telegraph) {
      this.phase = 'active';
      this.phaseTimer = 0;
    }
    return null;
  }

  // ── Active phase ──────────────────────────────────────────

  private updateActive(dt: number, ctx: PlayerContext): string | null {
    this.phaseTimer += dt;

    // Create hitbox on first active frame
    if (!this.hitbox) {
      this.hitbox = ctx.weaponSystem.createHitbox(
        ctx.model.mesh.position,
        this._attackDir,
        this.hitboxRadius,
        this.hitboxArcDeg,
      );
      ctx.model.mesh.scale.x = HEAVY_SCALE_X;
    }

    // Update hitbox to follow player
    ctx.weaponSystem.updateHitbox(this.hitbox, ctx.model.mesh.position, this._attackDir);

    if (this.phaseTimer >= this.active) {
      // Remove hitbox, enter recovery
      ctx.weaponSystem.removeHitbox(this.hitbox);
      this.hitbox = null;
      this.phase = 'recovery';
      this.phaseTimer = 0;
    }
    return null;
  }

  // ── Recovery phase ────────────────────────────────────────

  private updateRecovery(dt: number, ctx: PlayerContext): string | null {
    this.phaseTimer += dt;

    // Smoothly return scale to normal
    const mesh = ctx.model.mesh;
    mesh.scale.x += (1.0 - mesh.scale.x) * Math.min(1, HEAVY_SCALE_RETURN_SPEED * dt);

    if (this.phaseTimer >= this.recovery) {
      mesh.scale.x = 1.0;
      return 'idle';
    }
    return null;
  }

  /** Current damage multiplier (used by external systems for damage scaling) */
  getDamageMultiplier(): number {
    return this.damageMultiplier;
  }
}
