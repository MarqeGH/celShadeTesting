import * as THREE from 'three';
import { HitboxManager, HitResult } from './HitboxManager';
import { calculateDamage } from './DamageCalculator';
import { EventBus } from '../app/EventBus';
import { StaggerSystem } from './StaggerSystem';

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
  /** Defense stat for damage reduction (0 = no reduction). */
  getDefense(): number;
  takeDamage(amount: number): number;
  isDead(): boolean;
  getPosition(): THREE.Vector3;
}

// ── Parry handler types ─────────────────────────────────────────

/** Result of checking whether the player is parrying an incoming hit */
export type ParryResult = 'success' | 'fail' | null;

/**
 * Parry handler registered by the game to integrate player FSM with combat.
 */
export interface ParryHandler {
  /** Check parry state: 'success' if in window, 'fail' if in parry recovery, null otherwise */
  check: (attackerId: number) => ParryResult;
  /** Called on successful parry (grants buff, stamina recovery) */
  onSuccess: (attackerId: number) => void;
  /** Called on failed parry (forces extra stagger) */
  onFail: () => void;
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
  private staggerSystem: StaggerSystem;
  private entities = new Map<number, CombatEntity>();
  private parryHandler: ParryHandler | null = null;
  private playerAttackMultiplier: (() => number) | null = null;

  constructor(hitboxManager: HitboxManager, eventBus: EventBus, staggerSystem: StaggerSystem) {
    this.hitboxManager = hitboxManager;
    this.eventBus = eventBus;
    this.staggerSystem = staggerSystem;

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

  /**
   * Register a parry handler for player-targeted hits.
   * Called before damage is applied; can deflect attacks or add extra punishment.
   */
  setParryHandler(handler: ParryHandler): void {
    this.parryHandler = handler;
  }

  /**
   * Set a callback that returns the player's current attack damage multiplier.
   * Used for parry buff (1.5x for 3s after successful parry).
   */
  setPlayerAttackMultiplier(provider: () => number): void {
    this.playerAttackMultiplier = provider;
  }

  /** Run hitbox overlap detection. Call once per frame. */
  update(): void {
    this.hitboxManager.update();
  }

  // ── Hit processing ─────────────────────────────────────────────

  private onHit(hit: HitResult): void {
    const defender = this.entities.get(hit.defenderId);
    if (!defender) return;

    // ── No friendly fire: skip enemy-on-enemy hits ───────────
    const attacker = this.entities.get(hit.attackerId);
    if (attacker && attacker.type === 'enemy' && defender.type === 'enemy') return;

    // ── Parry check for player-targeted hits ──────────────────
    if (defender.type === 'player' && this.parryHandler) {
      const parryResult = this.parryHandler.check(hit.attackerId);

      if (parryResult === 'success') {
        // Successful parry: deflect attack, stagger attacker
        this.staggerSystem.applyStaggerDamage(hit.attackerId, 9999);
        this.parryHandler.onSuccess(hit.attackerId);
        return; // no damage applied
      }

      if (parryResult === 'fail') {
        // Failed parry: take full damage + extra stagger punishment
        // Damage falls through to normal processing below
        this.parryHandler.onFail();
      }
    }

    // Apply player attack multiplier (parry buff) for player-sourced attacks
    const attackMultiplier = hit.attackerId === PLAYER_ENTITY_ID && this.playerAttackMultiplier
      ? this.playerAttackMultiplier()
      : 1.0;

    const result = calculateDamage(hit.attackData, attackMultiplier, defender.getDefense());
    const remainingHp = defender.takeDamage(result.damage);

    // Apply poise damage via StaggerSystem
    if (result.staggerDamage > 0) {
      this.staggerSystem.applyStaggerDamage(hit.defenderId, result.staggerDamage);
    }

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
      const defPos = defender.getPosition();
      this.eventBus.emit('ENEMY_DAMAGED', {
        enemyId: defender.stringId,
        amount: result.damage,
        currentHP: remainingHp,
        sourceId: String(hit.attackerId),
        position: { x: defPos.x, y: defPos.y, z: defPos.z },
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
