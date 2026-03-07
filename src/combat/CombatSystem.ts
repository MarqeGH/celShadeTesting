import * as THREE from 'three';
import { HitboxManager, HitResult } from './HitboxManager';
import { calculateDamage } from './DamageCalculator';
import { EventBus } from '../app/EventBus';

// ── Entity ID constants ──────────────────────────────────────────

export const PLAYER_ENTITY_ID = 1;

// ── Combat entity interface ──────────────────────────────────────

/**
 * Any entity that can receive damage registers as a CombatEntity.
 * The CombatSystem uses this to apply damage and emit typed events.
 */
export interface CombatEntity {
  entityId: number;
  type: 'player' | 'enemy';
  /** String identifier used in event bus payloads */
  stringId: string;
  getHp(): number;
  getMaxHp(): number;
  takeDamage(amount: number): number;
  isDead(): boolean;
  getPosition(): THREE.Vector3;
}

// ── CombatSystem ─────────────────────────────────────────────────

/**
 * Ties together hit detection, damage calculation, and event emission.
 *
 * On each frame:
 *   1. HitboxManager detects overlaps between hitboxes and hurtboxes
 *   2. For each hit: DamageCalculator computes final damage
 *   3. Damage is applied to the defender's HP
 *   4. Appropriate events are emitted (PLAYER_DAMAGED, ENEMY_DAMAGED, etc.)
 */
export class CombatSystem {
  private hitboxManager: HitboxManager;
  private eventBus: EventBus;
  private entities = new Map<number, CombatEntity>();

  constructor(hitboxManager: HitboxManager, eventBus: EventBus) {
    this.hitboxManager = hitboxManager;
    this.eventBus = eventBus;

    this.hitboxManager.setOnHitCallback((hit) => this.onHit(hit));
  }

  /** Register a damageable entity so the system can apply damage to it. */
  registerEntity(entity: CombatEntity): void {
    this.entities.set(entity.entityId, entity);
  }

  /** Remove an entity from the combat system (e.g. on death cleanup). */
  unregisterEntity(entityId: number): void {
    this.entities.delete(entityId);
  }

  /** Get a registered entity by ID. */
  getEntity(entityId: number): CombatEntity | undefined {
    return this.entities.get(entityId);
  }

  /** Run hitbox overlap detection. Call once per frame. */
  update(): void {
    this.hitboxManager.update();
  }

  // ── Hit processing ─────────────────────────────────────────────

  private onHit(hit: HitResult): void {
    const defender = this.entities.get(hit.defenderId);
    if (!defender) return;

    const result = calculateDamage(hit.attackData);
    const remainingHp = defender.takeDamage(result.damage);

    if (defender.type === 'player') {
      this.eventBus.emit('PLAYER_DAMAGED', {
        amount: result.damage,
        currentHP: remainingHp,
        sourceId: String(hit.attackerId),
      });

      if (defender.isDead()) {
        this.eventBus.emit('PLAYER_DIED', {});
      }
    } else {
      this.eventBus.emit('ENEMY_DAMAGED', {
        enemyId: defender.stringId,
        amount: result.damage,
        currentHP: remainingHp,
        sourceId: String(hit.attackerId),
      });

      if (defender.isDead()) {
        const pos = defender.getPosition();
        this.eventBus.emit('ENEMY_DIED', {
          enemyId: defender.stringId,
          position: { x: pos.x, y: pos.y, z: pos.z },
        });
      }
    }
  }
}
