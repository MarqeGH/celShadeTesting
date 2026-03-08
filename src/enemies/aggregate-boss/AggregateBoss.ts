import * as THREE from 'three';
import { BaseEnemy } from '../BaseEnemy';
import { SphereShape, HitboxManager, Hitbox } from '../../combat/HitboxManager';
import { EnemyData, AttackDataSchema } from '../EnemyFactory';
import { EnemyRegistry } from '../EnemyRegistry';
import { EventBus } from '../../app/EventBus';
import { CombatSystem } from '../../combat/CombatSystem';
import { StaggerSystem } from '../../combat/StaggerSystem';
import { createCelMaterial } from '../../rendering/CelShadingPipeline';
import { ObjectPool } from '../../engine/ObjectPool';
import { TriangleShard } from '../triangle-shard/TriangleShard';
import {
  AggregateIdleState,
  AggregateChaseState,
  AggregateMeleeSwipeState,
  AggregateChargeState,
  AggregateTriangleScatterState,
  AggregateCooldownState,
  AggregateStaggeredState,
  AggregatePhaseTransitionState,
  AggregateSplitState,
  AggregateReformState,
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

// Split/reform constants
const SPLIT_DURATION = 8; // seconds
const SPLIT_COOLDOWN = 5; // seconds after reform before next split
const SPLIT_MINION_HP = 15;
const SPLIT_MIN_COUNT = 3;
const SPLIT_MAX_COUNT = 5;
const SPLIT_SPAWN_RADIUS = 3; // spread radius around boss position
const REFORM_DURATION = 1; // seconds for reform animation

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

  // Split/reform system
  private _combatSystem: CombatSystem | null = null;
  private _staggerSystem: StaggerSystem | null = null;
  private _splitMinions: TriangleShard[] = [];
  private _isSplit = false;
  private _splitTimer = 0;
  private _splitCooldown = 0;
  private _minionData: EnemyData | null = null;
  private _minionKillCount = 0;
  private _minionDeathListener: ((data: { enemyId: string }) => void) | null = null;
  private _minionEntityIds: Set<string> = new Set();
  private _reforming = false;
  private _reformTimer = 0;
  // Player position cache for minion updates during split
  private _lastPlayerPosition = new THREE.Vector3();

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

  /** Set combat/stagger system refs for split minion spawning. */
  setSpawnSystems(combatSystem: CombatSystem, staggerSystem: StaggerSystem): void {
    this._combatSystem = combatSystem;
    this._staggerSystem = staggerSystem;
  }

  /** Preload TriangleShard JSON for split minion creation. */
  async preloadMinionData(): Promise<void> {
    try {
      const resp = await fetch('/data/enemies/triangle-shard.json');
      this._minionData = await resp.json();
    } catch (err) {
      console.warn('[AggregateBoss] Failed to preload minion data:', err);
    }
  }

  /** Whether the boss can currently split (Phase 2+, not already split, off cooldown). */
  canSplit(): boolean {
    return (
      this.currentPhase >= 2 &&
      !this._isSplit &&
      this._splitCooldown <= 0 &&
      this._minionData !== null &&
      this._combatSystem !== null &&
      this._staggerSystem !== null &&
      this._scene !== null
    );
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
      .addState(new AggregatePhaseTransitionState(this, phaseTransitionDuration))
      .addState(new AggregateSplitState(this))
      .addState(new AggregateReformState(this));

    this.fsm.setState('idle');
  }

  // ── Damage override (phase transitions) ────────────────────────

  override takeDamage(amount: number): number {
    // Boss is invulnerable while split into minions
    if (this._isSplit) return this.stats.hp;

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

  // ── Split/reform mechanic ────────────────────────────────────

  /** Split the boss into TriangleShard minions. Called by AggregateSplitState. */
  performSplit(): void {
    if (!this._minionData || !this._combatSystem || !this._staggerSystem || !this._scene) return;

    // Hide all cluster cones
    for (const cone of this.clusterCones) {
      cone.visible = false;
    }

    // Temporarily unregister boss hurtbox
    this.hitboxManager.unregisterHurtbox(this.entityId);

    // Determine minion count (3–5)
    const count = SPLIT_MIN_COUNT + Math.floor(Math.random() * (SPLIT_MAX_COUNT - SPLIT_MIN_COUNT + 1));
    const bossPos = this.group.position;

    this._splitMinions = [];
    this._minionEntityIds.clear();
    this._minionKillCount = 0;

    for (let i = 0; i < count; i++) {
      // Create modified data with reduced HP
      const data: EnemyData = JSON.parse(JSON.stringify(this._minionData));
      data.stats.maxHP = SPLIT_MINION_HP;

      // Spawn position: spread around boss position in a circle
      const angle = (i / count) * Math.PI * 2;
      const spawnPos = new THREE.Vector3(
        bossPos.x + Math.cos(angle) * SPLIT_SPAWN_RADIUS,
        0,
        bossPos.z + Math.sin(angle) * SPLIT_SPAWN_RADIUS,
      );

      const minion = new TriangleShard(data, spawnPos, this.eventBus, this.hitboxManager);
      this._scene.add(minion.group);
      this._combatSystem.registerEntity(minion);

      // Register poise with StaggerSystem
      this._staggerSystem.register(
        minion.entityId,
        {
          maxPoise: data.stats.poise,
          regenDelay: data.stats.poiseRegenDelay / 1000,
          regenRate: data.stats.poiseRegenRate,
        },
        () => minion.getFSM().setState('staggered'),
      );

      this._splitMinions.push(minion);
      this._minionEntityIds.add(minion.stringId);
    }

    this._isSplit = true;
    this._splitTimer = SPLIT_DURATION;

    // Listen for minion deaths
    this._minionDeathListener = (data: { enemyId: string }) => {
      if (this._minionEntityIds.has(data.enemyId)) {
        this._minionKillCount++;
      }
    };
    this.eventBus.on('ENEMY_DIED', this._minionDeathListener);

    console.log(`[AggregateBoss] Split into ${count} minions`);
  }

  /**
   * Update the split phase. Returns true when split should end.
   * Called by AggregateSplitState.
   */
  updateSplitPhase(dt: number, playerPosition: THREE.Vector3): boolean {
    this._splitTimer -= dt;

    // Update alive minions
    for (const minion of this._splitMinions) {
      if (!minion.isDead()) {
        minion.update(dt, playerPosition);
      }
    }

    // Check end conditions
    const allDead = this._splitMinions.every(m => m.isDead());
    const timerExpired = this._splitTimer <= 0;
    const phase3EarlyReform = this.currentPhase >= 3 && this._minionKillCount >= 1;

    return allDead || timerExpired || phase3EarlyReform;
  }

  /** Reform the boss from split minions. Called by AggregateReformState. */
  performReform(): void {
    // Calculate center of remaining alive minions
    const aliveMinions = this._splitMinions.filter(m => !m.isDead());
    const center = new THREE.Vector3();

    if (aliveMinions.length > 0) {
      for (const minion of aliveMinions) {
        center.add(minion.getPosition());
      }
      center.divideScalar(aliveMinions.length);
    } else {
      center.copy(this.group.position);
    }
    center.y = 0;

    // Kill remaining alive minions and clean up all
    for (const minion of this._splitMinions) {
      if (!minion.isDead()) {
        minion.die();
      }
      // Unregister from systems
      if (this._combatSystem) {
        this._combatSystem.unregisterEntity(minion.entityId);
      }
      if (this._staggerSystem) {
        this._staggerSystem.unregister(minion.entityId);
      }
      // Remove from scene (dispose handles geometry/material cleanup)
      minion.dispose();
    }
    this._splitMinions = [];
    this._minionEntityIds.clear();

    // Unsubscribe from death events
    if (this._minionDeathListener) {
      this.eventBus.off('ENEMY_DIED', this._minionDeathListener);
      this._minionDeathListener = null;
    }

    // Move boss to center of where minions were
    this.group.position.copy(center);

    // Show cluster cones
    for (const cone of this.clusterCones) {
      cone.visible = true;
    }

    // Re-register boss hurtbox
    const hurtboxShape = this.getHurtboxShape();
    this.hitboxManager.registerHurtbox(this.entityId, hurtboxShape);

    this._isSplit = false;
    this._splitCooldown = SPLIT_COOLDOWN;
    this._reforming = true;
    this._reformTimer = 0;

    console.log('[AggregateBoss] Reforming');
  }

  /**
   * Update reform animation. Returns true when reform is complete.
   * Cones expand outward then snap back to rest positions over REFORM_DURATION.
   */
  updateReformAnimation(dt: number): boolean {
    this._reformTimer += dt;
    const t = Math.min(this._reformTimer / REFORM_DURATION, 1);

    // Animate cones: start spread out, converge to rest positions
    // Use ease-in curve (starts slow, accelerates)
    const progress = t * t;

    for (let i = 0; i < this.clusterCones.length; i++) {
      const cone = this.clusterCones[i];
      const rest = this.coneRestPositions[i];

      // Start offset = rest * 3 (spread out), lerp to rest
      const spread = 3 - progress * 2; // goes from 3 → 1
      cone.position.x = rest.x * spread;
      cone.position.y = rest.y * spread;
      cone.position.z = rest.z * spread;
    }

    if (t >= 1) {
      // Snap to exact rest positions
      for (let i = 0; i < this.clusterCones.length; i++) {
        this.clusterCones[i].position.copy(this.coneRestPositions[i]);
      }
      this._reforming = false;
      return true;
    }
    return false;
  }

  /** Whether the boss is currently split. */
  get isSplit(): boolean {
    return this._isSplit;
  }

  /** Whether the boss is currently reforming. */
  get isReforming(): boolean {
    return this._reforming;
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

    // Clean up split minions if dying during split
    if (this._isSplit) {
      for (const minion of this._splitMinions) {
        if (!minion.isDead()) {
          minion.die();
        }
        if (this._combatSystem) this._combatSystem.unregisterEntity(minion.entityId);
        if (this._staggerSystem) this._staggerSystem.unregister(minion.entityId);
        minion.dispose();
      }
      this._splitMinions = [];
      this._minionEntityIds.clear();
      this._isSplit = false;

      if (this._minionDeathListener) {
        this.eventBus.off('ENEMY_DIED', this._minionDeathListener);
        this._minionDeathListener = null;
      }

      // Re-show cones so the shatter effect works
      for (const cone of this.clusterCones) {
        cone.visible = true;
      }
      // Re-register hurtbox so base die() can unregister it cleanly
      const hurtboxShape = this.getHurtboxShape();
      this.hitboxManager.registerHurtbox(this.entityId, hurtboxShape);
    }

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
    // Cache player position for split phase
    this._lastPlayerPosition.copy(playerPosition);

    // Update boss-specific death animation (before super, which returns early during dying)
    if (this._bossDying) {
      this.updateBossShatter(dt);
    }

    // Base handles FSM, poise regen, hit flash, and standard death animation
    super.update(dt, playerPosition);

    // Gameplay updates only when alive
    if (!this.isDead()) {
      // Decrement split cooldown
      if (this._splitCooldown > 0) {
        this._splitCooldown -= dt;
      }

      this.updateProjectiles(dt);

      // Skip cone jitter while split or reforming (reform has its own animation)
      if (!this._isSplit && !this._reforming) {
        this.updateConeJitter(dt);
      }
    }
  }

  // ── Dispose override ──────────────────────────────────────────

  override dispose(): void {
    // Clean up split minions
    for (const minion of this._splitMinions) {
      if (!minion.isDead()) minion.die();
      if (this._combatSystem) this._combatSystem.unregisterEntity(minion.entityId);
      if (this._staggerSystem) this._staggerSystem.unregister(minion.entityId);
      minion.dispose();
    }
    this._splitMinions = [];
    if (this._minionDeathListener) {
      this.eventBus.off('ENEMY_DIED', this._minionDeathListener);
      this._minionDeathListener = null;
    }

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
