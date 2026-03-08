import * as THREE from 'three';
import { WeaponData } from './WeaponData';
import { STAMINA_COSTS } from '../player/PlayerStats';
import { EventBus } from '../app/EventBus';

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
 * Default weapon used before any JSON is loaded.
 * Matches fracture-blade.json so gameplay is unchanged until loadWeapon() is called.
 */
const DEFAULT_WEAPON: WeaponData = {
  id: 'fracture-blade',
  name: 'Fracture Blade',
  description: 'A jagged shard. Balanced. Reliable.',
  baseDamage: 18,
  heavyMultiplier: 2.0,
  attackSpeed: 1.0,
  range: 2.5,
  staggerDamage: 15,
  comboHits: 2,
  staminaCostLight: 12,
  staminaCostHeavy: 25,
  hitboxShape: 'arc',
  hitboxSize: { radius: 2.5, angle: 120 },
  unlockCost: 0,
};

/**
 * WeaponSystem manages active hitboxes for player attacks and
 * tracks the currently equipped weapon data.
 *
 * Weapon JSON is loaded via loadWeapon() and cached. Attack states
 * read getEquipped() each frame for damage, range, timing, etc.
 */
export class WeaponSystem {
  private activeHitboxes: ActiveHitbox[] = [];
  private equippedWeapon: WeaponData = DEFAULT_WEAPON;
  private secondaryWeapon: WeaponData | null = null;
  private cache = new Map<string, WeaponData>();
  private eventBus: EventBus | null = null;

  /** Set the event bus for emitting weapon swap events. */
  setEventBus(bus: EventBus): void {
    this.eventBus = bus;
  }

  /**
   * Load weapon JSON by id. Fetches from data/weapons/{id}.json
   * and caches the result. Returns the parsed WeaponData.
   */
  async loadWeapon(id: string): Promise<WeaponData> {
    const cached = this.cache.get(id);
    if (cached) return cached;

    const resp = await fetch(`data/weapons/${id}.json`);
    if (!resp.ok) throw new Error(`Failed to load weapon: ${id}`);
    const data: WeaponData = await resp.json();
    this.cache.set(id, data);
    return data;
  }

  /**
   * Load and equip a weapon by id. Updates stamina costs.
   */
  async equipWeapon(id: string): Promise<void> {
    const data = await this.loadWeapon(id);
    this.equippedWeapon = data;
    STAMINA_COSTS.light_attack = data.staminaCostLight;
    STAMINA_COSTS.heavy_attack = data.staminaCostHeavy;
  }

  /**
   * Get the currently equipped weapon data.
   * Always returns a valid WeaponData (defaults to fracture-blade stats).
   */
  getEquipped(): WeaponData {
    return this.equippedWeapon;
  }

  /**
   * Load and set a secondary weapon by id.
   */
  async equipSecondary(id: string): Promise<void> {
    this.secondaryWeapon = await this.loadWeapon(id);
  }

  /** Get the secondary weapon data, or null if none equipped. */
  getSecondary(): WeaponData | null {
    return this.secondaryWeapon;
  }

  /** True if a secondary weapon is equipped. */
  hasSecondary(): boolean {
    return this.secondaryWeapon !== null;
  }

  /**
   * Swap primary and secondary weapons. Returns true if swap occurred.
   * Updates stamina costs to match the newly equipped weapon.
   */
  swapWeapon(): boolean {
    if (!this.secondaryWeapon) return false;

    const prev = this.equippedWeapon;
    this.equippedWeapon = this.secondaryWeapon;
    this.secondaryWeapon = prev;

    STAMINA_COSTS.light_attack = this.equippedWeapon.staminaCostLight;
    STAMINA_COSTS.heavy_attack = this.equippedWeapon.staminaCostHeavy;

    this.eventBus?.emit('WEAPON_SWAPPED', {
      weaponId: this.equippedWeapon.id,
      weaponName: this.equippedWeapon.name,
    });

    console.log(`[WeaponSystem] Swapped to ${this.equippedWeapon.name} (${this.equippedWeapon.id})`);
    return true;
  }

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
