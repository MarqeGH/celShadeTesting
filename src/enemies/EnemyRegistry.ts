import * as THREE from 'three';
import { BaseEnemy } from './BaseEnemy';
import { EventBus } from '../app/EventBus';
import { HitboxManager } from '../combat/HitboxManager';
import { EnemyData } from './EnemyFactory';

// ── Enemy constructor signature ─────────────────────────────────

/**
 * Constructor type for enemy subclasses.
 * The factory calls this to create a new enemy instance.
 */
export type EnemyConstructor = new (
  data: EnemyData,
  position: THREE.Vector3,
  eventBus: EventBus,
  hitboxManager: HitboxManager,
) => BaseEnemy;

// ── EnemyRegistry ───────────────────────────────────────────────

/**
 * Maps string enemy type IDs (e.g. "triangle-shard") to their
 * class constructors. Used by EnemyFactory to instantiate enemies.
 *
 * Usage:
 *   EnemyRegistry.register('triangle-shard', TriangleShard);
 *   const Ctor = EnemyRegistry.get('triangle-shard');
 */
export class EnemyRegistry {
  private static registry = new Map<string, EnemyConstructor>();

  /** Register an enemy class for a given type ID. */
  static register(typeId: string, ctor: EnemyConstructor): void {
    if (EnemyRegistry.registry.has(typeId)) {
      console.warn(`[EnemyRegistry] Overwriting existing entry for "${typeId}"`);
    }
    EnemyRegistry.registry.set(typeId, ctor);
  }

  /** Look up the constructor for a type ID. Returns undefined if not found. */
  static get(typeId: string): EnemyConstructor | undefined {
    return EnemyRegistry.registry.get(typeId);
  }

  /** Check whether a type ID has been registered. */
  static has(typeId: string): boolean {
    return EnemyRegistry.registry.has(typeId);
  }

  /** Get all registered type IDs. */
  static getRegisteredTypes(): string[] {
    return Array.from(EnemyRegistry.registry.keys());
  }

  /** Remove all registrations (useful for testing). */
  static clear(): void {
    EnemyRegistry.registry.clear();
  }
}
