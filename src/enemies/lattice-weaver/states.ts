import * as THREE from 'three';
import { AIState } from '../../ai/AIState';
import { EnemyContext } from '../BaseEnemy';
import { AttackDataSchema } from '../EnemyFactory';
import { HitboxManager } from '../../combat/HitboxManager';
import { distToPlayer, pickAttack, requestAttackToken, releaseAttackToken } from '../shared';
import type { LatticeWeaver } from './LatticeWeaver';

// ── Scratch vectors ─────────────────────────────────────────────

const _toPlayer = new THREE.Vector3();
const _moveDir = new THREE.Vector3();

const IDLE_ROTATION_SPEED = 0.8; // rad/s

// ── Idle ─────────────────────────────────────────────────────────

/**
 * Idle: float and slowly rotate. Aggro when player enters range.
 */
export class WeaverIdleState implements AIState<EnemyContext> {
  readonly name = 'idle';
  private aggroRange: number;

  constructor(aggroRange: number) {
    this.aggroRange = aggroRange;
  }

  enter(_ctx: EnemyContext): void {}

  update(dt: number, ctx: EnemyContext): string | null {
    ctx.enemy.group.rotation.y += IDLE_ROTATION_SPEED * dt;

    if (distToPlayer(ctx) <= this.aggroRange) {
      return 'position';
    }
    return null;
  }

  exit(_ctx: EnemyContext): void {}
}

// ── Position ─────────────────────────────────────────────────────

/**
 * Position: move to a strategic distance from the player, maintaining
 * the target offset range. Chooses web_deploy or node_burst when ready.
 */
export class WeaverPositionState implements AIState<EnemyContext> {
  readonly name = 'position';
  private weaver: LatticeWeaver;
  private aggroRange: number;
  private targetDist: number;
  private attackTimer = 0;
  private attackInterval = 2.5; // seconds between attacks

  constructor(weaver: LatticeWeaver, aggroRange: number, targetDist: number) {
    this.weaver = weaver;
    this.aggroRange = aggroRange;
    this.targetDist = targetDist;
  }

  enter(_ctx: EnemyContext): void {
    this.attackTimer = 0;
  }

  update(dt: number, ctx: EnemyContext): string | null {
    const dist = distToPlayer(ctx);

    // Lost aggro
    if (dist > this.aggroRange) {
      return 'idle';
    }

    // Check alone condition
    if (this.weaver.isLastAlive()) {
      return 'alone_aggro';
    }

    // Face the player
    _toPlayer.subVectors(ctx.playerPosition, ctx.enemy.getPosition());
    _toPlayer.y = 0;
    if (_toPlayer.lengthSq() > 0.001) {
      _toPlayer.normalize();
      this.weaver.faceDirectionPublic(_toPlayer, dt);
    }

    // Move to maintain target distance
    const distDiff = dist - this.targetDist;
    if (Math.abs(distDiff) > 1.0) {
      if (distDiff > 0) {
        // Too far — move toward player
        _moveDir.copy(_toPlayer);
      } else {
        // Too close — move away
        _moveDir.copy(_toPlayer).negate();
      }
      this.weaver.moveTowardPublic(
        ctx.enemy.getPosition().clone().add(_moveDir),
        dt,
      );
    }

    // Attack readiness
    this.attackTimer += dt;
    if (this.attackTimer >= this.attackInterval) {
      if (requestAttackToken(ctx)) {
        this.attackTimer = 0;

        // Prefer web_deploy if under max zones, otherwise node_burst
        if (this.weaver.getActiveZoneCount() < 2 && Math.random() < 0.6) {
          return 'web_deploy';
        }
        return 'node_burst';
      }
      // Token denied — keep positioning, retry next frame
    }

    return null;
  }

  exit(_ctx: EnemyContext): void {}
}

// ── Web Deploy ───────────────────────────────────────────────────

/**
 * Web Deploy: telegraph → deploy damage zone at player position → recovery.
 */
export class WeaverWebDeployState implements AIState<EnemyContext> {
  readonly name = 'web_deploy';
  private weaver: LatticeWeaver;
  private attacks: AttackDataSchema[];

  private attack: AttackDataSchema | null = null;
  private timer = 0;
  private phase: 'telegraph' | 'active' | 'recovery' = 'telegraph';
  private targetPos = new THREE.Vector3();

  constructor(weaver: LatticeWeaver, _hitboxMgr: HitboxManager, attacks: AttackDataSchema[]) {
    this.weaver = weaver;
    this.attacks = attacks;
  }

  enter(ctx: EnemyContext): void {
    this.timer = 0;
    this.phase = 'telegraph';
    this.attack = pickAttack(this.attacks, ['web_deploy']);

    // Lock target position to current player position
    this.targetPos.copy(ctx.playerPosition);
    this.targetPos.y = 0;

    this.weaver.setTelegraphGlow(true);
  }

  update(dt: number, _ctx: EnemyContext): string | null {
    if (!this.attack) return 'cooldown';

    this.timer += dt;
    const telegraphDur = this.attack.telegraphDuration / 1000;
    const activeDur = this.attack.activeDuration / 1000;
    const recoveryDur = this.attack.recoveryDuration / 1000;

    // Telegraph phase — vibrate
    if (this.phase === 'telegraph') {
      const vibIntensity = 0.04;
      this.weaver.group.position.x += (Math.random() - 0.5) * vibIntensity;
      this.weaver.group.position.z += (Math.random() - 0.5) * vibIntensity;

      if (this.timer >= telegraphDur) {
        this.phase = 'active';
        this.timer = 0;
        this.weaver.setTelegraphGlow(false);
        this.weaver.deployZone(this.targetPos);
      }
      return null;
    }

    // Active phase — brief pause
    if (this.phase === 'active') {
      if (this.timer >= activeDur) {
        this.phase = 'recovery';
        this.timer = 0;
      }
      return null;
    }

    // Recovery phase
    if (this.timer >= recoveryDur) {
      return 'cooldown';
    }
    return null;
  }

  exit(ctx: EnemyContext): void {
    this.weaver.setTelegraphGlow(false);
    releaseAttackToken(ctx);
  }
}

// ── Node Burst ───────────────────────────────────────────────────

/**
 * Node Burst: telegraph → fire ring of 6 projectiles → recovery.
 */
export class WeaverNodeBurstState implements AIState<EnemyContext> {
  readonly name = 'node_burst';
  private weaver: LatticeWeaver;
  private attacks: AttackDataSchema[];

  private attack: AttackDataSchema | null = null;
  private timer = 0;
  private phase: 'telegraph' | 'active' | 'recovery' = 'telegraph';

  constructor(weaver: LatticeWeaver, attacks: AttackDataSchema[]) {
    this.weaver = weaver;
    this.attacks = attacks;
  }

  enter(_ctx: EnemyContext): void {
    this.timer = 0;
    this.phase = 'telegraph';
    this.attack = pickAttack(this.attacks, ['node_burst']);
    this.weaver.setTelegraphGlow(true);
  }

  update(dt: number, _ctx: EnemyContext): string | null {
    if (!this.attack) return 'cooldown';

    this.timer += dt;
    const telegraphDur = this.attack.telegraphDuration / 1000;
    const activeDur = this.attack.activeDuration / 1000;
    const recoveryDur = this.attack.recoveryDuration / 1000;
    const proj = this.attack.projectile;

    // Telegraph — vibrate
    if (this.phase === 'telegraph') {
      const vibIntensity = 0.03;
      this.weaver.group.position.x += (Math.random() - 0.5) * vibIntensity;
      this.weaver.group.position.z += (Math.random() - 0.5) * vibIntensity;

      if (this.timer >= telegraphDur) {
        this.phase = 'active';
        this.timer = 0;
        this.weaver.setTelegraphGlow(false);

        // Fire ring burst
        if (proj) {
          this.weaver.fireNodeBurst(
            this.attack.damage,
            this.attack.staggerDamage,
            proj.speed,
            proj.lifetime / 1000,
            proj.size,
          );
        }
      }
      return null;
    }

    // Active
    if (this.phase === 'active') {
      if (this.timer >= activeDur) {
        this.phase = 'recovery';
        this.timer = 0;
      }
      return null;
    }

    // Recovery
    if (this.timer >= recoveryDur) {
      return 'cooldown';
    }
    return null;
  }

  exit(ctx: EnemyContext): void {
    this.weaver.setTelegraphGlow(false);
    releaseAttackToken(ctx);
  }
}

// ── Cooldown ─────────────────────────────────────────────────────

/**
 * Cooldown: brief pause between attacks, face player.
 */
export class WeaverCooldownState implements AIState<EnemyContext> {
  readonly name = 'cooldown';
  private weaver: LatticeWeaver;
  private cooldown: number;
  private timer = 0;

  constructor(weaver: LatticeWeaver, cooldownMs: number) {
    this.weaver = weaver;
    this.cooldown = cooldownMs / 1000;
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
      this.weaver.faceDirectionPublic(_toPlayer, dt);
    }

    if (this.timer >= this.cooldown) {
      // Check alone condition after cooldown
      if (this.weaver.isLastAlive()) {
        return 'alone_aggro';
      }
      return 'position';
    }
    return null;
  }

  exit(_ctx: EnemyContext): void {}
}

// ── Alone Aggro ──────────────────────────────────────────────────

/**
 * Alone Aggro: when last enemy alive, become more aggressive.
 * Moves faster toward player, attacks more frequently, alternates attacks.
 */
export class WeaverAloneAggroState implements AIState<EnemyContext> {
  readonly name = 'alone_aggro';
  private weaver: LatticeWeaver;
  private attackTimer = 0;
  private attackInterval = 1.5; // faster than normal
  private aggroSpeedMult = 1.5; // move 50% faster

  constructor(weaver: LatticeWeaver, _attacks: AttackDataSchema[]) {
    this.weaver = weaver;
  }

  enter(_ctx: EnemyContext): void {
    this.attackTimer = 0;
  }

  update(dt: number, ctx: EnemyContext): string | null {
    const dist = distToPlayer(ctx);

    // Face the player
    _toPlayer.subVectors(ctx.playerPosition, ctx.enemy.getPosition());
    _toPlayer.y = 0;
    if (_toPlayer.lengthSq() > 0.001) {
      _toPlayer.normalize();
      this.weaver.faceDirectionPublic(_toPlayer, dt);
    }

    // Aggressively close distance — target 5m instead of 7m
    const targetDist = 5;
    const distDiff = dist - targetDist;
    if (distDiff > 1.0) {
      // Move toward player faster
      const boostedPos = ctx.enemy.getPosition().clone().add(
        _toPlayer.clone().multiplyScalar(this.aggroSpeedMult),
      );
      this.weaver.moveTowardPublic(boostedPos, dt);
    }

    // Attack more frequently
    this.attackTimer += dt;
    if (this.attackTimer >= this.attackInterval) {
      this.attackTimer = 0;

      // Alternate between attacks
      if (Math.random() < 0.5) {
        return 'web_deploy';
      }
      return 'node_burst';
    }

    return null;
  }

  exit(_ctx: EnemyContext): void {}
}

// ── Staggered ────────────────────────────────────────────────────

/**
 * Staggered: stunned after poise break.
 */
export class WeaverStaggeredState implements AIState<EnemyContext> {
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
      return 'position';
    }
    return null;
  }

  exit(_ctx: EnemyContext): void {}
}
