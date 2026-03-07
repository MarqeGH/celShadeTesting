import * as THREE from 'three';
import { BaseEnemy, EnemyContext } from './BaseEnemy';
import { SphereShape, HitboxManager, Hitbox } from '../combat/HitboxManager';
import { EnemyData, AttackDataSchema } from './EnemyFactory';
import { EnemyRegistry } from './EnemyRegistry';
import { EventBus } from '../app/EventBus';
import { AIState } from '../ai/AIState';
import { createCelMaterial } from '../rendering/CelShadingPipeline';

// ── Constants ────────────────────────────────────────────────────

const TRIANGLE_COLOR = new THREE.Color(0xcc4444);
const TELEGRAPH_COLOR = new THREE.Color(1.0, 0.15, 0.05);

// ── Scratch vectors ─────────────────────────────────────────────

const _toPlayer = new THREE.Vector3();

// ── Helper: pick a random attack from pool ──────────────────────

function pickAttack(attacks: AttackDataSchema[], pool: string[]): AttackDataSchema {
  const candidates = attacks.filter(a => pool.includes(a.id));
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ── FSM States ──────────────────────────────────────────────────

/**
 * Idle: wait until player enters aggro range.
 */
class ShardIdleState implements AIState<EnemyContext> {
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
class ShardChaseState implements AIState<EnemyContext> {
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
      return 'attack';
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
class ShardAttackState implements AIState<EnemyContext> {
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

    // Telegraph visual: glow red
    this.shard.setTelegraphGlow(true);
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
        this.shard.setTelegraphGlow(false);
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

  exit(_ctx: EnemyContext): void {
    this.removeHitbox();
    this.shard.setTelegraphGlow(false);
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
class ShardAttackCooldownState implements AIState<EnemyContext> {
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
class ShardStaggeredState implements AIState<EnemyContext> {
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

// ── Utility ─────────────────────────────────────────────────────

function distToPlayer(ctx: EnemyContext): number {
  const pos = ctx.enemy.getPosition();
  const dx = pos.x - ctx.playerPosition.x;
  const dz = pos.z - ctx.playerPosition.z;
  return Math.sqrt(dx * dx + dz * dz);
}

// ── TriangleShard class ─────────────────────────────────────────

export class TriangleShard extends BaseEnemy {
  readonly attackRange: number;
  private _hitboxMgr: HitboxManager;
  private _attacks: AttackDataSchema[];
  private baseColor: THREE.Color;

  constructor(
    data: EnemyData,
    position: THREE.Vector3,
    eventBus: EventBus,
    hitboxManager: HitboxManager,
  ) {
    super(
      data.id,
      {
        maxHp: data.stats.maxHP,
        moveSpeed: data.stats.moveSpeed,
        turnSpeed: data.stats.turnSpeed,
        poise: data.stats.poise,
        maxPoise: data.stats.poise,
        poiseRegenDelay: data.stats.poiseRegenDelay / 1000,
        poiseRegenRate: data.stats.poiseRegenRate,
      },
      eventBus,
      hitboxManager,
    );

    this.attackRange = data.perception.attackRange;
    this._hitboxMgr = hitboxManager;
    this._attacks = data.attacks;
    this.baseColor = TRIANGLE_COLOR.clone();

    this.group.position.copy(position);
    this.group.position.y = 0;

    this.initialize();
  }

  // ── Mesh creation ─────────────────────────────────────────────

  protected createMesh(): THREE.Mesh {
    // Flat isosceles triangle: ConeGeometry with 3 radial segments
    const geometry = new THREE.ConeGeometry(0.6, 1.2, 3, 1);

    // Flatten on Z-axis for blade-like thin profile
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const z = positions.getZ(i);
      positions.setZ(i, z * 0.3);
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();

    const material = createCelMaterial(this.baseColor);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.6;

    return mesh;
  }

  // ── Hurtbox ───────────────────────────────────────────────────

  protected getHurtboxShape(): SphereShape {
    return {
      type: 'sphere',
      center: this.group.position,
      radius: 0.7,
    };
  }

  // ── FSM ───────────────────────────────────────────────────────

  protected initFSM(): void {
    const aggroRange = 10;
    const attackRange = this.attackRange;
    const attackPool = ['lunge', 'slash'];
    const attackCooldown = 800;
    const staggerDuration = 1000;

    this.fsm
      .addState(new ShardIdleState(aggroRange))
      .addState(new ShardChaseState(this, aggroRange, attackRange))
      .addState(new ShardAttackState(this, this._hitboxMgr, this._attacks, attackPool))
      .addState(new ShardAttackCooldownState(this, attackCooldown, attackRange))
      .addState(new ShardStaggeredState(staggerDuration));

    this.fsm.setState('idle');
  }

  // ── Public wrappers for protected BaseEnemy helpers ────────────

  moveTowardPublic(target: THREE.Vector3, dt: number): void {
    this.moveToward(target, dt);
  }

  faceDirectionPublic(dir: THREE.Vector3, dt: number): void {
    this.faceDirection(dir, dt);
  }

  // ── Telegraph glow ────────────────────────────────────────────

  setTelegraphGlow(active: boolean): void {
    const mesh = this.group.children[0] as THREE.Mesh | undefined;
    if (!mesh) return;

    const mat = mesh.material;
    if (mat instanceof THREE.ShaderMaterial && mat.uniforms['uBaseColor']) {
      if (active) {
        mat.uniforms['uBaseColor'].value.copy(TELEGRAPH_COLOR);
      } else {
        mat.uniforms['uBaseColor'].value.copy(this.baseColor);
      }
    }
  }
}

// ── Register in EnemyRegistry ───────────────────────────────────

EnemyRegistry.register('triangle-shard', TriangleShard);
