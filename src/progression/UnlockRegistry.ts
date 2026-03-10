import { AssetLoader } from '../engine/AssetLoader';

// ── Data interfaces matching DATA_SCHEMAS.md ─────────────────────

export interface UnlockEffect {
  type: 'add_to_pool' | 'stat_bonus' | 'ability_grant';
  target: string;
  value?: number;
}

export interface UnlockData {
  id: string;
  name: string;
  description: string;
  category: 'weapon' | 'ability' | 'stat' | 'cosmetic';
  cost: number;
  prerequisite: string | null;
  effect: UnlockEffect;
}

const UNLOCKS_PATH = 'data/progression/unlocks.json';

/**
 * Registry of all unlock definitions.
 * Loads from JSON, provides filtering by ownership and prerequisites.
 */
export class UnlockRegistry {
  private unlocks: Map<string, UnlockData> = new Map();
  private loaded = false;

  /**
   * Load unlock definitions from JSON.
   * Safe to call multiple times — only loads once.
   */
  async load(loader: AssetLoader): Promise<void> {
    if (this.loaded) return;

    try {
      const data = await loader.loadJSON<UnlockData[]>(UNLOCKS_PATH);
      for (const unlock of data) {
        this.unlocks.set(unlock.id, unlock);
      }
      this.loaded = true;
      console.log(`[UnlockRegistry] Loaded ${this.unlocks.size} unlocks`);
    } catch (err) {
      console.error('[UnlockRegistry] Failed to load unlock data:', err);
    }
  }

  /** Get all unlock definitions. */
  getAll(): UnlockData[] {
    return Array.from(this.unlocks.values());
  }

  /** Get a single unlock by ID. */
  get(id: string): UnlockData | undefined {
    return this.unlocks.get(id);
  }

  /**
   * Get unlocks available for purchase:
   * - Not already owned
   * - Prerequisite satisfied (owned or null)
   */
  getAvailable(playerUnlocks: string[]): UnlockData[] {
    const owned = new Set(playerUnlocks);
    return this.getAll().filter((unlock) => {
      if (owned.has(unlock.id)) return false;
      if (unlock.prerequisite && !owned.has(unlock.prerequisite)) return false;
      return true;
    });
  }

  /** Get the cost of an unlock. Returns 0 if not found. */
  getCost(id: string): number {
    return this.unlocks.get(id)?.cost ?? 0;
  }

  /** Get the effect of an unlock. */
  getEffect(id: string): UnlockEffect | undefined {
    return this.unlocks.get(id)?.effect;
  }
}
