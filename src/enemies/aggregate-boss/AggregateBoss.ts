import * as THREE from 'three';
import { BaseEnemy } from '../BaseEnemy';
import { SphereShape, HitboxManager, Hitbox } from '../../combat/HitboxManager';
import { EnemyData, AttackDataSchema } from '../EnemyFactory';
import { EnemyRegistry } from '../EnemyRegistry';
import { EventBus } from '../../app/EventBus';
import { createCelMaterial } from '../../rendering/CelShadingPipeline';
import { ObjectPool } from '../../engine/ObjectPool';
import {
  AggregateIdleState,
  AggregateChaseState,
  AggregateMeleeSwipeState,
  AggregateChargeState,
  AggregateTriangleScatterState,
  AggregateCooldownState,
  AggregateStaggeredState,
  AggregatePhaseTransitionState,
} from './states';

// ── Constants ────────────────────────────────────────────────────

const BOSS_COLOR = new THREE.Color(0x993333);
const TELEGRAPH_RED = new THREE.Color(1.0, 0.15, 0.05);
const STAGGER_GLOW = new THREE.Color(1.0, 0.6, 0.2);
const PHASE_TRANSITION_WHITE = new THREE.Color(1.0, 0.95, 0.9);

// Phase HP thresholds (as fraction of maxHP)
const PHASE_2_THRESHOLD = 0.66;
const PHASE_3_THRESHOLD = 0.33;

// Cone jitter amplitude
const JITTER_AMPLITUDE = 0.015;

// Boss shatter constants
const BOSS_SHATTER_SPEED = 3;
const BOSS_SHATTER_GRAVITY = -8;
const BOSS_SHATTER_CLEANUP = 2.5;

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

// ── Boss shatter piece ──────────────────────────────────────────

interface BossShatterPiece {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
}

// ── Cone layout definition ──────────────────────────────────────

interface ConeLayout {
  position: [number, number, number];
  rotation: [number, number, number];
  radius: number;
  height: number;
}

const CLUSTER_LAYOUT: ConeLayout[] = [
  // Head
  { position: [0, 2.2, 0], rotation: [0, 0, 0], radius: 0.15, height: 0.5 },
  // Neck
  { position: [0, 1.9, 0], rotation: [Math.PI, 0, 0], radius: 0.2, height: 0.4 },
  // Torso front
  { position: [0, 1.4, 0.15], rotation: [0.3, 0, 0], radius: 0.25, height: 0.6 },
  // Torso back
  { position: [0, 1.4, -0.15], rotation: [-0.3, 0, 0], radius: 0.25, height: 0.6 },
  // Torso left
  { position: [-0.2, 1.3, 0], rotation: [0, 0, 0.4], radius: 0.2, height: 0.5 },
  // Torso right
  { position: [0.2, 1.3, 0], rotation: [0, 0, -0.4], radius: 0.2, height: 0.5 },
  // Left shoulder
  { position: [-0.6, 1.6, 0], rotation: [0, 0, Math.PI / 3], radius: 0.18, height: 0.5 },
  // Right shoulder
  { position: [0.6, 1.6, 0], rotation: [0, 0, -Math.PI / 3], radius: 0.18, height: 0.5 },
  // Left arm
  { position: [-0.8, 1.0, 0], rotation: [0, 0, Math.PI / 2], radius: 0.12, height: 0.6 },
  // Right arm
  { position: [0.8, 1.0, 0], rotation: [0, 0, -Math.PI / 2], radius: 0.12, height: 0.6 },
  // Left hip
  { position: [-0.25, 0.7, 0], rotation: [Math.PI, 0, 0.2], radius: 0.2, height: 0.5 },
  // Right hip
  { position: [0.25, 0.7, 0], rotation: [Math.PI, 0, -0.2], radius: 0.2, height: 0.5 },
  // Left leg
  { position: [-0.3, 0.2, 0], rotation: [Math.PI, 0, 0.1], radius: 0.15, height: 0.6 },
  // Right leg
  { position: [0.3, 0.2, 0], rotation: [Math.PI, 0, -0.1], radius: 0.15, height: 0.6 },
];

// ── AggregateBoss class ─────────────────────────────────────────

export class AggregateBoss extends BaseEnemy {
  private _hitboxMgr: HitboxManager;
  private _attacks: AttackDataSchema[];
  private baseColor: THREE.Color;
  private _scene: THREE.Scene | null = null;

  // Cluster cone meshes + their rest positions for jitter
  private clusterCones: THREE.Mesh[] = [];
  private coneRestPositions: THREE.Vector3[] = [];

  // Phase system
  currentPhase = 1;
  private _maxHp: number;
  private _phaseTransitioning = false;

  // Projectile pool
  private projectilePool: ObjectPool<Projectile>;
  private projectilesToRelease: Projectile[] = [];

  // Boss death
  private _bossDying = false;
  private _bossDeathTimer = 0;
  private _bossShatterPieces: BossShatterPiece[] = [];

  // Jitter timer
  private _jitterTime = 0;

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
    this.baseColor = BOSS_COLOR.clone();
    this._maxHp = data.stats.maxHP;

    this.group.position.copy(position);
    this.group.position.y = 0;

    // Create projectile pool
    const self = this;
    this.projectilePool = new ObjectPool<Projectile>(
      () => self.createProjectileInstance(),
      (p) => self.resetProjectileInstance(p),
      8,
    );

    this.initialize();
  }

  /** Set the scene reference so projectiles can be added/removed. */
  setScene(scene: THREE.Scene): void {
    this._scene = scene;
  }

  // ── Mesh creation ─────────────────────────────────────────────

  protected createMesh(): THREE.Mesh {
    // Build 14 cones arranged as a humanoid cluster
    for (const layout of CLUSTER_LAYOUT) {
      const geo = new THREE.ConeGeometry(layout.radius, layout.height, 4);
      const mat = createCelMaterial(this.baseColor.clone());
      const cone = new THREE.Mesh(geo, mat);

      cone.position.set(layout.position[0], layout.position[1], layout.position[2]);
      cone.rotation.set(layout.rotation[0], layout.rotation[1], layout.rotation[2]);

      this.clusterCones.push(cone);
      this.coneRestPositions.push(cone.position.clone());
      this.group.add(cone);
    }

    // Return the core torso cone as the "primary" mesh for BaseEnemy
    // (used for hit flash and original color storage)
    return this.clusterCones[2]; // torso front
  }

  // ── Hurtbox ───────────────────────────────────────────────────

  protected getHurtboxShape(): SphereShape {
    return {
      type: 'sphere',
      center: this.group.position,
      radius: 1.2,
    };
  }

  // ── FSM ───────────────────────────────────────────────────────

  protected initFSM(): void {
    const aggroRange = 20;
    const attackRange = 3.5;
    const cooldownDuration = 600;
    const staggerDuration = 2000;
    const phaseTransitionDuration = 1200;

    this.fsm
      .addState(new AggregateIdleState(aggroRange))
      .addState(new AggregateChaseState(this, aggroRange, attackRange))
      .addState(new AggregateMeleeSwipeState(this, this._hitboxMgr, this._attacks))
      .addState(new AggregateChargeState(this, this._hitboxMgr, this._attacks))
      .addState(new AggregateTriangleScatterState(this, this._attacks))
      .addState(new AggregateCooldownState(this, cooldownDuration))
      .addState(new AggregateStaggeredState(this, staggerDuration))
      .addState(new AggregatePhaseTransitionState(this, phaseTransitionDuration));

    this.fsm.setState('idle');
  }

  // ── Damage override (phase transitions) ────────────────────────

  override takeDamage(amount: number): number {
    const prevHp = this.stats.hp;
    const result = super.takeDamage(amount);

    // Check for phase transitions (only if alive and not already transitioning)
    if (!this.isDead() && !this._phaseTransitioning) {
      this.checkPhaseTransition(prevHp);
    }

    return result;
  }

  private checkPhaseTransition(_prevHp: number): void {
    const hpFraction = this.stats.hp / this._maxHp;

    let newPhase = this.currentPhase;

    if (hpFraction <= PHASE_3_THRESHOLD && this.currentPhase < 3) {
      newPhase = 3;
    } else if (hpFraction <= PHASE_2_THRESHOLD && this.currentPhase < 2) {
      newPhase = 2;
    }

    if (newPhase !== this.currentPhase) {
      this.currentPhase = newPhase;
      this._phaseTransitioning = true;
      this.fsm.setState('phase_transition');
    }
  }

  /** Called by PhaseTransitionState when transition completes. */
  onPhaseTransitionComplete(): void {
    this._phaseTransitioning = false;
  }

  // ── Public wrappers for protected BaseEnemy helpers ────────────

  moveTowardPublic(target: THREE.Vector3, dt: number): void {
    this.moveToward(target, dt);
  }

  faceDirectionPublic(dir: THREE.Vector3, dt: number): void {
    this.faceDirection(dir, dt);
  }

  moveByOffset(offset: THREE.Vector3): void {
    this.group.position.add(offset);
  }

  // ── Telegraph glow (all cones) ────────────────────────────────

  setTelegraphGlow(active: boolean): void {
    const color = active ? TELEGRAPH_RED : this.baseColor;
    this.setAllConesColor(color);
  }

  setStaggerGlow(active: boolean): void {
    const color = active ? STAGGER_GLOW : this.baseColor;
    this.setAllConesColor(color);
  }

  setPhaseTransitionGlow(active: boolean): void {
    const color = active ? PHASE_TRANSITION_WHITE : this.baseColor;
    this.setAllConesColor(color);
  }

  private setAllConesColor(color: THREE.Color): void {
    for (const cone of this.clusterCones) {
      const mat = cone.material;
      if (mat instanceof THREE.ShaderMaterial && mat.uniforms['uBaseColor']) {
        mat.uniforms['uBaseColor'].value.copy(color);
      }
    }
  }

  // ── Projectile system (same pattern as CubeSentinel) ──────────

  fireScatterProjectiles(
    origin: THREE.Vector3,
    directions: THREE.Vector3[],
    speed: number,
    lifetime: number,
    size: number,
    damage: number,
    staggerDamage: number,
  ): void {
    for (const dir of directions) {
      const proj = this.projectilePool.acquire();
      proj.active = true;
      proj.lifetime = 0;
      proj.maxLifetime = lifetime;
      proj.ownerId = this.entityId;

      // Set mesh transform
      proj.mesh.position.copy(origin);
      proj.mesh.position.y = 1.2; // fire from chest height
      proj.mesh.scale.setScalar(size / 0.15); // base cone is 0.3 wide (0.15 radius)
      proj.mesh.visible = true;

      // Set velocity
      proj.velocity.copy(dir).normalize().multiplyScalar(speed);

      // Create hitbox
      const center = proj.mesh.position.clone();
      const shape: SphereShape = { type: 'sphere', center, radius: size + 0.15 };
      proj.hitbox = this._hitboxMgr.createHitbox(
        this.entityId,
        Date.now() + Math.random() * 1000,
        shape,
        { damage, staggerDamage, knockback: 2 },
      );

      // Add to scene
      if (this._scene) {
        this._scene.add(proj.mesh);
      }
    }
  }

  updateProjectiles(dt: number): void {
    this.projectilesToRelease.length = 0;

    this.projectilePool.forEachActive((proj) => {
      if (!proj.active) return;

      proj.lifetime += dt;

      if (proj.lifetime >= proj.maxLifetime) {
        this.deactivateProjectile(proj);
        this.projectilesToRelease.push(proj);
        return;
      }

      // Move
      proj.mesh.position.addScaledVector(proj.velocity, dt);

      // Spin
      proj.mesh.rotation.x += dt * 6;
      proj.mesh.rotation.z += dt * 4;

      // Update hitbox center
      if (proj.hitbox && proj.hitbox.shape.type === 'sphere') {
        proj.hitbox.shape.center.copy(proj.mesh.position);
      }
    });

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
    const geo = new THREE.ConeGeometry(0.15, 0.4, 4);
    const mat = createCelMaterial(new THREE.Color(1.0, 0.3, 0.2));
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

  // ── Cone jitter (shifting, unstable cluster feel) ─────────────

  private updateConeJitter(dt: number): void {
    this._jitterTime += dt;

    for (let i = 0; i < this.clusterCones.length; i++) {
      const cone = this.clusterCones[i];
      const rest = this.coneRestPositions[i];

      // Use sin/cos with offset per cone for organic movement
      const offset = i * 1.7;
      const amp = JITTER_AMPLITUDE * (this.currentPhase === 3 ? 2.0 : 1.0);
      cone.position.x = rest.x + Math.sin(this._jitterTime * 8 + offset) * amp;
      cone.position.y = rest.y + Math.cos(this._jitterTime * 6 + offset * 1.3) * amp;
      cone.position.z = rest.z + Math.sin(this._jitterTime * 7 + offset * 0.9) * amp * 0.7;
    }
  }

  // ── Death ─────────────────────────────────────────────────────

  override die(): void {
    if (this.isDead() || this.isDying) return;

    // Hide all cluster cones
    for (const cone of this.clusterCones) {
      cone.visible = false;
    }

    // Create enhanced boss shatter
    this.createBossShatterEffect();

    this._bossDying = true;

    // Call base for standard cleanup (unregister, emit event, set dead flag)
    super.die();
  }

  private createBossShatterEffect(): void {
    const parent = this.group.parent;
    if (!parent) return;

    const groupPos = this.group.position;

    // Create cone-shaped shatter pieces matching the cluster theme
    for (let i = 0; i < this.clusterCones.length; i++) {
      const cone = this.clusterCones[i];
      const size = 0.08 + Math.random() * 0.12;
      const geo = new THREE.ConeGeometry(size, size * 2, 4);
      const mat = new THREE.MeshBasicMaterial({ color: this.baseColor.clone() });
      const piece = new THREE.Mesh(geo, mat);

      // Start at the cone's world position
      piece.position.set(
        cone.position.x + groupPos.x,
        cone.position.y + groupPos.y,
        cone.position.z + groupPos.z,
      );

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * BOSS_SHATTER_SPEED,
        Math.random() * BOSS_SHATTER_SPEED * 0.8 + 1.5,
        (Math.random() - 0.5) * BOSS_SHATTER_SPEED,
      );

      piece.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
      );

      parent.add(piece);
      this._bossShatterPieces.push({ mesh: piece, velocity });
    }
  }

  private updateBossShatter(dt: number): void {
    if (this._bossShatterPieces.length === 0) return;

    this._bossDeathTimer += dt;

    for (const piece of this._bossShatterPieces) {
      piece.velocity.y += BOSS_SHATTER_GRAVITY * dt;
      piece.mesh.position.addScaledVector(piece.velocity, dt);
      piece.mesh.rotation.x += dt * 3;
      piece.mesh.rotation.z += dt * 2;

      // Fade out via scale
      const t = this._bossDeathTimer / BOSS_SHATTER_CLEANUP;
      const scale = Math.max(0, 1 - t);
      piece.mesh.scale.setScalar(scale);
    }

    if (this._bossDeathTimer >= BOSS_SHATTER_CLEANUP) {
      this.cleanupBossShatter();
    }
  }

  private cleanupBossShatter(): void {
    for (const piece of this._bossShatterPieces) {
      piece.mesh.removeFromParent();
      (piece.mesh.geometry as THREE.BufferGeometry).dispose();
      (piece.mesh.material as THREE.Material).dispose();
    }
    this._bossShatterPieces.length = 0;
  }

  // ── Update override ────────────────────────────────────────────

  override update(dt: number, playerPosition: THREE.Vector3): void {
    // Update boss-specific death animation (before super, which returns early during dying)
    if (this._bossDying) {
      this.updateBossShatter(dt);
    }

    // Base handles FSM, poise regen, hit flash, and standard death animation
    super.update(dt, playerPosition);

    // Gameplay updates only when alive
    if (!this.isDead()) {
      this.updateProjectiles(dt);
      this.updateConeJitter(dt);
    }
  }

  // ── Dispose override ──────────────────────────────────────────

  override dispose(): void {
    // Clean up projectiles
    this.projectilePool.forEachActive((proj) => {
      this.deactivateProjectile(proj);
    });
    this.projectilePool.releaseAll();

    // Clean up boss shatter pieces
    this.cleanupBossShatter();

    // Dispose cluster cone geometries/materials
    for (const cone of this.clusterCones) {
      (cone.geometry as THREE.BufferGeometry).dispose();
      const mat = cone.material;
      if (Array.isArray(mat)) {
        mat.forEach(m => m.dispose());
      } else {
        (mat as THREE.Material).dispose();
      }
    }

    super.dispose();
  }
}

// ── Register in EnemyRegistry ───────────────────────────────────

EnemyRegistry.register('aggregate-boss', AggregateBoss);
