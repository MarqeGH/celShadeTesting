import * as THREE from 'three';
import {
  AABB,
  SphereCollider,
  testSphereVsSphere,
  testSphereVsAABB,
  testAABBvsAABB,
} from '../engine/CollisionSystem';

// ── Attack data carried by a hitbox ──────────────────────────────

export interface AttackData {
  damage: number;
  staggerDamage: number;
  knockback: number;
}

// ── Hitbox shape variants ────────────────────────────────────────

export interface SphereShape {
  type: 'sphere';
  center: THREE.Vector3;
  radius: number;
}

export interface AABBShape {
  type: 'aabb';
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export type HitboxShape = SphereShape | AABBShape;

// ── Hitbox (temporary, active during attack window) ──────────────

export interface Hitbox {
  id: number;
  ownerId: number;
  attackInstanceId: number;
  shape: HitboxShape;
  active: boolean;
  attackData: AttackData;
  /** Entity IDs already hit by this attack instance (one-hit enforcement) */
  alreadyHit: Set<number>;
}

// ── Hurtbox (persistent on damageable entities) ──────────────────

export interface Hurtbox {
  entityId: number;
  shape: HitboxShape;
}

// ── Hit result emitted on overlap ────────────────────────────────

export interface HitResult {
  attackerId: number;
  defenderId: number;
  attackData: AttackData;
  hitboxId: number;
  attackInstanceId: number;
}

// ── Callback type ────────────────────────────────────────────────

export type OnHitCallback = (hit: HitResult) => void;

// ── HitboxManager ────────────────────────────────────────────────

let nextHitboxId = 1;

/**
 * Manages hitbox/hurtbox registration and per-frame overlap detection.
 *
 * Hitboxes are temporary collision volumes created during attack active windows.
 * Hurtboxes are persistent collision volumes on damageable entities.
 *
 * Each frame, all active hitboxes are tested against all hurtboxes.
 * Hits register once per attack instance per target (no double-hits).
 */
export class HitboxManager {
  private hitboxes: Hitbox[] = [];
  private hurtboxes = new Map<number, Hurtbox>();
  private onHitCallback: OnHitCallback | null = null;

  /** Set the callback invoked when a hit is detected. */
  setOnHitCallback(callback: OnHitCallback): void {
    this.onHitCallback = callback;
  }

  // ── Hitbox lifecycle ─────────────────────────────────────────

  /**
   * Create a new hitbox. Starts active by default.
   * Returns the hitbox handle for later update/deactivation/removal.
   */
  createHitbox(
    ownerId: number,
    attackInstanceId: number,
    shape: HitboxShape,
    attackData: AttackData,
  ): Hitbox {
    const hitbox: Hitbox = {
      id: nextHitboxId++,
      ownerId,
      attackInstanceId,
      shape,
      active: true,
      attackData,
      alreadyHit: new Set(),
    };
    this.hitboxes.push(hitbox);
    return hitbox;
  }

  /** Activate a hitbox (start detecting overlaps). */
  activateHitbox(hitbox: Hitbox): void {
    hitbox.active = true;
  }

  /** Deactivate a hitbox (stop detecting overlaps, keep registered). */
  deactivateHitbox(hitbox: Hitbox): void {
    hitbox.active = false;
  }

  /** Remove a hitbox entirely. */
  removeHitbox(hitbox: Hitbox): void {
    const idx = this.hitboxes.indexOf(hitbox);
    if (idx !== -1) {
      this.hitboxes.splice(idx, 1);
    }
  }

  /** Remove all hitboxes belonging to a specific owner. */
  removeHitboxesByOwner(ownerId: number): void {
    for (let i = this.hitboxes.length - 1; i >= 0; i--) {
      if (this.hitboxes[i].ownerId === ownerId) {
        this.hitboxes.splice(i, 1);
      }
    }
  }

  // ── Hurtbox lifecycle ────────────────────────────────────────

  /** Register a persistent hurtbox for a damageable entity. */
  registerHurtbox(entityId: number, shape: HitboxShape): Hurtbox {
    const hurtbox: Hurtbox = { entityId, shape };
    this.hurtboxes.set(entityId, hurtbox);
    return hurtbox;
  }

  /** Remove a hurtbox when the entity is destroyed. */
  unregisterHurtbox(entityId: number): void {
    this.hurtboxes.delete(entityId);
  }

  /** Get a hurtbox by entity ID. */
  getHurtbox(entityId: number): Hurtbox | undefined {
    return this.hurtboxes.get(entityId);
  }

  // ── Read-only accessors (debug visualization) ────────────────

  /** Returns all currently active hitboxes (read-only, for debug). */
  getActiveHitboxes(): readonly Hitbox[] {
    return this.hitboxes.filter((h) => h.active);
  }

  /** Returns all registered hurtboxes (read-only, for debug). */
  getAllHurtboxes(): readonly Hurtbox[] {
    return Array.from(this.hurtboxes.values());
  }

  // ── Per-frame overlap detection ──────────────────────────────

  /**
   * Test all active hitboxes against all hurtboxes.
   * Fires the onHit callback for each new overlap.
   * Enforces one-hit-per-attack-instance-per-target.
   */
  update(): void {
    for (const hitbox of this.hitboxes) {
      if (!hitbox.active) continue;

      for (const [, hurtbox] of this.hurtboxes) {
        // Don't hit yourself
        if (hurtbox.entityId === hitbox.ownerId) continue;

        // One hit per attack instance per target
        if (hitbox.alreadyHit.has(hurtbox.entityId)) continue;

        if (this.testOverlap(hitbox.shape, hurtbox.shape)) {
          hitbox.alreadyHit.add(hurtbox.entityId);

          if (this.onHitCallback) {
            this.onHitCallback({
              attackerId: hitbox.ownerId,
              defenderId: hurtbox.entityId,
              attackData: hitbox.attackData,
              hitboxId: hitbox.id,
              attackInstanceId: hitbox.attackInstanceId,
            });
          }
        }
      }
    }
  }

  // ── Shape overlap testing (delegates to CollisionSystem) ─────

  private testOverlap(a: HitboxShape, b: HitboxShape): boolean {
    if (a.type === 'sphere' && b.type === 'sphere') {
      const sa: SphereCollider = { center: a.center, radius: a.radius };
      const sb: SphereCollider = { center: b.center, radius: b.radius };
      return testSphereVsSphere(sa, sb).hit;
    }

    if (a.type === 'aabb' && b.type === 'aabb') {
      const aa: AABB = { min: a.min, max: a.max };
      const ab: AABB = { min: b.min, max: b.max };
      return testAABBvsAABB(aa, ab).hit;
    }

    if (a.type === 'sphere' && b.type === 'aabb') {
      const sa: SphereCollider = { center: a.center, radius: a.radius };
      const ab: AABB = { min: b.min, max: b.max };
      return testSphereVsAABB(sa, ab).hit;
    }

    if (a.type === 'aabb' && b.type === 'sphere') {
      const sa: SphereCollider = { center: b.center, radius: b.radius };
      const aa: AABB = { min: a.min, max: a.max };
      return testSphereVsAABB(sa, aa).hit;
    }

    return false;
  }

  // ── Cleanup ──────────────────────────────────────────────────

  /** Remove all hitboxes and hurtboxes. */
  clear(): void {
    this.hitboxes.length = 0;
    this.hurtboxes.clear();
  }
}
