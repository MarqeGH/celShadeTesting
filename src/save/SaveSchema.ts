/**
 * Canonical schema for persistent save data (localStorage).
 * Version field enables future migrations.
 */

export const SAVE_VERSION = 1;

export interface SaveSettings {
  masterVolume: number;   // 0.0–1.0
  sfxVolume: number;      // 0.0–1.0
  musicVolume: number;    // 0.0–1.0
  cameraSensitivity: number; // 0.1–2.0
}

export interface BestRunStats {
  roomsCleared: number;
  enemiesKilled: number;
  shardsCollected: number;
}

export interface SaveData {
  version: number;
  metaCurrency: number;
  unlocks: string[];        // unlock IDs the player has purchased
  settings: SaveSettings;
  bestRun: BestRunStats;
}

export const DEFAULT_SETTINGS: SaveSettings = {
  masterVolume: 1.0,
  sfxVolume: 1.0,
  musicVolume: 0.7,
  cameraSensitivity: 1.0,
};

export const DEFAULT_BEST_RUN: BestRunStats = {
  roomsCleared: 0,
  enemiesKilled: 0,
  shardsCollected: 0,
};

export function createDefaultSaveData(): SaveData {
  return {
    version: SAVE_VERSION,
    metaCurrency: 0,
    unlocks: [],
    settings: { ...DEFAULT_SETTINGS },
    bestRun: { ...DEFAULT_BEST_RUN },
  };
}
