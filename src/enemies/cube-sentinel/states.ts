import * as THREE from 'three';
import { AIState } from '../../ai/AIState';
import { EnemyContext } from '../BaseEnemy';
import { AttackDataSchema } from '../EnemyFactory';
import { distToPlayer, pickAttack, requestAttackToken, releaseAttackToken } from '../shared';
import { TELEGRAPH_RANGED } from '../../rendering/TelegraphVFX';
import type { CubeSentinel } from './CubeSentinel';

// ── Scratch vectors ─────────────────────────────────────────────

const _toPlayer = new THREE.Vector3();
const _retreatDir = new THREE.Vector3();

const IDLE_ROTATION_SPEED = 0.5; // rad/s

/**
 * Idle: slowly rotate on Y-axis. Aggro when player enters range.
 */
export class SentinelIdleState implements AIState<EnemyContext> {
  readonly name = 'idle';
  private aggroRange: number;

  constructor(aggroRange: number) {
    this.aggroRange = aggroRange;
  }

  enter(_ctx: EnemyContext): void {}

  update(_dt: number, ctx: EnemyContext): string | null {
    // Slow Y rotation
    ctx.enemy.group.rotation.y += IDLE_ROTATION_SPEED * _dt;

    if (distToPlayer(ctx) <= this.aggroRange) {
      return 'alert';
    }
    return null;
  }

  exit(_ctx: EnemyContext): void {}
}

/**
 * Alert: face player, check ranges for attack or retreat.
 */
export class SentinelAlertState implements AIState<EnemyContext> {
  readonly name = 'alert';
  private sentinel: CubeSentinel;
  private aggroRange: number;
  private attackRange: number;
  private retreatRange: number;

  constructor(sentinel: CubeSentinel, aggroRange: number, attackRange: number, retreatRange: number) {
    this.sentinel = sentinel;
    this.aggroRange = aggroRange;
    this.attackRange = attackRange;
    this.retreatRange = retreatRange;
  }

  enter(_ctx: EnemyContext): void {}

  update(dt: number, ctx: EnemyContext): string | null {
    const dist = distToPlayer(ctx);

    // Face the player
    _toPlayer.subVectors(ctx.playerPosition, ctx.enemy.getPosition());
    _toPlayer.y = 0;
    if (_toPlayer.lengthSq() > 0.001) {
      _toPlayer.normalize();
      this.sentinel.faceDirectionPublic(_toPlayer, dt);
    }

    if (dist > this.aggroRange) {
      return 'idle';
    }

    if (dist < this.retreatRange) {
      return 'retreat';
    }

    if (dist <= this.attackRange) {
      if (requestAttackToken(ctx)) {
        return 'attack';
      }
      // Token denied — just keep facing player (ranged unit stays in alert)
    }

    return null;
  }

  exit(_ctx: EnemyContext): void {}
}

/**
 * Attack: telegraph → fire projectile(s) → recovery.
 */
export class SentinelAttackState implements AIState<EnemyContext> {
  readonly name = 'attack';

  private sentinel: CubeSentinel;
  private attacks: AttackDataSchema[];
  private attackPool: string[];
  private retreatRange: number;

  private currentAttack: AttackDataSchema | null = null;
  private timer = 0;
  private phase: 'telegraph' | 'active' | 'recovery' = 'telegraph';
  private fireDir = new THREE.Vector3();

  constructor(
    sentinel: CubeSentinel,
    attacks: AttackDataSchema[],
    attackPool: string[],
    retreatRange: number,
  ) {
    this.sentinel = sentinel;
    this.attacks = attacks;
    this.attackPool = attackPool;
    this.retreatRange = retreatRange;
  }

  enter(ctx: EnemyContext): void {
    this.timer = 0;
    this.phase = 'telegraph';
    this.currentAttack = pickAttack(this.attacks, this.attackPool);

    // Face player at start
    _toPlayer.subVectors(ctx.playerPosition, ctx.enemy.getPosition());
    _toPlayer.y = 0;
    if (_toPlayer.lengthSq() > 0.001) {
      _toPlayer.normalize();
      ctx.enemy.group.rotation.y = Math.atan2(_toPlayer.x, _toPlayer.z);
    }

    // Lock fire direction
    this.fireDir.copy(_toPlayer);

    // Telegraph VFX: color pulse + scale pulse
    const telegraphDur = (this.currentAttack?.telegraphDuration ?? 500) / 1000;
    this.sentinel.telegraph(TELEGRAPH_RANGED, telegraphDur);
  }

  update(dt: number, ctx: EnemyContext): string | null {
    if (!this.currentAttack) return 'alert';

    this.timer += dt;
    const atk = this.currentAttack;
    const telegraphDur = atk.telegraphDuration / 1000;
    const activeDur = atk.activeDuration / 1000;
    const recoveryDur = atk.recoveryDuration / 1000;

    // Check retreat during telegraph/recovery
    if (this.phase !== 'active' && distToPlayer(ctx) < this.retreatRange) {
      this.sentinel.setTelegraphGlow(false, false);
      return 'retreat';
    }

    // ── Telegraph ───────────────────────────────────────────
    if (this.phase === 'telegraph') {
      // Vibrate effect during telegraph
      const vibIntensity = 0.03;
      ctx.enemy.group.position.x += (Math.random() - 0.5) * vibIntensity;
      ctx.enemy.group.position.z += (Math.random() - 0.5) * vibIntensity;

      // Retrack player direction during telegraph
      _toPlayer.subVectors(ctx.playerPosition, ctx.enemy.getPosition());
      _toPlayer.y = 0;
      if (_toPlayer.lengthSq() > 0.001) {
        _toPlayer.normalize();
        this.fireDir.copy(_toPlayer);
        this.sentinel.faceDirectionPublic(_toPlayer, dt);
      }

      if (this.timer >= telegraphDur) {
        this.phase = 'active';
        this.timer = 0;
        this.sentinel.setTelegraphGlow(false, false);
        this.fireProjectiles(ctx);
      }
      return null;
    }

    // ── Active ──────────────────────────────────────────────
    if (this.phase === 'active') {
      if (this.timer >= activeDur) {
        this.phase = 'recovery';
        this.timer = 0;
      }
      return null;
    }

    // ── Recovery ────────────────────────────────────────────
    if (this.timer >= recoveryDur) {
      return 'attack_cooldown';
    }
    return null;
  }

  exit(ctx: EnemyContext): void {
    this.sentinel.setTelegraphGlow(false, false);
    releaseAttackToken(ctx);
  }

  private fireProjectiles(ctx: EnemyContext): void {
    if (!this.currentAttack) return;
    const projData = this.currentAttack.projectile;
    if (!projData) return;

    const atk = this.currentAttack;
    const pos = ctx.enemy.getPosition();

    if (atk.id === 'scatter_shot') {
      // Fire 3 bolts in a spread: -15deg, 0deg, +15deg
      const spreadAngle = Math.PI / 12; // 15 degrees
      for (let i = -1; i <= 1; i++) {
        const dir = this.fireDir.clone();
        // Rotate direction by spread angle
        const cos = Math.cos(spreadAngle * i);
        const sin = Math.sin(spreadAngle * i);
        const rx = dir.x * cos - dir.z * sin;
        const rz = dir.x * sin + dir.z * cos;
        dir.x = rx;
        dir.z = rz;
        this.sentinel.fireProjectile(
          pos.clone().add(dir.clone().multiplyScalar(0.8)),
          dir,
          projData.speed,
          projData.lifetime / 1000,
          projData.size,
          atk.damage,
          atk.staggerDamage,
        );
      }
    } else {
      // Single shard bolt
      this.sentinel.fireProjectile(
        pos.clone().add(this.fireDir.clone().multiplyScalar(0.8)),
        this.fireDir.clone(),
        projData.speed,
        projData.lifetime / 1000,
        projData.size,
        atk.damage,
        atk.staggerDamage,
      );
    }
  }
}

/**
 * Attack cooldown: pause between attacks, face player.
 */
export class SentinelAttackCooldownState implements AIState<EnemyContext> {
  readonly name = 'attack_cooldown';
  private sentinel: CubeSentinel;
  private cooldown: number;
  private attackRange: number;
  private retreatRange: number;
  private timer = 0;

  constructor(sentinel: CubeSentinel, cooldownMs: number, attackRange: number, retreatRange: number) {
    this.sentinel = sentinel;
    this.cooldown = cooldownMs / 1000;
    this.attackRange = attackRange;
    this.retreatRange = retreatRange;
  }

  enter(_ctx: EnemyContext): void {
    this.timer = 0;
  }

  update(dt: number, ctx: EnemyContext): string | null {
    this.timer += dt;

    const dist = distToPlayer(ctx);

    // Face player while waiting
    _toPlayer.subVectors(ctx.playerPosition, ctx.enemy.getPosition());
    _toPlayer.y = 0;
    if (_toPlayer.lengthSq() > 0.001) {
      _toPlayer.normalize();
      this.sentinel.faceDirectionPublic(_toPlayer, dt);
    }

    if (dist < this.retreatRange) {
      return 'retreat';
    }

    if (this.timer >= this.cooldown) {
      if (dist <= this.attackRange) {
        return 'attack';
      }
      return 'alert';
    }

    return null;
  }

  exit(_ctx: EnemyContext): void {}
}

/**
 * Retreat: back away from the player to target distance.
 */
export class SentinelRetreatState implements AIState<EnemyContext> {
  readonly name = 'retreat';
  private sentinel: CubeSentinel;
  private targetDistance: number;
  private attackRange: number;

  constructor(sentinel: CubeSentinel, targetDistance: number, attackRange: number) {
    this.sentinel = sentinel;
    this.targetDistance = targetDistance;
    this.attackRange = attackRange;
  }

  enter(_ctx: EnemyContext): void {}

  update(dt: number, ctx: EnemyContext): string | null {
    const dist = distToPlayer(ctx);

    // Face the player while retreating
    _toPlayer.subVectors(ctx.playerPosition, ctx.enemy.getPosition());
    _toPlayer.y = 0;
    if (_toPlayer.lengthSq() > 0.001) {
      _toPlayer.normalize();
      this.sentinel.faceDirectionPublic(_toPlayer, dt);
    }

    if (dist >= this.targetDistance) {
      if (dist <= this.attackRange) {
        return 'attack';
      }
      return 'alert';
    }

    // Move away from player
    _retreatDir.copy(_toPlayer).negate();
    const step = ctx.enemy.stats.moveSpeed * dt;
    ctx.enemy.group.position.addScaledVector(_retreatDir, step);

    return null;
  }

  exit(_ctx: EnemyContext): void {}
}

/**
 * Staggered: stunned after poise break.
 */
export class SentinelStaggeredState implements AIState<EnemyContext> {
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
      return 'alert';
    }
    return null;
  }

  exit(_ctx: EnemyContext): void {}
}
