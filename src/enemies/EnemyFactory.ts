import * as THREE from 'three';
import { BaseEnemy } from './BaseEnemy';
import { EnemyRegistry } from './EnemyRegistry';
import { EventBus } from '../app/EventBus';
import { HitboxManager } from '../combat/HitboxManager';

// ── EnemyData schema (matches data/enemies/*.json) ──────────────

export interface AttackMovement {
  type: 'dash' | 'step' | 'none';
  distance: number;
  speed: number;
}

export interface ProjectileDataSchema {
  shape: string;
  speed: number;
  lifetime: number;
  size: number;
  homing: boolean;
  homingStrength?: number;
}

export interface AttackDataSchema {
  id: string;
  name: string;
  telegraphDuration: number;
  activeDuration: number;
  recoveryDuration: number;
  damage: number;
  staggerDamage: number;
  range: number;
  hitboxShape: 'sphere' | 'arc' | 'line' | 'circle';
  hitboxSize: Record<string, number>;
  movementDuringAttack: AttackMovement | null;
  projectile?: ProjectileDataSchema;
}

export interface FSMTransition {
  to: string;
  condition: string;
}

export interface FSMStateConfig {
  name: string;
  params?: Record<string, any>;
  transitions: FSMTransition[];
}

export interface EnemyData {
  id: string;
  name: string;
  shape: string;
  stats: {
    maxHP: number;
    moveSpeed: number;
    turnSpeed: number;
    poise: number;
    poiseRegenDelay: number;
    poiseRegenRate: number;
  };
  perception: {
    aggroRange: number;
    attackRange: number;
    retreatRange: number;
    losRequired: boolean;
  };
  attacks: AttackDataSchema[];
  drops: {
    shards: { min: number; max: number };
    fragmentChance: number;
  };
  fsm: {
    initialState: string;
    states: FSMStateConfig[];
  };
}

// ── JSON data cache ─────────────────────────────────────────────

const dataCache = new Map<string, EnemyData>();

/**
 * Load enemy JSON data from `data/enemies/{typeId}.json`.
 * Caches results so the same file is only fetched once.
 */
async function loadEnemyData(typeId: string): Promise<EnemyData> {
  const cached = dataCache.get(typeId);
  if (cached) return cached;

  const url = `data/enemies/${typeId}.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `[EnemyFactory] Failed to load enemy data "${typeId}": ${response.status} ${response.statusText} (${url})`,
    );
  }

  const data: EnemyData = await response.json();
  dataCache.set(typeId, data);
  return data;
}

// ── EnemyFactory ────────────────────────────────────────────────

/**
 * Creates fully-initialized enemies from a type ID and spawn position.
 *
 * 1. Looks up the constructor in EnemyRegistry.
 * 2. Loads (or cache-hits) the JSON data from data/enemies/.
 * 3. Instantiates the enemy subclass, passing data + position.
 *
 * Usage:
 *   const enemy = await EnemyFactory.create('triangle-shard', pos, eventBus, hitboxManager);
 */
export class EnemyFactory {
  /**
   * Create an enemy instance asynchronously.
   * Throws if the type ID is not registered or if JSON data fails to load.
   */
  static async create(
    typeId: string,
    position: THREE.Vector3,
    eventBus: EventBus,
    hitboxManager: HitboxManager,
  ): Promise<BaseEnemy> {
    const Ctor = EnemyRegistry.get(typeId);
    if (!Ctor) {
      const registered = EnemyRegistry.getRegisteredTypes();
      throw new Error(
        `[EnemyFactory] Unknown enemy type "${typeId}". ` +
        `Registered types: [${registered.join(', ')}]`,
      );
    }

    const data = await loadEnemyData(typeId);
    const enemy = new Ctor(data, position, eventBus, hitboxManager);
    return enemy;
  }

  /**
   * Create an enemy instance synchronously using pre-loaded data.
   * Use this when enemy data has already been fetched (e.g. during a loading screen).
   */
  static createSync(
    typeId: string,
    data: EnemyData,
    position: THREE.Vector3,
    eventBus: EventBus,
    hitboxManager: HitboxManager,
  ): BaseEnemy {
    const Ctor = EnemyRegistry.get(typeId);
    if (!Ctor) {
      const registered = EnemyRegistry.getRegisteredTypes();
      throw new Error(
        `[EnemyFactory] Unknown enemy type "${typeId}". ` +
        `Registered types: [${registered.join(', ')}]`,
      );
    }

    // Also cache the data for future async calls
    if (!dataCache.has(typeId)) {
      dataCache.set(typeId, data);
    }

    return new Ctor(data, position, eventBus, hitboxManager);
  }

  /**
   * Pre-load enemy data for one or more type IDs.
   * Call during a loading screen to avoid fetch delays during gameplay.
   */
  static async preload(typeIds: string[]): Promise<void> {
    await Promise.all(typeIds.map((id) => loadEnemyData(id)));
  }

  /** Clear the JSON data cache. */
  static clearCache(): void {
    dataCache.clear();
  }
}
