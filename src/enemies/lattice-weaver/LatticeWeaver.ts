import * as THREE from 'three';
import { BaseEnemy } from '../BaseEnemy';
import { SphereShape, HitboxManager, Hitbox } from '../../combat/HitboxManager';
import { EnemyData, AttackDataSchema } from '../EnemyFactory';
import { EnemyRegistry } from '../EnemyRegistry';
import { EventBus } from '../../app/EventBus';
import { createCelMaterial } from '../../rendering/CelShadingPipeline';
import { ObjectPool } from '../../engine/ObjectPool';
import {
  WeaverIdleState,
  WeaverPositionState,
  WeaverWebDeployState,
  WeaverNodeBurstState,
  WeaverCooldownState,
  WeaverAloneAggroState,
  WeaverStaggeredState,
} from './states';

// ── Constants ────────────────────────────────────────────────────

const WEAVER_COLOR = new THREE.Color(0x44aaaa);
const TELEGRAPH_RED = new THREE.Color(1.0, 0.15, 0.05);
const ZONE_COLOR = 0x44aaaa;
const BOB_AMPLITUDE = 0.15;
const BOB_FREQUENCY = 2;
const BOB_BASE_HEIGHT = 0.5;
const ZONE_DAMAGE_TICK = 1.0;
const MAX_ZONES = 2;

// ── Zone interface ───────────────────────────────────────────────

interface DamageZone {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  radius: number;
  damagePerTick: number;
  lifetime: number;
  maxLifetime: number;
  tickTimer: number;
  hitbox: Hitbox | null;
  active: boolean;
}

// ── Projectile interface ─────────────────────────────────────────

interface Projectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  lifetime: number;
  maxLifetime: number;
  hitbox: Hitbox | null;
  active: boolean;
  ownerId: number;
}

// ── LatticeWeaver class ──────────────────────────────────────────

export class LatticeWeaver extends BaseEnemy {
  private _hitboxMgr: HitboxManager;
  private _attacks: AttackDataSchema[];
  private baseColor: THREE.Color;
  private _scene: THREE.Scene | null = null;
  private bobTime = 0;
  private edgeLines: THREE.LineSegments | null = null;

  // Zone system
  private zones: DamageZone[] = [];

  // Projectile pool
  private projectilePool: ObjectPool<Projectile>;
  private projectilesToRelease: Projectile[] = [];

  // Alone detection callback
  private _aliveCountFn: (() => number) | null = null;

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
        defense: data.stats.defense ?? 0,
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
    this.baseColor = WEAVER_COLOR.clone();

    this.group.position.copy(position);
    this.group.position.y = 0;

    // Create projectile pool (8 slots for 6-projectile ring with overlap room)
    const self = this;
    this.projectilePool = new ObjectPool<Projectile>(
      () => self.createProjectileInstance(),
      (p) => self.resetProjectileInstance(p),
      8,
    );

    this.initialize();
  }

  /** Set the scene reference for projectiles and zones. */
  setScene(scene: THREE.Scene): void {
    this._scene = scene;
  }

  /** Set a callback that returns the alive enemy count in this wave. */
  setAliveCountFn(fn: () => number): void {
    this._aliveCountFn = fn;
  }

  /** Check if this is the last enemy alive. */
  isLastAlive(): boolean {
    if (!this._aliveCountFn) return false;
    return this._aliveCountFn() <= 1;
  }

  /** Get all attack data. */
  getAttacks(): AttackDataSchema[] {
    return this._attacks;
  }

  // ── Mesh creation ─────────────────────────────────────────────

  protected createMesh(): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = createCelMaterial(this.baseColor);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = BOB_BASE_HEIGHT + 0.5;

    // Add wireframe edges for distinctive lattice look
    const edgesGeo = new THREE.EdgesGeometry(geometry);
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x88dddd });
    this.edgeLines = new THREE.LineSegments(edgesGeo, edgesMat);
    this.edgeLines.position.copy(mesh.position);
    this.group.add(this.edgeLines);

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
    const aggroRange = 14;
    const positionRange = 7;
    const cooldownDuration = 1200;
    const staggerDuration = 1000;

    this.fsm
      .addState(new WeaverIdleState(aggroRange))
      .addState(new WeaverPositionState(this, aggroRange, positionRange))
      .addState(new WeaverWebDeployState(this, this._hitboxMgr, this._attacks))
      .addState(new WeaverNodeBurstState(this, this._attacks))
      .addState(new WeaverCooldownState(this, cooldownDuration))
      .addState(new WeaverAloneAggroState(this, this._attacks))
      .addState(new WeaverStaggeredState(staggerDuration));

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

  setTelegraphGlow(active: boolean): void {
    const mesh = this.group.children[0] as THREE.Mesh | undefined;
    if (!mesh) return;

    const mat = mesh.material;
    if (mat instanceof THREE.ShaderMaterial && mat.uniforms['uBaseColor']) {
      if (active) {
        mat.uniforms['uBaseColor'].value.copy(TELEGRAPH_RED);
      } else {
        mat.uniforms['uBaseColor'].value.copy(this.baseColor);
      }
    }

    // Also tint edge lines
    if (this.edgeLines) {
      const edgeMat = this.edgeLines.material as THREE.LineBasicMaterial;
      edgeMat.color.set(active ? 0xff3311 : 0x88dddd);
    }
  }

  // ── Zone system ───────────────────────────────────────────────

  /** Get number of active zones. */
  getActiveZoneCount(): number {
    return this.zones.filter((z) => z.active).length;
  }

  /** Deploy a damage zone at target position on the ground. */
  deployZone(targetPosition: THREE.Vector3): void {
    // Remove oldest zone if at max
    if (this.getActiveZoneCount() >= MAX_ZONES) {
      const oldest = this.zones.find((z) => z.active);
      if (oldest) this.deactivateZone(oldest);
    }

    const radius = 4;
    const dps = 5;
    const duration = 8;

    // Create zone visual — flat ring on ground
    const ringGeo = new THREE.RingGeometry(radius - 0.3, radius, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: ZONE_COLOR,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(targetPosition.x, 0.05, targetPosition.z);

    // Add inner fill
    const fillGeo = new THREE.CircleGeometry(radius - 0.3, 32);
    const fillMat = new THREE.MeshBasicMaterial({
      color: ZONE_COLOR,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
    const fillMesh = new THREE.Mesh(fillGeo, fillMat);
    ringMesh.add(fillMesh);

    if (this._scene) {
      this._scene.add(ringMesh);
    }

    // Create initial DOT hitbox
    const zonePos = new THREE.Vector3(targetPosition.x, 0, targetPosition.z);
    const shape: SphereShape = { type: 'sphere', center: zonePos.clone(), radius };
    const hitbox = this._hitboxMgr.createHitbox(
      this.entityId,
      Date.now() + Math.random() * 10000,
      shape,
      { damage: dps, staggerDamage: 0, knockback: 0 },
    );

    this.zones.push({
      mesh: ringMesh,
      position: zonePos,
      radius,
      damagePerTick: dps,
      lifetime: 0,
      maxLifetime: duration,
      tickTimer: 0,
      hitbox,
      active: true,
    });
  }

  /** Update all active zones (called from update()). */
  private updateZones(dt: number): void {
    for (const zone of this.zones) {
      if (!zone.active) continue;

      zone.lifetime += dt;

      if (zone.lifetime >= zone.maxLifetime) {
        this.deactivateZone(zone);
        continue;
      }

      // DOT tick — cycle hitbox for repeated damage
      zone.tickTimer += dt;
      if (zone.tickTimer >= ZONE_DAMAGE_TICK) {
        zone.tickTimer -= ZONE_DAMAGE_TICK;

        if (zone.hitbox) {
          this._hitboxMgr.removeHitbox(zone.hitbox);
        }
        const shape: SphereShape = {
          type: 'sphere',
          center: zone.position.clone(),
          radius: zone.radius,
        };
        zone.hitbox = this._hitboxMgr.createHitbox(
          this.entityId,
          Date.now() + Math.random() * 10000,
          shape,
          { damage: zone.damagePerTick, staggerDamage: 0, knockback: 0 },
        );
      }

      // Pulse opacity
      const pulse = 0.3 + 0.15 * Math.sin(zone.lifetime * 4);
      const mat = zone.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = pulse;

      // Fade out in last 2 seconds
      const remaining = zone.maxLifetime - zone.lifetime;
      if (remaining < 2) {
        mat.opacity *= remaining / 2;
      }
    }

    // Remove inactive zones from array
    this.zones = this.zones.filter((z) => z.active);
  }

  private deactivateZone(zone: DamageZone): void {
    zone.active = false;
    zone.mesh.removeFromParent();
    zone.mesh.geometry.dispose();
    (zone.mesh.material as THREE.Material).dispose();

    for (const child of zone.mesh.children) {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }

    if (zone.hitbox) {
      this._hitboxMgr.removeHitbox(zone.hitbox);
      zone.hitbox = null;
    }
  }

  // ── Projectile system ─────────────────────────────────────────

  /** Fire a ring of 6 projectiles outward from current position. */
  fireNodeBurst(
    damage: number,
    staggerDamage: number,
    speed: number,
    lifetime: number,
    size: number,
  ): void {
    const pos = this.getPosition();
    const count = 6;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));

      this.fireProjectile(
        pos.clone().add(dir.clone().multiplyScalar(0.6)),
        dir,
        speed,
        lifetime,
        size,
        damage,
        staggerDamage,
      );
    }
  }

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

    proj.mesh.position.copy(origin);
    proj.mesh.position.y = BOB_BASE_HEIGHT + 0.5;
    proj.mesh.scale.setScalar(size / 0.15);
    proj.mesh.visible = true;

    proj.velocity.copy(direction).normalize().multiplyScalar(speed);

    const center = proj.mesh.position.clone();
    const shape: SphereShape = { type: 'sphere', center, radius: size + 0.1 };
    proj.hitbox = this._hitboxMgr.createHitbox(
      this.entityId,
      Date.now() + Math.random() * 10000,
      shape,
      { damage, staggerDamage, knockback: 1 },
    );

    if (this._scene) {
      this._scene.add(proj.mesh);
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

      proj.mesh.position.addScaledVector(proj.velocity, dt);
      proj.mesh.rotation.x += dt * 4;
      proj.mesh.rotation.z += dt * 6;

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
    const geo = new THREE.SphereGeometry(0.15, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0x66dddd });
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

  // ── Update override ───────────────────────────────────────────

  override update(dt: number, playerPosition: THREE.Vector3): void {
    super.update(dt, playerPosition);

    // Sinusoidal bob
    this.bobTime += dt;
    const bobOffset = BOB_AMPLITUDE * Math.sin(this.bobTime * BOB_FREQUENCY * Math.PI * 2);
    const meshY = BOB_BASE_HEIGHT + 0.5 + bobOffset;
    const mesh = this.group.children[0] as THREE.Mesh | undefined;
    if (mesh) mesh.position.y = meshY;
    if (this.edgeLines) this.edgeLines.position.y = meshY;

    this.updateProjectiles(dt);
    this.updateZones(dt);
  }

  // ── Dispose override ──────────────────────────────────────────

  override dispose(): void {
    // Clean up projectiles
    this.projectilePool.forEachActive((proj) => {
      this.deactivateProjectile(proj);
    });
    this.projectilePool.releaseAll();

    // Clean up zones
    for (const zone of this.zones) {
      if (zone.active) this.deactivateZone(zone);
    }
    this.zones = [];

    // Clean up edge lines
    if (this.edgeLines) {
      this.edgeLines.geometry.dispose();
      (this.edgeLines.material as THREE.Material).dispose();
      this.edgeLines = null;
    }

    super.dispose();
  }
}

// ── Register in EnemyRegistry ───────────────────────────────────

EnemyRegistry.register('lattice-weaver', LatticeWeaver);
