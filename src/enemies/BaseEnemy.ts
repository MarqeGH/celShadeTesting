import * as THREE from 'three';
import { StateMachine } from '../ai/StateMachine';
import { AggroCoordinator } from '../ai/AggroCoordinator';
import { HitboxManager, SphereShape } from '../combat/HitboxManager';
import { CombatEntity } from '../combat/CombatSystem';
import { EventBus } from '../app/EventBus';
import { SphereCollider, testSphereVsAABB, resolveCollision } from '../engine/CollisionSystem';
import { WallCollider } from '../world/RoomModule';
import { TelegraphVFX } from '../rendering/TelegraphVFX';

// ── Entity ID counter ───────────────────────────────────────────

let nextEnemyEntityId = 100;

/** Get a unique entity ID for a new enemy. */
export function allocateEnemyEntityId(): number {
  return nextEnemyEntityId++;
}

// ── Enemy stats ─────────────────────────────────────────────────

export interface EnemyStats {
  maxHp: number;
  hp: number;
  moveSpeed: number;
  turnSpeed: number;
  defense: number;          // damage reduction (0 = none, 100 = 50%)
  poise: number;
  maxPoise: number;
  poiseRegenDelay: number;  // seconds before poise starts recovering
  poiseRegenRate: number;   // poise/second
}

// ── Enemy context for FSM ───────────────────────────────────────

export interface EnemyContext {
  enemy: BaseEnemy;
  playerPosition: THREE.Vector3;
  /** Aggro coordinator for attack-token gating. Optional (absent in hub/test). */
  aggroCoordinator?: AggroCoordinator;
}

// ── Hit flash constants ─────────────────────────────────────────

const HIT_FLASH_DURATION = 0.12; // seconds
const HIT_FLASH_COLOR = new THREE.Color(1.0, 0.2, 0.2);

// ── Death shatter constants ─────────────────────────────────────

const DEATH_CLEANUP_DELAY = 1.5; // seconds before removing from scene
const SHATTER_PIECE_COUNT = 8;
const SHATTER_SPEED = 5;
const SHATTER_GRAVITY = -15;

// ── Shatter piece tracking ──────────────────────────────────────

interface ShatterPiece {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
}

// ── BaseEnemy abstract class ────────────────────────────────────

/**
 * Abstract base for all enemies.
 *
 * Owns: Three.js mesh, FSM, stats (HP, poise), hurtbox registration.
 * Subclasses must implement createMesh() and initFSM().
 */
export abstract class BaseEnemy implements CombatEntity {
  // CombatEntity fields
  readonly entityId: number;
  readonly type: 'enemy' = 'enemy';
  readonly stringId: string;

  // Scene
  readonly group: THREE.Group;
  protected mesh: THREE.Mesh | null = null;

  // Systems
  protected fsm: StateMachine<EnemyContext>;
  protected eventBus: EventBus;
  protected hitboxManager: HitboxManager;

  // Stats
  readonly stats: EnemyStats;

  // Poise regen timer
  private _poiseRegenTimer = 0;

  // Hit flash
  private _flashTimer = 0;
  private _originalColors: THREE.Color[] = [];
  private _isFlashing = false;

  // Death
  private _dead = false;
  private _dying = false;
  private _deathTimer = 0;
  private _shatterPieces: ShatterPiece[] = [];

  // Wall collision sphere
  private readonly _wallCollider: SphereCollider = {
    center: new THREE.Vector3(),
    radius: 0.8, // default, overridden in initialize() from hurtbox
  };

  // Telegraph VFX (color pulse + scale pulse)
  private telegraphVfx = new TelegraphVFX();

  // Stagger callback (set externally, e.g. by the stagger system or FSM)
  private _onStagger: (() => void) | null = null;

  constructor(
    id: string,
    stats: Omit<EnemyStats, 'hp'>,
    eventBus: EventBus,
    hitboxManager: HitboxManager,
  ) {
    this.entityId = allocateEnemyEntityId();
    this.stringId = `${id}_${this.entityId}`;
    this.eventBus = eventBus;
    this.hitboxManager = hitboxManager;

    this.stats = { ...stats, hp: stats.maxHp };
    this.group = new THREE.Group();

    // FSM with enemy context
    const context: EnemyContext = {
      enemy: this,
      playerPosition: new THREE.Vector3(),
    };
    this.fsm = new StateMachine<EnemyContext>(context);
  }

  // ── Lifecycle (called by subclass after super()) ──────────────

  /**
   * Subclasses call this in their constructor after super() to finish setup.
   * Creates mesh, registers hurtbox, and initializes FSM.
   */
  protected initialize(): void {
    this.mesh = this.createMesh();
    this.group.add(this.mesh);

    // Store original material colors for hit flash
    this.storeOriginalColors();

    // Register hurtbox (sphere around mesh center)
    const hurtboxShape = this.getHurtboxShape();
    this.hitboxManager.registerHurtbox(this.entityId, hurtboxShape);

    // Use hurtbox radius for wall collision sphere
    this._wallCollider.radius = hurtboxShape.radius;

    // Set up FSM states
    this.initFSM();
  }

  /** Create the enemy's visual mesh. Must return a Mesh added to scene. */
  protected abstract createMesh(): THREE.Mesh;

  /** Register FSM states and set initial state. */
  protected abstract initFSM(): void;

  /**
   * Returns the hurtbox shape. Override for custom shapes.
   * Default: sphere at group position with radius 0.8.
   */
  protected getHurtboxShape(): SphereShape {
    return {
      type: 'sphere',
      center: this.group.position,
      radius: 0.8,
    };
  }

  // ── CombatEntity interface ────────────────────────────────────

  getHp(): number {
    return this.stats.hp;
  }

  getMaxHp(): number {
    return this.stats.maxHp;
  }

  getDefense(): number {
    return this.stats.defense;
  }

  getPosition(): THREE.Vector3 {
    return this.group.position;
  }

  isDead(): boolean {
    return this._dead;
  }

  // ── Damage ────────────────────────────────────────────────────

  /**
   * Apply damage. Reduces HP, checks poise for stagger, triggers hit flash.
   * Returns remaining HP.
   */
  takeDamage(amount: number): number {
    if (this._dead || this._dying) return this.stats.hp;

    this.stats.hp = Math.max(0, this.stats.hp - amount);
    this.startHitFlash();

    if (this.stats.hp <= 0) {
      this.die();
    }

    return this.stats.hp;
  }

  /**
   * Apply poise damage (called separately from HP damage).
   * If poise breaks, triggers stagger and resets poise.
   */
  applyPoiseDamage(staggerDamage: number): void {
    if (this._dead || this._dying) return;

    this.stats.poise -= staggerDamage;
    this._poiseRegenTimer = 0;

    if (this.stats.poise <= 0) {
      this.stats.poise = this.stats.maxPoise;
      this.triggerStagger();
    }
  }

  /** Set the stagger callback (invoked when poise breaks). */
  setOnStagger(callback: () => void): void {
    this._onStagger = callback;
  }

  private triggerStagger(): void {
    // Release attack token on stagger (frees slot for another enemy)
    this.getFSMContext().aggroCoordinator?.releaseToken(this.entityId);

    if (this._onStagger) {
      this._onStagger();
    }
    // If FSM has a 'staggered' state, transition to it
    this.fsm.setState('staggered');
  }

  // ── Death ─────────────────────────────────────────────────────

  die(): void {
    if (this._dead || this._dying) return;

    // Clean up telegraph VFX before death
    this.endTelegraph();

    this._dying = true;
    this._dead = true;
    this._deathTimer = 0;

    // Release attack token on death
    this.getFSMContext().aggroCoordinator?.releaseToken(this.entityId);

    // Unregister from combat
    this.hitboxManager.unregisterHurtbox(this.entityId);
    this.hitboxManager.removeHitboxesByOwner(this.entityId);

    // Emit death event
    const pos = this.group.position;
    this.eventBus.emit('ENEMY_DIED', {
      enemyId: this.stringId,
      position: { x: pos.x, y: pos.y, z: pos.z },
    });

    // Create shatter effect
    this.createShatterEffect();

    // Hide original mesh
    if (this.mesh) {
      this.mesh.visible = false;
    }

    console.log(`[BaseEnemy] ${this.stringId} died`);
  }

  // ── Update ────────────────────────────────────────────────────

  /**
   * Per-frame update. Call with player position for AI context.
   */
  update(dt: number, playerPosition: THREE.Vector3): void {
    if (this._dying) {
      this.updateDeath(dt);
      return;
    }

    if (this._dead) return;

    // Update FSM context with current player position
    const ctx = this.getFSMContext();
    ctx.playerPosition.copy(playerPosition);
    this.fsm.update(dt);

    // Telegraph VFX (color pulse + scale pulse)
    this.telegraphVfx.update(dt);

    // Poise regen
    this.updatePoiseRegen(dt);

    // Hit flash
    this.updateHitFlash(dt);
  }

  // ── FSM context access ────────────────────────────────────────

  /** Get a reference to the FSM for direct state control. */
  getFSM(): StateMachine<EnemyContext> {
    return this.fsm;
  }

  /**
   * Attach an AggroCoordinator so this enemy's FSM states can request attack tokens.
   * Called by EncounterManager after spawning.
   */
  setAggroCoordinator(coordinator: AggroCoordinator): void {
    this.getFSMContext().aggroCoordinator = coordinator;
  }

  // ── Telegraph VFX ─────────────────────────────────────────────

  /**
   * Start a telegraph animation (color pulse + scale pulse).
   * Called by attack states during wind-up. Color codes:
   *   Red = melee, Orange = ranged, White = unblockable.
   */
  telegraph(color: THREE.Color, duration: number): void {
    if (this.mesh) {
      this.telegraphVfx.start(this.group, this.mesh, color, duration);
    }
  }

  /**
   * End the telegraph animation, restoring original color and scale.
   * Safe to call even if no telegraph is active.
   */
  endTelegraph(): void {
    this.telegraphVfx.end();
  }

  /** Get the FSM context (enemy ref + player position). */
  private getFSMContext(): EnemyContext {
    // Access the context via a state update — the StateMachine stores it internally
    // We need to update playerPosition before the FSM ticks
    // The context object was created in the constructor and is shared
    return (this.fsm as any).context as EnemyContext;
  }

  // ── Poise regen ───────────────────────────────────────────────

  private updatePoiseRegen(dt: number): void {
    if (this.stats.poise >= this.stats.maxPoise) return;

    this._poiseRegenTimer += dt;
    if (this._poiseRegenTimer >= this.stats.poiseRegenDelay) {
      this.stats.poise = Math.min(
        this.stats.maxPoise,
        this.stats.poise + this.stats.poiseRegenRate * dt,
      );
    }
  }

  // ── Hit flash ─────────────────────────────────────────────────

  private storeOriginalColors(): void {
    if (!this.mesh) return;

    const mat = this.mesh.material;
    if (mat instanceof THREE.ShaderMaterial && mat.uniforms['uBaseColor']) {
      this._originalColors = [(mat.uniforms['uBaseColor'].value as THREE.Color).clone()];
    } else if (mat instanceof THREE.MeshBasicMaterial || mat instanceof THREE.MeshStandardMaterial) {
      this._originalColors = [(mat as any).color.clone()];
    }
  }

  private startHitFlash(): void {
    this._flashTimer = HIT_FLASH_DURATION;
    this._isFlashing = true;
    this.setMeshColor(HIT_FLASH_COLOR);
  }

  private updateHitFlash(dt: number): void {
    if (!this._isFlashing) return;

    this._flashTimer -= dt;
    if (this._flashTimer <= 0) {
      this._isFlashing = false;
      this.restoreOriginalColors();
    }
  }

  private setMeshColor(color: THREE.Color): void {
    if (!this.mesh) return;

    const mat = this.mesh.material;
    if (mat instanceof THREE.ShaderMaterial && mat.uniforms['uBaseColor']) {
      mat.uniforms['uBaseColor'].value.copy(color);
    } else if (mat instanceof THREE.MeshBasicMaterial || mat instanceof THREE.MeshStandardMaterial) {
      (mat as any).color.copy(color);
    }
  }

  private restoreOriginalColors(): void {
    if (this._originalColors.length > 0) {
      this.setMeshColor(this._originalColors[0]);
    }
  }

  // ── Death shatter effect ──────────────────────────────────────

  private createShatterEffect(): void {
    if (!this.mesh) return;

    const pos = this.mesh.position.clone().add(this.group.position);
    const color = this._originalColors.length > 0
      ? this._originalColors[0]
      : new THREE.Color(0x888888);

    for (let i = 0; i < SHATTER_PIECE_COUNT; i++) {
      const size = 0.1 + Math.random() * 0.15;
      const geo = new THREE.TetrahedronGeometry(size);
      const mat = new THREE.MeshBasicMaterial({ color: color.clone() });
      const piece = new THREE.Mesh(geo, mat);

      piece.position.copy(pos);
      piece.position.y += 0.5; // offset to center of mesh

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * SHATTER_SPEED,
        Math.random() * SHATTER_SPEED * 0.8 + 2,
        (Math.random() - 0.5) * SHATTER_SPEED,
      );

      piece.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
      );

      this.group.parent?.add(piece);
      this._shatterPieces.push({ mesh: piece, velocity });
    }
  }

  private updateDeath(dt: number): void {
    this._deathTimer += dt;

    // Animate shatter pieces
    for (const piece of this._shatterPieces) {
      piece.velocity.y += SHATTER_GRAVITY * dt;
      piece.mesh.position.addScaledVector(piece.velocity, dt);
      piece.mesh.rotation.x += dt * 5;
      piece.mesh.rotation.z += dt * 3;

      // Fade out via scale
      const t = this._deathTimer / DEATH_CLEANUP_DELAY;
      const scale = Math.max(0, 1 - t);
      piece.mesh.scale.setScalar(scale);
    }

    // Cleanup after delay
    if (this._deathTimer >= DEATH_CLEANUP_DELAY) {
      this.cleanupDeath();
    }
  }

  private cleanupDeath(): void {
    this._dying = false;

    // Remove shatter pieces
    for (const piece of this._shatterPieces) {
      piece.mesh.removeFromParent();
      (piece.mesh.geometry as THREE.BufferGeometry).dispose();
      (piece.mesh.material as THREE.Material).dispose();
    }
    this._shatterPieces.length = 0;

    // Remove group from scene
    this.group.removeFromParent();
  }

  // ── Disposal ──────────────────────────────────────────────────

  /** Full cleanup. Call when removing enemy from the game. */
  dispose(): void {
    this.hitboxManager.unregisterHurtbox(this.entityId);
    this.hitboxManager.removeHitboxesByOwner(this.entityId);

    // Cleanup shatter pieces
    for (const piece of this._shatterPieces) {
      piece.mesh.removeFromParent();
      (piece.mesh.geometry as THREE.BufferGeometry).dispose();
      (piece.mesh.material as THREE.Material).dispose();
    }
    this._shatterPieces.length = 0;

    // Cleanup mesh
    if (this.mesh) {
      (this.mesh.geometry as THREE.BufferGeometry).dispose();
      const mat = this.mesh.material;
      if (Array.isArray(mat)) {
        mat.forEach(m => m.dispose());
      } else {
        mat.dispose();
      }
    }

    this.group.removeFromParent();
  }

  // ── Helpers for subclasses ────────────────────────────────────

  /** Move toward a target position at the enemy's move speed. */
  protected moveToward(target: THREE.Vector3, dt: number): void {
    const dir = _moveDir.subVectors(target, this.group.position);
    dir.y = 0; // ground plane only
    const dist = dir.length();
    if (dist < 0.1) return;

    dir.normalize();
    const step = this.stats.moveSpeed * dt;
    if (step >= dist) {
      this.group.position.x = target.x;
      this.group.position.z = target.z;
    } else {
      this.group.position.addScaledVector(dir, step);
    }

    // Rotate to face movement direction
    this.faceDirection(dir, dt);
  }

  /** Rotate the group to face a direction vector (ground plane). */
  protected faceDirection(dir: THREE.Vector3, dt: number): void {
    const targetAngle = Math.atan2(dir.x, dir.z);
    const currentAngle = this.group.rotation.y;

    // Shortest arc
    let delta = targetAngle - currentAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;

    const maxTurn = (this.stats.turnSpeed * Math.PI / 180) * dt;
    if (Math.abs(delta) <= maxTurn) {
      this.group.rotation.y = targetAngle;
    } else {
      this.group.rotation.y += Math.sign(delta) * maxTurn;
    }
  }

  /**
   * Resolve sphere-vs-AABB collisions against wall colliders.
   * Call once per frame after all movement has been applied.
   */
  resolveWallCollisions(walls: WallCollider[]): void {
    if (this._dead || this._dying) return;

    const pos = this.group.position;
    this._wallCollider.center.set(pos.x, pos.y, pos.z);

    for (const wall of walls) {
      const result = testSphereVsAABB(this._wallCollider, wall);
      if (result.hit) {
        resolveCollision(pos, result);
        this._wallCollider.center.set(pos.x, pos.y, pos.z);
      }
    }
  }

  /** Get distance to a point (ground plane). */
  protected distanceTo(target: THREE.Vector3): number {
    const dx = this.group.position.x - target.x;
    const dz = this.group.position.z - target.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /** Check if currently in the dying/dead animation. */
  get isDying(): boolean {
    return this._dying;
  }
}

// ── Scratch vectors (avoid allocation in hot path) ──────────────

const _moveDir = new THREE.Vector3();
