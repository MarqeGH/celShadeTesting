import * as THREE from 'three';
import { BaseEnemy } from '../BaseEnemy';
import { SphereShape, HitboxManager, Hitbox } from '../../combat/HitboxManager';
import { EnemyData, AttackDataSchema } from '../EnemyFactory';
import { EnemyRegistry } from '../EnemyRegistry';
import { EventBus } from '../../app/EventBus';
import { createCelMaterial } from '../../rendering/CelShadingPipeline';
import { ObjectPool } from '../../engine/ObjectPool';
import {
  SentinelIdleState,
  SentinelAlertState,
  SentinelAttackState,
  SentinelAttackCooldownState,
  SentinelRetreatState,
  SentinelStaggeredState,
} from './states';

// ── Constants ────────────────────────────────────────────────────

const CUBE_COLOR = new THREE.Color(0xcc8833);
const TELEGRAPH_FACE_COLOR = new THREE.Color(1.0, 0.6, 0.1);
const TELEGRAPH_ALL_COLOR = new THREE.Color(1.0, 0.5, 0.0);

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
