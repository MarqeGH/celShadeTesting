import * as THREE from 'three';
import { AIState } from '../../ai/AIState';
import { EnemyContext } from '../BaseEnemy';
import { HitboxManager, SphereShape, Hitbox } from '../../combat/HitboxManager';
import { AttackDataSchema } from '../EnemyFactory';
import { distToPlayer, pickAttack } from '../shared';
import type { SpiralDancer } from './SpiralDancer';

// ── Scratch vectors ─────────────────────────────────────────────

const _toPlayer = new THREE.Vector3();
const _orbitDir = new THREE.Vector3();

// ── Idle ────────────────────────────────────────────────────────

/**
 * Idle: wait until player enters aggro range.
 */
export class DancerIdleState implements AIState<EnemyContext> {
  readonly name = 'idle';
  private aggroRange: number;

  constructor(aggroRange: number) {
    this.aggroRange = aggroRange;
  }

  enter(_ctx: EnemyContext): void {}

  update(_dt: number, ctx: EnemyContext): string | null {
    if (distToPlayer(ctx) <= this.aggroRange) {
      return 'orbit';
    }
    return null;
  }

  exit(_ctx: EnemyContext): void {}
}

// ── Orbit ───────────────────────────────────────────────────────

/**
 * Orbit: circle the player at a set radius and speed.
 * After a cooldown period, pick an attack based on distance.
 * Dart strike when at orbit range, whip lash when close.
 */
export class DancerOrbitState implements AIState<EnemyContext> {
  readonly name = 'orbit';

  private dancer: SpiralDancer;
  private aggroRange: number;
  private orbitRadius: number;
  private orbitSpeed: number;
  private attackCooldownDuration: number;

  private attackTimer = 0;
  private orbitAngle = 0;

  constructor(
    dancer: SpiralDancer,
    aggroRange: number,
    orbitRadius: number,
    orbitSpeed: number,
    attackCooldownMs: number,
  ) {
    this.dancer = dancer;
    this.aggroRange = aggroRange;
    this.orbitRadius = orbitRadius;
    this.orbitSpeed = orbitSpeed;
    this.attackCooldownDuration = attackCooldownMs / 1000;
  }

  enter(ctx: EnemyContext): void {
    this.attackTimer = 0;

    // Initialize orbit angle from current position relative to player
    const pos = ctx.enemy.getPosition();
    const dx = pos.x - ctx.playerPosition.x;
    const dz = pos.z - ctx.playerPosition.z;
    this.orbitAngle = Math.atan2(dz, dx);
  }

  update(dt: number, ctx: EnemyContext): string | null {
    const dist = distToPlayer(ctx);

    // Drop aggro
    if (dist > this.aggroRange) {
      return 'idle';
    }

    // Advance orbit angle (angular speed = linear speed / radius)
    const angularSpeed = this.orbitSpeed / this.orbitRadius;
    this.orbitAngle += angularSpeed * dt;

    // Target position on orbit circle around player
    const targetX = ctx.playerPosition.x + Math.cos(this.orbitAngle) * this.orbitRadius;
    const targetZ = ctx.playerPosition.z + Math.sin(this.orbitAngle) * this.orbitRadius;
    const targetPos = _orbitDir.set(targetX, 0, targetZ);

    // Move toward orbit target
    this.dancer.moveTowardPublic(targetPos, dt);

    // Face the player while orbiting
    _toPlayer.subVectors(ctx.playerPosition, ctx.enemy.getPosition());
    _toPlayer.y = 0;
    if (_toPlayer.lengthSq() > 0.001) {
      _toPlayer.normalize();
      this.dancer.faceDirectionPublic(_toPlayer, dt);
    }

    // Attack cooldown
    this.attackTimer += dt;
    if (this.attackTimer >= this.attackCooldownDuration) {
      // Close range → whip_lash, orbit range → dart_strike
      if (dist <= 4) {
        return 'whip_lash';
      }
      return 'dart_strike';
    }

    return null;
  }

  exit(_ctx: EnemyContext): void {}
}

// ── Dart Strike ─────────────────────────────────────────────────

/**
 * Dart Strike: telegraph → dash through player → recovery.
 * 350ms telegraph, 150ms active dash, 500ms recovery. 12 dmg.
 */
export class DancerDartStrikeState implements AIState<EnemyContext> {
  readonly name = 'dart_strike';

  private dancer: SpiralDancer;
  private hitboxMgr: HitboxManager;
  private attacks: AttackDataSchema[];

  private attack: AttackDataSchema | null = null;
  private timer = 0;
  private phase: 'telegraph' | 'active' | 'recovery' = 'telegraph';
  private hitbox: Hitbox | null = null;
  private dashDir = new THREE.Vector3();
  private dashSpeed = 0;

  constructor(
    dancer: SpiralDancer,
    hitboxMgr: HitboxManager,
    attacks: AttackDataSchema[],
  ) {
    this.dancer = dancer;
    this.hitboxMgr = hitboxMgr;
    this.attacks = attacks;
  }

  enter(ctx: EnemyContext): void {
    this.timer = 0;
    this.phase = 'telegraph';
    this.hitbox = null;
    this.attack = pickAttack(this.attacks, ['dart_strike']);

    // Face the player
    _toPlayer.subVectors(ctx.playerPosition, ctx.enemy.getPosition());
    _toPlayer.y = 0;
    if (_toPlayer.lengthSq() > 0.001) {
      _toPlayer.normalize();
      ctx.enemy.group.rotation.y = Math.atan2(_toPlayer.x, _toPlayer.z);
    }

    // Lock dash direction
    this.dashDir.copy(_toPlayer);
    if (this.attack?.movementDuringAttack) {
      this.dashSpeed = this.attack.movementDuringAttack.speed;
    } else {
      this.dashSpeed = 30;
    }

    this.dancer.setTelegraphGlow(true);
  }

  update(dt: number, ctx: EnemyContext): string | null {
    if (!this.attack) return 'cooldown';

    this.timer += dt;
    const telegraphDur = this.attack.telegraphDuration / 1000;
    const activeDur = this.attack.activeDuration / 1000;
    const recoveryDur = this.attack.recoveryDuration / 1000;

    if (this.phase === 'telegraph') {
      if (this.timer >= telegraphDur) {
        this.phase = 'active';
        this.timer = 0;
        this.dancer.setTelegraphGlow(false);
        this.createHitbox(ctx);
      }
      return null;
    }

    if (this.phase === 'active') {
      // Dash through player
      const offset = _orbitDir.copy(this.dashDir).multiplyScalar(this.dashSpeed * dt);
      this.dancer.moveByOffset(offset);

      // Move hitbox to follow
      if (this.hitbox && this.hitbox.shape.type === 'sphere') {
        this.hitbox.shape.center.copy(ctx.enemy.getPosition());
        this.hitbox.shape.center.addScaledVector(this.dashDir, this.attack.range * 0.3);
      }

      if (this.timer >= activeDur) {
        this.phase = 'recovery';
        this.timer = 0;
        this.removeHitbox();
      }
      return null;
    }

    // Recovery
    if (this.timer >= recoveryDur) {
      return 'cooldown';
    }
    return null;
  }

  exit(_ctx: EnemyContext): void {
    this.removeHitbox();
    this.dancer.setTelegraphGlow(false);
  }

  private createHitbox(ctx: EnemyContext): void {
    if (!this.attack) return;
    const pos = ctx.enemy.getPosition();
    const center = new THREE.Vector3().copy(pos);
    center.addScaledVector(this.dashDir, this.attack.range * 0.3);

    const shape: SphereShape = {
      type: 'sphere',
      center,
      radius: this.attack.range * 0.4,
    };

    this.hitbox = this.hitboxMgr.createHitbox(
      ctx.enemy.entityId,
      Date.now(),
      shape,
      {
        damage: this.attack.damage,
        staggerDamage: this.attack.staggerDamage,
        knockback: 0,
      },
    );
  }

  private removeHitbox(): void {
    if (this.hitbox) {
      this.hitboxMgr.removeHitbox(this.hitbox);
      this.hitbox = null;
    }
  }
}

// ── Whip Lash ───────────────────────────────────────────────────

/**
 * Whip Lash: telegraph → 3m arc attack → recovery.
 * 300ms telegraph, 200ms active, 400ms recovery. 8 dmg.
 */
export class DancerWhipLashState implements AIState<EnemyContext> {
  readonly name = 'whip_lash';

  private dancer: SpiralDancer;
  private hitboxMgr: HitboxManager;
  private attacks: AttackDataSchema[];

  private attack: AttackDataSchema | null = null;
  private timer = 0;
  private phase: 'telegraph' | 'active' | 'recovery' = 'telegraph';
  private hitbox: Hitbox | null = null;

  constructor(
    dancer: SpiralDancer,
    hitboxMgr: HitboxManager,
    attacks: AttackDataSchema[],
  ) {
    this.dancer = dancer;
    this.hitboxMgr = hitboxMgr;
    this.attacks = attacks;
  }

  enter(ctx: EnemyContext): void {
    this.timer = 0;
    this.phase = 'telegraph';
    this.hitbox = null;
    this.attack = pickAttack(this.attacks, ['whip_lash']);

    // Face the player
    _toPlayer.subVectors(ctx.playerPosition, ctx.enemy.getPosition());
    _toPlayer.y = 0;
    if (_toPlayer.lengthSq() > 0.001) {
      _toPlayer.normalize();
      ctx.enemy.group.rotation.y = Math.atan2(_toPlayer.x, _toPlayer.z);
    }

    this.dancer.setTelegraphGlow(true);
  }

  update(dt: number, ctx: EnemyContext): string | null {
    if (!this.attack) return 'cooldown';

    this.timer += dt;
    const telegraphDur = this.attack.telegraphDuration / 1000;
    const activeDur = this.attack.activeDuration / 1000;
    const recoveryDur = this.attack.recoveryDuration / 1000;

    if (this.phase === 'telegraph') {
      if (this.timer >= telegraphDur) {
        this.phase = 'active';
        this.timer = 0;
        this.dancer.setTelegraphGlow(false);
        this.createHitbox(ctx);
      }
      return null;
    }

    if (this.phase === 'active') {
      // Move hitbox to follow enemy position
      if (this.hitbox && this.hitbox.shape.type === 'sphere') {
        this.hitbox.shape.center.copy(ctx.enemy.getPosition());
      }

      if (this.timer >= activeDur) {
        this.phase = 'recovery';
        this.timer = 0;
        this.removeHitbox();
      }
      return null;
    }

    // Recovery
    if (this.timer >= recoveryDur) {
      return 'cooldown';
    }
    return null;
  }

  exit(_ctx: EnemyContext): void {
    this.removeHitbox();
    this.dancer.setTelegraphGlow(false);
  }

  private createHitbox(ctx: EnemyContext): void {
    if (!this.attack) return;
    const pos = ctx.enemy.getPosition();

    const shape: SphereShape = {
      type: 'sphere',
      center: new THREE.Vector3().copy(pos),
      radius: this.attack.range,
    };

    this.hitbox = this.hitboxMgr.createHitbox(
      ctx.enemy.entityId,
      Date.now(),
      shape,
      {
        damage: this.attack.damage,
        staggerDamage: this.attack.staggerDamage,
        knockback: 0,
      },
    );
  }

  private removeHitbox(): void {
    if (this.hitbox) {
      this.hitboxMgr.removeHitbox(this.hitbox);
      this.hitbox = null;
    }
  }
}

// ── Cooldown ────────────────────────────────────────────────────

/**
 * Brief pause between attacks before returning to orbit.
 */
export class DancerCooldownState implements AIState<EnemyContext> {
  readonly name = 'cooldown';
  private dancer: SpiralDancer;
  private duration: number;
  private timer = 0;

  constructor(dancer: SpiralDancer, durationMs: number) {
    this.dancer = dancer;
    this.duration = durationMs / 1000;
  }

  enter(_ctx: EnemyContext): void {
    this.timer = 0;
  }

  update(dt: number, ctx: EnemyContext): string | null {
    this.timer += dt;

    // Face player while waiting
    _toPlayer.subVectors(ctx.playerPosition, ctx.enemy.getPosition());
    _toPlayer.y = 0;
    if (_toPlayer.lengthSq() > 0.001) {
      _toPlayer.normalize();
      this.dancer.faceDirectionPublic(_toPlayer, dt);
    }

    if (this.timer >= this.duration) {
      return 'orbit';
    }
    return null;
  }

  exit(_ctx: EnemyContext): void {}
}

// ── Staggered ───────────────────────────────────────────────────

/**
 * Stunned after poise break. Recovers to orbit.
 */
export class DancerStaggeredState implements AIState<EnemyContext> {
  readonly name = 'staggered';
  private duration: number;
  private timer = 0;

  constructor(durationMs: number) {
    this.duration = durationMs / 1000;
  }

  enter(_ctx: EnemyContext): void {
    this.timer = 0;
  }

  update(dt: number, _ctx: EnemyContext): string | null {
    this.timer += dt;
    if (this.timer >= this.duration) {
      return 'orbit';
    }
    return null;
  }

  exit(_ctx: EnemyContext): void {}
}
