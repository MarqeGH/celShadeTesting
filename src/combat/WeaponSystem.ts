import * as THREE from 'three';

/**
 * Represents an active hitbox — a short-lived arc region in front of the attacker.
 * Used by the combat system to detect hits against enemy hurtboxes.
 */
export interface ActiveHitbox {
  /** World-space origin of the arc (attacker position) */
  origin: THREE.Vector3;
  /** Forward direction the arc faces (normalized) */
  direction: THREE.Vector3;
  /** Radius of the arc in meters */
  radius: number;
  /** Half-angle of the arc in radians */
  halfAngle: number;
  /** Unique ID to enforce one-hit-per-attack per target */
  attackId: number;
  /** Set of entity IDs already hit by this attack instance */
  alreadyHit: Set<number>;
}

// ── Scratch vectors for hit testing ──────────────────────────────

const _toTarget = new THREE.Vector3();

/**
 * Test whether a point (e.g. enemy center) falls inside an arc hitbox.
 * The arc is a 2D sector on the XZ plane (Y ignored).
 */
export function testPointInArc(
  hitbox: ActiveHitbox,
  targetPos: THREE.Vector3,
  targetId: number,
): boolean {
  // Already hit this target with this attack instance
  if (hitbox.alreadyHit.has(targetId)) return false;

  _toTarget.subVectors(targetPos, hitbox.origin);
  _toTarget.y = 0; // XZ plane only

  const dist = _toTarget.length();
  if (dist > hitbox.radius || dist < 0.001) return false;

  _toTarget.normalize();

  // Angle between hitbox forward and direction to target
  const dot = hitbox.direction.x * _toTarget.x + hitbox.direction.z * _toTarget.z;
  const angle = Math.acos(Math.min(1, Math.max(-1, dot)));

  return angle <= hitbox.halfAngle;
}

// ── WeaponSystem ─────────────────────────────────────────────────

let nextAttackId = 1;

/**
 * WeaponSystem manages active hitboxes for player attacks.
 * Hitboxes are created during an attack's active phase and removed after.
 * The system exposes the list of active hitboxes for the combat system to query.
 */
export class WeaponSystem {
  private activeHitboxes: ActiveHitbox[] = [];

  /**
   * Create a new arc hitbox. Returns the hitbox so the caller can
   * track it and remove it when the active window ends.
   */
  createHitbox(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    radius: number,
    arcDegrees: number,
  ): ActiveHitbox {
    const hitbox: ActiveHitbox = {
      origin: origin.clone(),
      direction: direction.clone().normalize(),
      radius,
      halfAngle: (arcDegrees * Math.PI) / 360, // half of full arc angle
      attackId: nextAttackId++,
      alreadyHit: new Set(),
    };

    this.activeHitboxes.push(hitbox);
    return hitbox;
  }

  /**
   * Update an existing hitbox's origin and direction (follows attacker).
   */
  updateHitbox(hitbox: ActiveHitbox, origin: THREE.Vector3, direction: THREE.Vector3): void {
    hitbox.origin.copy(origin);
    hitbox.direction.copy(direction).normalize();
  }

  /**
   * Remove a hitbox (called when attack active window ends).
   */
  removeHitbox(hitbox: ActiveHitbox): void {
    const idx = this.activeHitboxes.indexOf(hitbox);
    if (idx !== -1) {
      this.activeHitboxes.splice(idx, 1);
    }
  }

  /**
   * Remove all active hitboxes (e.g. on state interruption).
   */
  clearAll(): void {
    this.activeHitboxes.length = 0;
  }

  /**
   * Get all currently active hitboxes for hit detection.
   */
  getActiveHitboxes(): readonly ActiveHitbox[] {
    return this.activeHitboxes;
  }
}
