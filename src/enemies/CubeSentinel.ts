import * as THREE from 'three';
import { BaseEnemy, EnemyContext } from './BaseEnemy';
import { SphereShape, HitboxManager, Hitbox } from '../combat/HitboxManager';
import { EnemyData, AttackDataSchema } from './EnemyFactory';
import { EnemyRegistry } from './EnemyRegistry';
import { EventBus } from '../app/EventBus';
import { AIState } from '../ai/AIState';
import { createCelMaterial } from '../rendering/CelShadingPipeline';
import { ObjectPool } from '../engine/ObjectPool';

// ── Constants ────────────────────────────────────────────────────

const CUBE_COLOR = new THREE.Color(0xcc8833);
const TELEGRAPH_FACE_COLOR = new THREE.Color(1.0, 0.6, 0.1);
const TELEGRAPH_ALL_COLOR = new THREE.Color(1.0, 0.5, 0.0);
const IDLE_ROTATION_SPEED = 0.5; // rad/s

// ── Scratch vectors ─────────────────────────────────────────────

const _toPlayer = new THREE.Vector3();
const _retreatDir = new THREE.Vector3();

// ── Projectile ──────────────────────────────────────────────────

interface Projectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  lifetime: number;
  maxLifetime: number;
  hitbox: Hitbox | null;
  active: boolean;
  ownerId: number;
}

// ── Helper ──────────────────────────────────────────────────────

function distToPlayer(ctx: EnemyContext): number {
  const pos = ctx.enemy.getPosition();
  const dx = pos.x - ctx.playerPosition.x;
  const dz = pos.z - ctx.playerPosition.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function pickAttack(attacks: AttackDataSchema[], pool: string[]): AttackDataSchema {
  const candidates = attacks.filter(a => pool.includes(a.id));
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ── FSM States ──────────────────────────────────────────────────

/**
 * Idle: slowly rotate on Y-axis. Aggro when player enters range.
 */
class SentinelIdleState implements AIState<EnemyContext> {
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
class SentinelAlertState implements AIState<EnemyContext> {
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
      return 'attack';
    }

    return null;
  }

  exit(_ctx: EnemyContext): void {}
}

/**
 * Attack: telegraph → fire projectile(s) → recovery.
 */
class SentinelAttackState implements AIState<EnemyContext> {
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

    // Telegraph glow
    const isScatter = this.currentAttack?.id === 'scatter_shot';
    this.sentinel.setTelegraphGlow(true, isScatter);
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

  exit(_ctx: EnemyContext): void {
    this.sentinel.setTelegraphGlow(false, false);
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
class SentinelAttackCooldownState implements AIState<EnemyContext> {
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
class SentinelRetreatState implements AIState<EnemyContext> {
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
class SentinelStaggeredState implements AIState<EnemyContext> {
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

// ── CubeSentinel class ──────────────────────────────────────────

export class CubeSentinel extends BaseEnemy {
  private _hitboxMgr: HitboxManager;
  private _attacks: AttackDataSchema[];
  private baseColor: THREE.Color;
  private _scene: THREE.Scene | null = null;

  // Projectile pool and active tracking
  private projectilePool: ObjectPool<Projectile>;
  private projectilesToRelease: Projectile[] = [];

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

    this._hitboxMgr = hitboxManager;
    this._attacks = data.attacks;
    this.baseColor = CUBE_COLOR.clone();

    this.group.position.copy(position);
    this.group.position.y = 0;

    // Create projectile pool
    const self = this;
    this.projectilePool = new ObjectPool<Projectile>(
      () => self.createProjectileInstance(),
      (p) => self.resetProjectileInstance(p),
      6,
    );

    this.initialize();
  }

  /** Set the scene reference so projectiles can be added/removed. */
  setScene(scene: THREE.Scene): void {
    this._scene = scene;
  }

  // ── Mesh creation ─────────────────────────────────────────────

  protected createMesh(): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
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
      radius: 0.8,
    };
  }

  // ── FSM ───────────────────────────────────────────────────────

  protected initFSM(): void {
    const aggroRange = 15;
    const attackRange = 12;
    const retreatRange = 4;
    const targetRetreatDist = 10;
    const attackCooldown = 600;
    const staggerDuration = 800;
    const attackPool = ['shard_bolt', 'scatter_shot'];

    this.fsm
      .addState(new SentinelIdleState(aggroRange))
      .addState(new SentinelAlertState(this, aggroRange, attackRange, retreatRange))
      .addState(new SentinelAttackState(this, this._attacks, attackPool, retreatRange))
      .addState(new SentinelAttackCooldownState(this, attackCooldown, attackRange, retreatRange))
      .addState(new SentinelRetreatState(this, targetRetreatDist, attackRange))
      .addState(new SentinelStaggeredState(staggerDuration));

    this.fsm.setState('idle');
  }

  // ── Public helpers for FSM states ─────────────────────────────

  moveTowardPublic(target: THREE.Vector3, dt: number): void {
    this.moveToward(target, dt);
  }

  faceDirectionPublic(dir: THREE.Vector3, dt: number): void {
    this.faceDirection(dir, dt);
  }

  // ── Telegraph glow ────────────────────────────────────────────

  setTelegraphGlow(active: boolean, allFaces: boolean): void {
    const mesh = this.group.children[0] as THREE.Mesh | undefined;
    if (!mesh) return;

    const mat = mesh.material;
    if (mat instanceof THREE.ShaderMaterial && mat.uniforms['uBaseColor']) {
      if (active) {
        mat.uniforms['uBaseColor'].value.copy(allFaces ? TELEGRAPH_ALL_COLOR : TELEGRAPH_FACE_COLOR);
      } else {
        mat.uniforms['uBaseColor'].value.copy(this.baseColor);
      }
    }
  }

  // ── Projectile system ─────────────────────────────────────────

  fireProjectile(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    speed: number,
    lifetime: number,
    size: number,
    damage: number,
    staggerDamage: number,
  ): void {
    const proj = this.projectilePool.acquire();
    proj.active = true;
    proj.lifetime = 0;
    proj.maxLifetime = lifetime;
    proj.ownerId = this.entityId;

    // Set mesh transform
    proj.mesh.position.copy(origin);
    proj.mesh.position.y = 0.8; // fire from mid-height
    proj.mesh.scale.setScalar(size / 0.2); // base mesh is 0.4 wide (0.2 radius)
    proj.mesh.visible = true;

    // Set velocity
    proj.velocity.copy(direction).normalize().multiplyScalar(speed);

    // Create hitbox for this projectile
    const center = proj.mesh.position.clone();
    const shape: SphereShape = { type: 'sphere', center, radius: size + 0.15 };
    proj.hitbox = this._hitboxMgr.createHitbox(
      this.entityId,
      Date.now() + Math.random() * 1000, // unique attack instance
      shape,
      { damage, staggerDamage, knockback: 2 },
    );

    // Add to scene
    if (this._scene) {
      this._scene.add(proj.mesh);
    }
  }

  /** Update all active projectiles. Called from the overridden update(). */
  updateProjectiles(dt: number): void {
    this.projectilesToRelease.length = 0;

    this.projectilePool.forEachActive((proj) => {
      if (!proj.active) return;

      proj.lifetime += dt;

      // Despawn after lifetime
      if (proj.lifetime >= proj.maxLifetime) {
        this.deactivateProjectile(proj);
        this.projectilesToRelease.push(proj);
        return;
      }

      // Move
      proj.mesh.position.addScaledVector(proj.velocity, dt);

      // Spin for visual effect
      proj.mesh.rotation.x += dt * 5;
      proj.mesh.rotation.y += dt * 7;

      // Update hitbox center to follow projectile
      if (proj.hitbox && proj.hitbox.shape.type === 'sphere') {
        proj.hitbox.shape.center.copy(proj.mesh.position);
      }
    });

    // Release despawned projectiles
    for (const proj of this.projectilesToRelease) {
      this.projectilePool.release(proj);
    }
  }

  private deactivateProjectile(proj: Projectile): void {
    proj.active = false;
    proj.mesh.visible = false;
    proj.mesh.removeFromParent();

    if (proj.hitbox) {
      this._hitboxMgr.removeHitbox(proj.hitbox);
      proj.hitbox = null;
    }
  }

  private createProjectileInstance(): Projectile {
    const geo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const mat = createCelMaterial(new THREE.Color(1.0, 0.7, 0.2));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;

    return {
      mesh,
      velocity: new THREE.Vector3(),
      lifetime: 0,
      maxLifetime: 2,
      hitbox: null,
      active: false,
      ownerId: this.entityId,
    };
  }

  private resetProjectileInstance(proj: Projectile): void {
    proj.active = false;
    proj.lifetime = 0;
    proj.maxLifetime = 2;
    proj.velocity.set(0, 0, 0);
    proj.mesh.visible = false;
    proj.mesh.position.set(0, 0, 0);
    proj.mesh.scale.setScalar(1);
    proj.hitbox = null;
  }

  // ── Override update to include projectiles ────────────────────

  override update(dt: number, playerPosition: THREE.Vector3): void {
    super.update(dt, playerPosition);
    this.updateProjectiles(dt);
  }

  // ── Override dispose to clean up projectiles ──────────────────

  override dispose(): void {
    // Clean up all active projectiles
    this.projectilePool.forEachActive((proj) => {
      this.deactivateProjectile(proj);
    });
    this.projectilePool.releaseAll();

    super.dispose();
  }
}

// ── Register in EnemyRegistry ───────────────────────────────────

EnemyRegistry.register('cube-sentinel', CubeSentinel);
