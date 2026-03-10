import * as THREE from 'three';
import { AIState } from '../../ai/AIState';
import { EnemyContext } from '../BaseEnemy';
import { HitboxManager, SphereShape, Hitbox } from '../../combat/HitboxManager';
import { AttackDataSchema } from '../EnemyFactory';
import { distToPlayer, pickAttack, requestAttackToken, releaseAttackToken, getOrbitTarget } from '../shared';
import { TELEGRAPH_MELEE } from '../../rendering/TelegraphVFX';
import type { TriangleShard } from './TriangleShard';

// ── Scratch vectors ─────────────────────────────────────────────

const _toPlayer = new THREE.Vector3();

/**
 * Idle: wait until player enters aggro range.
 */
export class ShardIdleState implements AIState<EnemyContext> {
  readonly name = 'idle';
  private aggroRange: number;

  constructor(aggroRange: number) {
    this.aggroRange = aggroRange;
  }

  enter(_ctx: EnemyContext): void {}

  update(_dt: number, ctx: EnemyContext): string | null {
    const dist = distToPlayer(ctx);
    if (dist <= this.aggroRange) {
      return 'chase';
    }
    return null;
  }

  exit(_ctx: EnemyContext): void {}
}

/**
 * Chase: move toward the player. Transition to attack when in range,
 * or back to idle when player leaves aggro range.
 */
export class ShardChaseState implements AIState<EnemyContext> {
  readonly name = 'chase';
  private aggroRange: number;
  private attackRange: number;
  private shard: TriangleShard;

  constructor(shard: TriangleShard, aggroRange: number, attackRange: number) {
    this.shard = shard;
    this.aggroRange = aggroRange;
    this.attackRange = attackRange;
  }

  enter(_ctx: EnemyContext): void {}

  update(dt: number, ctx: EnemyContext): string | null {
    const dist = distToPlayer(ctx);

    if (dist > this.aggroRange) {
      return 'idle';
    }

    if (dist <= this.attackRange) {
      if (requestAttackToken(ctx)) {
        return 'attack';
      }
      // Token denied — orbit at attack range instead of standing still
      this.shard.moveTowardPublic(getOrbitTarget(ctx, this.attackRange, dt), dt);
      return null;
    }

    this.shard.moveTowardPublic(ctx.playerPosition, dt);
    return null;
  }

  exit(_ctx: EnemyContext): void {}
}

/**
 * Attack: telegraph -> active (hitbox) -> recovery.
 * During telegraph, mesh glows red. During lunge active phase,
 * the enemy dashes forward. During recovery, vulnerable.
 */
export class ShardAttackState implements AIState<EnemyContext> {
  readonly name = 'attack';

  private shard: TriangleShard;
  private hitboxMgr: HitboxManager;
  private attacks: AttackDataSchema[];
  private attackPool: string[];

  private currentAttack: AttackDataSchema | null = null;
  private timer = 0;
  private phase: 'telegraph' | 'active' | 'recovery' = 'telegraph';

  private hitbox: Hitbox | null = null;
  private dashDir = new THREE.Vector3();
  private dashSpeed = 0;

  constructor(
    shard: TriangleShard,
    hitboxMgr: HitboxManager,
    attacks: AttackDataSchema[],
    attackPool: string[],
  ) {
    this.shard = shard;
    this.hitboxMgr = hitboxMgr;
    this.attacks = attacks;
    this.attackPool = attackPool;
  }

  enter(ctx: EnemyContext): void {
    this.timer = 0;
    this.phase = 'telegraph';
    this.hitbox = null;

    this.currentAttack = pickAttack(this.attacks, this.attackPool);

    // Face the player at start of attack
    _toPlayer.subVectors(ctx.playerPosition, ctx.enemy.getPosition());
    _toPlayer.y = 0;
    if (_toPlayer.lengthSq() > 0.001) {
      _toPlayer.normalize();
      ctx.enemy.group.rotation.y = Math.atan2(_toPlayer.x, _toPlayer.z);
    }

    // Lock dash direction at attack start
    this.dashDir.copy(_toPlayer);
    if (this.currentAttack.movementDuringAttack) {
      this.dashSpeed = this.currentAttack.movementDuringAttack.speed;
    } else {
      this.dashSpeed = 0;
    }

    // Telegraph visual: color pulse + scale pulse
    const telegraphDur = (this.currentAttack?.telegraphDuration ?? 500) / 1000;
    this.shard.telegraph(TELEGRAPH_MELEE, telegraphDur);
  }

  update(dt: number, ctx: EnemyContext): string | null {
    if (!this.currentAttack) return 'chase';

    this.timer += dt;
    const atk = this.currentAttack;
    const telegraphDur = atk.telegraphDuration / 1000;
    const activeDur = atk.activeDuration / 1000;
    const recoveryDur = atk.recoveryDuration / 1000;

    // ── Telegraph ────────────────────────────────────────────
    if (this.phase === 'telegraph') {
      if (this.timer >= telegraphDur) {
        this.phase = 'active';
        this.timer = 0;
        this.shard.endTelegraph();
        this.createHitbox(ctx);
      }
      return null;
    }

    // ── Active ───────────────────────────────────────────────
    if (this.phase === 'active') {
      // Dash movement for lunge attacks
      if (this.dashSpeed > 0) {
        ctx.enemy.group.position.addScaledVector(this.dashDir, this.dashSpeed * dt);
      }

      // Move hitbox center to follow enemy
      if (this.hitbox && this.hitbox.shape.type === 'sphere') {
        this.hitbox.shape.center.copy(ctx.enemy.getPosition());
        this.hitbox.shape.center.addScaledVector(this.dashDir, atk.range * 0.5);
      }

      if (this.timer >= activeDur) {
        this.phase = 'recovery';
        this.timer = 0;
        this.removeHitbox();
      }
      return null;
    }

    // ── Recovery ─────────────────────────────────────────────
    if (this.timer >= recoveryDur) {
      return 'attack_cooldown';
    }
    return null;
  }

  exit(ctx: EnemyContext): void {
    this.removeHitbox();
    this.shard.endTelegraph();
    releaseAttackToken(ctx);
  }

  private createHitbox(ctx: EnemyContext): void {
    if (!this.currentAttack) return;
    const atk = this.currentAttack;
    const pos = ctx.enemy.getPosition();

    const center = new THREE.Vector3().copy(pos);
    center.addScaledVector(this.dashDir, atk.range * 0.5);

    const shape: SphereShape = {
      type: 'sphere',
      center,
      radius: atk.range * 0.5,
    };

    this.hitbox = this.hitboxMgr.createHitbox(
      ctx.enemy.entityId,
      Date.now(),
      shape,
      {
        damage: atk.damage,
        staggerDamage: atk.staggerDamage,
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

/**
 * Attack cooldown: brief pause between consecutive attacks.
 */
export class ShardAttackCooldownState implements AIState<EnemyContext> {
  readonly name = 'attack_cooldown';
  private shard: TriangleShard;
  private cooldown: number;
  private attackRange: number;
  private timer = 0;

  constructor(shard: TriangleShard, cooldownMs: number, attackRange: number) {
    this.shard = shard;
    this.cooldown = cooldownMs / 1000;
    this.attackRange = attackRange;
  }

  enter(_ctx: EnemyContext): void {
    this.timer = 0;
  }

  update(dt: number, ctx: EnemyContext): string | null {
    this.timer += dt;

    if (this.timer >= this.cooldown) {
      const dist = distToPlayer(ctx);
      if (dist <= this.attackRange) {
        return 'attack';
      }
      return 'chase';
    }

    // Face player while waiting
    _toPlayer.subVectors(ctx.playerPosition, ctx.enemy.getPosition());
    _toPlayer.y = 0;
    if (_toPlayer.lengthSq() > 0.001) {
      _toPlayer.normalize();
      this.shard.faceDirectionPublic(_toPlayer, dt);
    }

    return null;
  }

  exit(_ctx: EnemyContext): void {}
}

/**
 * Staggered: stunned after poise break, then recovers to chase.
 */
export class ShardStaggeredState implements AIState<EnemyContext> {
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
      return 'chase';
    }
    return null;
  }

  exit(_ctx: EnemyContext): void {}
}
