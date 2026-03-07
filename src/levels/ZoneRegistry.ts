/**
 * ZoneRegistry — stores zone configurations by ID.
 * Zones define room pools, encounter pools, and difficulty curves
 * used by ZoneGenerator to build linear room sequences.
 */

export interface ZoneRoomEntry {
  roomId: string;
  /** Minimum difficulty level where this room can appear (inclusive) */
  minDifficulty: number;
  /** Maximum difficulty level where this room can appear (inclusive) */
  maxDifficulty: number;
  /** Weight for random selection (higher = more likely). Default 1. */
  weight: number;
}

export interface ZoneEncounterEntry {
  encounterId: string;
  /** Encounter difficulty rating (1–10) */
  difficulty: number;
  /** Weight for random selection. Default 1. */
  weight: number;
}

export interface ZoneConfig {
  id: string;
  name: string;
  /** Number of rooms to generate (min, max). Generator picks a random count in range. */
  roomCount: { min: number; max: number };
  /** Room pool: available rooms for this zone */
  roomPool: ZoneRoomEntry[];
  /** Encounter pool: available encounters for this zone */
  encounterPool: ZoneEncounterEntry[];
  /** Difficulty curve: target difficulty value at each room index (0-based).
   *  If the generated room count exceeds the array length, the last value is reused. */
  difficultyCurve: number[];
  /** Difficulty tolerance: how far an encounter's difficulty can deviate from the curve target */
  difficultyTolerance: number;
}

const registry = new Map<string, ZoneConfig>();

export const ZoneRegistry = {
  register(config: ZoneConfig): void {
    registry.set(config.id, config);
  },

  get(zoneId: string): ZoneConfig | undefined {
    return registry.get(zoneId);
  },

  getAll(): ZoneConfig[] {
    return Array.from(registry.values());
  },

  has(zoneId: string): boolean {
    return registry.has(zoneId);
  },

  clear(): void {
    registry.clear();
  },
};
