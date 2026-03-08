import * as THREE from 'three';
import { AIState } from '../../ai/AIState';
import { EnemyContext } from '../BaseEnemy';
import { HitboxManager, SphereShape, Hitbox } from '../../combat/HitboxManager';
import { AttackDataSchema } from '../EnemyFactory';
import { distToPlayer, pickAttack } from '../shared';
import type { AggregateBoss } from './AggregateBoss';

// ── Scratch vectors ─────────────────────────────────────────────

const _toPlayer = new THREE.Vector3();
const _dashDir = new THREE.Vector3();
const _scatterDir = new THREE.Vector3();

// ── Idle ────────────────────────────────────────────────────────

export class AggregateIdleState implements AIState<EnemyContext> {
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

export class AggregateChaseState implements AIState<EnemyContext> {
  readonly name = 'chase';

  private boss: AggregateBoss;
  private aggroRange: number;
  private attackRange: number;

  constructor(boss: AggregateBoss, aggroRange: number, attackRange: number) {
    this.boss = boss;
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
      this.boss.faceDirectionPublic(_toPlayer, dt);
    }
    this.boss.moveTowardPublic(ctx.playerPosition, dt);

    // Attack selection based on phase
    if (dist <= this.attackRange) {
      return this.pickAttackForPhase(dist);
    }

    // Phase 2+: can charge from longer range
    if (this.boss.currentPhase >= 2 && dist > 4 && dist <= 10) {
      const chargeRoll = Math.random();
      if (chargeRoll < 0.3) {
        return 'charge';
      }
    }

    return null;
  }

  exit(_ctx: EnemyContext): void {}

  private pickAttackForPhase(dist: number): string {
    const phase = this.boss.currentPhase;

    if (phase === 1) {
      return 'melee_swipe';
    }

    // Phase 2 and 3: weighted selection
    const roll = Math.random();
    if (roll < 0.5) {
      return 'melee_swipe';
    }
    if (roll < 0.75 && dist > 4) {
      return 'charge';
    }
    if (roll < 0.75) {
      // Too close for charge, use swipe
      return 'melee_swipe';
    }
    return 'triangle_scatter';
  }
}

// ── Melee Swipe (Phase 1+) ──────────────────────────────────────

export class AggregateMeleeSwipeState implements AIState<EnemyContext> {
  readonly name = 'melee_swipe';

  private boss: AggregateBoss;
  private hitboxMgr: HitboxManager;
  private attacks: AttackDataSchema[];

  private attack: AttackDataSchema | null = null;
  private timer = 0;
  private phase: 'telegraph' | 'active' | 'recovery' = 'telegraph';
  private hitbox: Hitbox | null = null;

  constructor(boss: AggregateBoss, hitboxMgr: HitboxManager, attacks: AttackDataSchema[]) {
    this.boss = boss;
    this.hitboxMgr = hitboxMgr;
    this.attacks = attacks;
  }

  enter(ctx: EnemyContext): void {
    this.timer = 0;
    this.phase = 'telegraph';
    this.hitbox = null;
    this.attack = pickAttack(this.attacks, ['melee_swipe']);

    // Face the player
    _toPlayer.subVectors(ctx.playerPosition, ctx.enemy.getPosition());
    _toPlayer.y = 0;
    if (_toPlayer.lengthSq() > 0.001) {
      _toPlayer.normalize();
      ctx.enemy.group.rotation.y = Math.atan2(_toPlayer.x, _toPlayer.z);
    }

    this.boss.setTelegraphGlow(true);
  }

  update(dt: number, ctx: EnemyContext): string | null {
    if (!this.attack) return 'cooldown';

    this.timer += dt;

    // Phase 3: reduce telegraph by 100ms
    const telegraphReduction = this.boss.currentPhase === 3 ? 0.1 : 0;
    const telegraphDur = this.attack.telegraphDuration / 1000 - telegraphReduction;
    const activeDur = this.attack.activeDuration / 1000;
    const recoveryDur = this.attack.recoveryDuration / 1000;

    if (this.phase === 'telegraph') {
      if (this.timer >= telegraphDur) {
        this.phase = 'active';
        this.timer = 0;
        this.boss.setTelegraphGlow(false);
        this.createHitbox(ctx);
      }
      return null;
    }

    if (this.phase === 'active') {
      // Keep hitbox centered on boss
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
    this.boss.setTelegraphGlow(false);
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

// ── Charge (Phase 2+) ───────────────────────────────────────────

export class AggregateChargeState implements AIState<EnemyContext> {
  readonly name = 'charge';

  private boss: AggregateBoss;
  private hitboxMgr: HitboxManager;
  private attacks: AttackDataSchema[];

  private attack: AttackDataSchema | null = null;
  private timer = 0;
  private phase: 'telegraph' | 'active' | 'recovery' = 'telegraph';
  private hitbox: Hitbox | null = null;
  private chargeDir = new THREE.Vector3();
  private chargeDistance = 0;
  private chargeSpeed = 0;

  constructor(boss: AggregateBoss, hitboxMgr: HitboxManager, attacks: AttackDataSchema[]) {
    this.boss = boss;
    this.hitboxMgr = hitboxMgr;
    this.attacks = attacks;
  }

  enter(ctx: EnemyContext): void {
    this.timer = 0;
    this.phase = 'telegraph';
    this.hitbox = null;
    this.chargeDistance = 0;
    this.attack = pickAttack(this.attacks, ['charge']);

    // Face the player and lock charge direction
    _toPlayer.subVectors(ctx.playerPosition, ctx.enemy.getPosition());
    _toPlayer.y = 0;
    if (_toPlayer.lengthSq() > 0.001) {
      _toPlayer.normalize();
      ctx.enemy.group.rotation.y = Math.atan2(_toPlayer.x, _toPlayer.z);
    }
    this.chargeDir.copy(_toPlayer);

    if (this.attack?.movementDuringAttack) {
      this.chargeSpeed = this.attack.movementDuringAttack.speed;
    }

    this.boss.setTelegraphGlow(true);
  }

  update(dt: number, ctx: EnemyContext): string | null {
    if (!this.attack) return 'cooldown';

    this.timer += dt;

    const telegraphReduction = this.boss.currentPhase === 3 ? 0.1 : 0;
    const telegraphDur = this.attack.telegraphDuration / 1000 - telegraphReduction;
    const activeDur = this.attack.activeDuration / 1000;
    const recoveryDur = this.attack.recoveryDuration / 1000;

    if (this.phase === 'telegraph') {
      if (this.timer >= telegraphDur) {
        this.phase = 'active';
        this.timer = 0;
        this.boss.setTelegraphGlow(false);
        this.createHitbox(ctx);
      }
      return null;
    }

    if (this.phase === 'active') {
      // Dash forward
      const step = this.chargeSpeed * dt;
      const maxDist = this.attack.movementDuringAttack?.distance ?? 8;
      if (this.chargeDistance < maxDist) {
        _dashDir.copy(this.chargeDir).multiplyScalar(step);
        this.boss.moveByOffset(_dashDir);
        this.chargeDistance += step;
      }

      // Move hitbox with boss
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
    this.boss.setTelegraphGlow(false);
  }

  private createHitbox(ctx: EnemyContext): void {
    if (!this.attack) return;
    const pos = ctx.enemy.getPosition();

    const shape: SphereShape = {
      type: 'sphere',
      center: new THREE.Vector3().copy(pos),
      radius: 1.5,
    };

    this.hitbox = this.hitboxMgr.createHitbox(
      ctx.enemy.entityId,
      Date.now(),
      shape,
      {
        damage: this.attack.damage,
        staggerDamage: this.attack.staggerDamage,
        knockback: 3,
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

// ── Triangle Scatter (Phase 2+) ─────────────────────────────────

export class AggregateTriangleScatterState implements AIState<EnemyContext> {
  readonly name = 'triangle_scatter';

  private boss: AggregateBoss;
  private attacks: AttackDataSchema[];

  private attack: AttackDataSchema | null = null;
  private timer = 0;
  private phase: 'telegraph' | 'active' | 'recovery' = 'telegraph';
  private fired = false;

  constructor(boss: AggregateBoss, attacks: AttackDataSchema[]) {
    this.boss = boss;
    this.attacks = attacks;
  }

  enter(ctx: EnemyContext): void {
    this.timer = 0;
    this.phase = 'telegraph';
    this.fired = false;
    this.attack = pickAttack(this.attacks, ['triangle_scatter']);

    // Face the player
    _toPlayer.subVectors(ctx.playerPosition, ctx.enemy.getPosition());
    _toPlayer.y = 0;
    if (_toPlayer.lengthSq() > 0.001) {
      _toPlayer.normalize();
      ctx.enemy.group.rotation.y = Math.atan2(_toPlayer.x, _toPlayer.z);
    }

    this.boss.setTelegraphGlow(true);
  }

  update(dt: number, ctx: EnemyContext): string | null {
    if (!this.attack) return 'cooldown';

    this.timer += dt;

    const telegraphReduction = this.boss.currentPhase === 3 ? 0.1 : 0;
    const telegraphDur = this.attack.telegraphDuration / 1000 - telegraphReduction;
    const activeDur = this.attack.activeDuration / 1000;
    const recoveryDur = this.attack.recoveryDuration / 1000;

    if (this.phase === 'telegraph') {
      if (this.timer >= telegraphDur) {
        this.phase = 'active';
        this.timer = 0;
        this.boss.setTelegraphGlow(false);
      }
      return null;
    }

    if (this.phase === 'active') {
      // Fire projectiles once
      if (!this.fired) {
        this.fireProjectiles(ctx);
        this.fired = true;
      }
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

  exit(_ctx: EnemyContext): void {
    this.boss.setTelegraphGlow(false);
  }

  private fireProjectiles(ctx: EnemyContext): void {
    if (!this.attack) return;

    const pos = ctx.enemy.getPosition();
    const facing = ctx.enemy.group.rotation.y;

    // 4 directions offset from facing: +-45 and +-135 degrees
    const angles = [
      facing + Math.PI / 4,
      facing - Math.PI / 4,
      facing + (3 * Math.PI) / 4,
      facing - (3 * Math.PI) / 4,
    ];

    const directions: THREE.Vector3[] = [];
    for (const angle of angles) {
      _scatterDir.set(Math.sin(angle), 0, Math.cos(angle));
      directions.push(_scatterDir.clone());
    }

    const proj = this.attack.projectile;
    const speed = proj?.speed ?? 12;
    const lifetime = (proj?.lifetime ?? 2000) / 1000;
    const size = proj?.size ?? 0.3;

    this.boss.fireScatterProjectiles(
      pos,
      directions,
      speed,
      lifetime,
      size,
      this.attack.damage,
      this.attack.staggerDamage,
    );
  }
}

// ── Cooldown ────────────────────────────────────────────────────

export class AggregateCooldownState implements AIState<EnemyContext> {
  readonly name = 'cooldown';
  private boss: AggregateBoss;
  private duration: number;
  private timer = 0;

  constructor(boss: AggregateBoss, durationMs: number) {
    this.boss = boss;
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
      this.boss.faceDirectionPublic(_toPlayer, dt);
    }

    if (this.timer >= this.duration) {
      return 'chase';
    }
    return null;
  }

  exit(_ctx: EnemyContext): void {}
}

// ── Staggered ───────────────────────────────────────────────────

export class AggregateStaggeredState implements AIState<EnemyContext> {
  readonly name = 'staggered';
  private boss: AggregateBoss;
  private duration: number;
  private timer = 0;

  constructor(boss: AggregateBoss, durationMs: number) {
    this.boss = boss;
    this.duration = durationMs / 1000;
  }

  enter(_ctx: EnemyContext): void {
    this.timer = 0;
    this.boss.setStaggerGlow(true);
  }

  update(dt: number, _ctx: EnemyContext): string | null {
    this.timer += dt;
    if (this.timer >= this.duration) {
      return 'chase';
    }
    return null;
  }

  exit(_ctx: EnemyContext): void {
    this.boss.setStaggerGlow(false);
  }
}

// ── Phase Transition ────────────────────────────────────────────

export class AggregatePhaseTransitionState implements AIState<EnemyContext> {
  readonly name = 'phase_transition';
  private boss: AggregateBoss;
  private duration: number;
  private timer = 0;

  constructor(boss: AggregateBoss, durationMs: number) {
    this.boss = boss;
    this.duration = durationMs / 1000;
  }

  enter(_ctx: EnemyContext): void {
    this.timer = 0;
    this.boss.setPhaseTransitionGlow(true);
  }

  update(dt: number, _ctx: EnemyContext): string | null {
    this.timer += dt;
    if (this.timer >= this.duration) {
      return 'chase';
    }
    return null;
  }

  exit(_ctx: EnemyContext): void {
    this.boss.setPhaseTransitionGlow(false);
    this.boss.onPhaseTransitionComplete();
  }
}
