import * as THREE from 'three';
import { AIState } from '../../ai/AIState';
import { EnemyContext } from '../BaseEnemy';
import { HitboxManager, SphereShape, Hitbox } from '../../combat/HitboxManager';
import { AttackDataSchema } from '../EnemyFactory';
import { distToPlayer, pickAttack } from '../shared';
import type { MonolithBrute } from './MonolithBrute';

// ── Scratch vectors ─────────────────────────────────────────────

const _toPlayer = new THREE.Vector3();

// ── Idle ────────────────────────────────────────────────────────

/**
 * Idle: wait until player enters aggro range.
 */
export class BruteIdleState implements AIState<EnemyContext> {
  readonly name = 'idle';
  private aggroRange: number;

  constructor(aggroRange: number) {
    this.aggroRange = aggroRange;
  }

  enter(_ctx: EnemyContext): void {}

  update(_dt: number, ctx: EnemyContext): string | null {
    if (distToPlayer(ctx) <= this.aggroRange) {
      return 'chase';
    }
    return null;
  }

  exit(_ctx: EnemyContext): void {}
}

// ── Chase ───────────────────────────────────────────────────────

/**
 * Chase: move toward player. When in attack range, pick slam/sweep/stomp.
 */
export class BruteChaseState implements AIState<EnemyContext> {
  readonly name = 'chase';

  private brute: MonolithBrute;
  private aggroRange: number;
  private attackRange: number;

  constructor(brute: MonolithBrute, aggroRange: number, attackRange: number) {
    this.brute = brute;
    this.aggroRange = aggroRange;
    this.attackRange = attackRange;
  }

  enter(_ctx: EnemyContext): void {}

  update(dt: number, ctx: EnemyContext): string | null {
    const dist = distToPlayer(ctx);

    // Drop aggro
    if (dist > this.aggroRange) {
      return 'idle';
    }

    // Face and move toward player
    _toPlayer.subVectors(ctx.playerPosition, ctx.enemy.getPosition());
    _toPlayer.y = 0;
    if (_toPlayer.lengthSq() > 0.001) {
      _toPlayer.normalize();
      this.brute.faceDirectionPublic(_toPlayer, dt);
    }
    this.brute.moveTowardPublic(ctx.playerPosition, dt);

    // Attack when in range
    if (dist <= this.attackRange) {
      const roll = Math.random();
      if (roll < 0.4) return 'slam';
      if (roll < 0.7) return 'sweep';
      return 'stomp';
    }

    return null;
  }

  exit(_ctx: EnemyContext): void {}
}

// ── Slam ────────────────────────────────────────────────────────

/**
 * Slam: rises up, crashes down. 800ms telegraph, 300ms active, 1000ms recovery.
 * 3m radius sphere centered on brute. 30 dmg.
 */
export class BruteSlamState implements AIState<EnemyContext> {
  readonly name = 'slam';

  private brute: MonolithBrute;
  private hitboxMgr: HitboxManager;
  private attacks: AttackDataSchema[];

  private attack: AttackDataSchema | null = null;
  private timer = 0;
  private phase: 'telegraph' | 'active' | 'recovery' = 'telegraph';
  private hitbox: Hitbox | null = null;

  constructor(brute: MonolithBrute, hitboxMgr: HitboxManager, attacks: AttackDataSchema[]) {
    this.brute = brute;
    this.hitboxMgr = hitboxMgr;
    this.attacks = attacks;
  }

  enter(ctx: EnemyContext): void {
    this.timer = 0;
    this.phase = 'telegraph';
    this.hitbox = null;
    this.attack = pickAttack(this.attacks, ['slam']);

    // Face the player
    _toPlayer.subVectors(ctx.playerPosition, ctx.enemy.getPosition());
    _toPlayer.y = 0;
    if (_toPlayer.lengthSq() > 0.001) {
      _toPlayer.normalize();
      ctx.enemy.group.rotation.y = Math.atan2(_toPlayer.x, _toPlayer.z);
    }

    this.brute.setTelegraphGlow(true);
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
        this.brute.setTelegraphGlow(false);
        this.createHitbox(ctx);
      }
      return null;
    }

    if (this.phase === 'active') {
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
    this.brute.setTelegraphGlow(false);
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

// ── Sweep ───────────────────────────────────────────────────────

/**
 * Sweep: 180° arc in front. 600ms telegraph, 400ms active, 700ms recovery.
 * 3.5m sphere offset forward. 20 dmg.
 */
export class BruteSweepState implements AIState<EnemyContext> {
  readonly name = 'sweep';

  private brute: MonolithBrute;
  private hitboxMgr: HitboxManager;
  private attacks: AttackDataSchema[];

  private attack: AttackDataSchema | null = null;
  private timer = 0;
  private phase: 'telegraph' | 'active' | 'recovery' = 'telegraph';
  private hitbox: Hitbox | null = null;
  private attackDir = new THREE.Vector3();

  constructor(brute: MonolithBrute, hitboxMgr: HitboxManager, attacks: AttackDataSchema[]) {
    this.brute = brute;
    this.hitboxMgr = hitboxMgr;
    this.attacks = attacks;
  }

  enter(ctx: EnemyContext): void {
    this.timer = 0;
    this.phase = 'telegraph';
    this.hitbox = null;
    this.attack = pickAttack(this.attacks, ['sweep']);

    // Face the player and lock attack direction
    _toPlayer.subVectors(ctx.playerPosition, ctx.enemy.getPosition());
    _toPlayer.y = 0;
    if (_toPlayer.lengthSq() > 0.001) {
      _toPlayer.normalize();
      ctx.enemy.group.rotation.y = Math.atan2(_toPlayer.x, _toPlayer.z);
    }
    this.attackDir.copy(_toPlayer);

    this.brute.setTelegraphGlow(true);
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
        this.brute.setTelegraphGlow(false);
        this.createHitbox(ctx);
      }
      return null;
    }

    if (this.phase === 'active') {
      // Move hitbox forward with the sweep
      if (this.hitbox && this.hitbox.shape.type === 'sphere') {
        const pos = ctx.enemy.getPosition();
        this.hitbox.shape.center.copy(pos);
        this.hitbox.shape.center.addScaledVector(this.attackDir, this.attack.range * 0.4);
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
    this.brute.setTelegraphGlow(false);
  }

  private createHitbox(ctx: EnemyContext): void {
    if (!this.attack) return;
    const pos = ctx.enemy.getPosition();

    const center = new THREE.Vector3().copy(pos);
    center.addScaledVector(this.attackDir, this.attack.range * 0.4);

    const shape: SphereShape = {
      type: 'sphere',
      center,
      radius: this.attack.range * 0.5,
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

// ── Stomp ───────────────────────────────────────────────────────

/**
 * Stomp: ground pound. 500ms telegraph, 200ms active, 600ms recovery.
 * 2m radius sphere centered on brute. 15 dmg.
 */
export class BruteStompState implements AIState<EnemyContext> {
  readonly name = 'stomp';

  private brute: MonolithBrute;
  private hitboxMgr: HitboxManager;
  private attacks: AttackDataSchema[];

  private attack: AttackDataSchema | null = null;
  private timer = 0;
  private phase: 'telegraph' | 'active' | 'recovery' = 'telegraph';
  private hitbox: Hitbox | null = null;

  constructor(brute: MonolithBrute, hitboxMgr: HitboxManager, attacks: AttackDataSchema[]) {
    this.brute = brute;
    this.hitboxMgr = hitboxMgr;
    this.attacks = attacks;
  }

  enter(ctx: EnemyContext): void {
    this.timer = 0;
    this.phase = 'telegraph';
    this.hitbox = null;
    this.attack = pickAttack(this.attacks, ['stomp']);

    // Face the player
    _toPlayer.subVectors(ctx.playerPosition, ctx.enemy.getPosition());
    _toPlayer.y = 0;
    if (_toPlayer.lengthSq() > 0.001) {
      _toPlayer.normalize();
      ctx.enemy.group.rotation.y = Math.atan2(_toPlayer.x, _toPlayer.z);
    }

    this.brute.setTelegraphGlow(true);
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
        this.brute.setTelegraphGlow(false);
        this.createHitbox(ctx);
      }
      return null;
    }

    if (this.phase === 'active') {
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
    this.brute.setTelegraphGlow(false);
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
 * Brief pause between attacks before returning to chase.
 */
export class BruteCooldownState implements AIState<EnemyContext> {
  readonly name = 'cooldown';
  private brute: MonolithBrute;
  private duration: number;
  private timer = 0;

  constructor(brute: MonolithBrute, durationMs: number) {
    this.brute = brute;
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
      this.brute.faceDirectionPublic(_toPlayer, dt);
    }

    if (this.timer >= this.duration) {
      return 'chase';
    }
    return null;
  }

  exit(_ctx: EnemyContext): void {}
}

// ── Staggered ───────────────────────────────────────────────────

/**
 * Poise broken: stunned with glowing crack. Takes 1.5x damage for the duration.
 */
export class BruteStaggeredState implements AIState<EnemyContext> {
  readonly name = 'staggered';
  private brute: MonolithBrute;
  private duration: number;
  private timer = 0;

  constructor(brute: MonolithBrute, durationMs: number) {
    this.brute = brute;
    this.duration = durationMs / 1000;
  }

  enter(_ctx: EnemyContext): void {
    this.timer = 0;
    this.brute.damageMultiplier = 1.5;
    this.brute.setCrackGlow(true);
  }

  update(dt: number, _ctx: EnemyContext): string | null {
    this.timer += dt;
    if (this.timer >= this.duration) {
      return 'chase';
    }
    return null;
  }

  exit(_ctx: EnemyContext): void {
    this.brute.damageMultiplier = 1.0;
    this.brute.setCrackGlow(false);
  }
}
