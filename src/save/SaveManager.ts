import { EventBus } from '../app/EventBus';
import {
  SaveData,
  SAVE_VERSION,
  createDefaultSaveData,
  DEFAULT_SETTINGS,
  DEFAULT_BEST_RUN,
  type SaveSettings,
} from './SaveSchema';

const STORAGE_KEY = 'celtest_save';

/**
 * localStorage-based save system.
 * Auto-saves on RUN_ENDED. Loads on construction.
 * Validates schema on load; resets to defaults on corruption.
 */
export class SaveManager {
  private data: SaveData;
  private eventBus: EventBus;

  private onRunEnded = (payload: { survived: boolean; shardsCollected: number }): void => {
    this.data.metaCurrency += Math.floor(payload.shardsCollected * 0.5);
    this.save();
  };

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.data = this.load();
    this.eventBus.on('RUN_ENDED', this.onRunEnded);
  }

  /** Get a readonly snapshot of current save data. */
  getData(): Readonly<SaveData> {
    return this.data;
  }

  /** Persist current data to localStorage. */
  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (err) {
      console.warn('[SaveManager] Failed to write localStorage:', err);
    }
  }

  /** Load from localStorage. Returns defaults on missing/corrupt data. */
  load(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createDefaultSaveData();

      const parsed: unknown = JSON.parse(raw);
      if (!this.validate(parsed)) {
        console.warn('[SaveManager] Corrupt save data — resetting to defaults');
        return createDefaultSaveData();
      }

      const data = parsed as SaveData;
      return this.migrate(data);
    } catch {
      console.warn('[SaveManager] Failed to parse save data — resetting to defaults');
      return createDefaultSaveData();
    }
  }

  /** Reset all save data to defaults and persist. */
  reset(): void {
    this.data = createDefaultSaveData();
    this.save();
  }

  /** Record a completed run's stats, updating bestRun if exceeded. */
  recordRun(roomsCleared: number, enemiesKilled: number, shardsCollected: number): void {
    const best = this.data.bestRun;
    if (roomsCleared > best.roomsCleared) best.roomsCleared = roomsCleared;
    if (enemiesKilled > best.enemiesKilled) best.enemiesKilled = enemiesKilled;
    if (shardsCollected > best.shardsCollected) best.shardsCollected = shardsCollected;
    this.save();
  }

  /** Add an unlock by ID. */
  addUnlock(unlockId: string): void {
    if (!this.data.unlocks.includes(unlockId)) {
      this.data.unlocks.push(unlockId);
      this.save();
    }
  }

  /** Check if an unlock has been purchased. */
  hasUnlock(unlockId: string): boolean {
    return this.data.unlocks.includes(unlockId);
  }

  /** Spend meta-currency. Returns false if insufficient funds. */
  spendCurrency(amount: number): boolean {
    if (this.data.metaCurrency < amount) return false;
    this.data.metaCurrency -= amount;
    this.save();
    return true;
  }

  /** Update settings (partial). */
  updateSettings(partial: Partial<SaveSettings>): void {
    Object.assign(this.data.settings, partial);
    this.save();
  }

  /** Validate that parsed JSON has the expected shape. */
  private validate(obj: unknown): obj is SaveData {
    if (typeof obj !== 'object' || obj === null) return false;
    const d = obj as Record<string, unknown>;

    if (typeof d.version !== 'number') return false;
    if (typeof d.metaCurrency !== 'number') return false;
    if (!Array.isArray(d.unlocks)) return false;
    if (typeof d.settings !== 'object' || d.settings === null) return false;
    if (typeof d.bestRun !== 'object' || d.bestRun === null) return false;

    return true;
  }

  /** Migrate save data from older versions to current. */
  private migrate(data: SaveData): SaveData {
    // Fill in any missing fields from defaults (forward-compatible)
    data.settings = { ...DEFAULT_SETTINGS, ...data.settings };
    data.bestRun = { ...DEFAULT_BEST_RUN, ...data.bestRun };

    // Version-specific migrations go here as the schema evolves:
    // if (data.version < 2) { ... migrate from v1 to v2 ... }

    data.version = SAVE_VERSION;
    return data;
  }

  dispose(): void {
    this.eventBus.off('RUN_ENDED', this.onRunEnded);
  }
}
