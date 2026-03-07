/**
 * ZoneGenerator — creates a linear sequence of room/encounter pairs
 * from a ZoneConfig. Each run through a zone produces a different layout
 * within the constraints of the zone's room pool, encounter pool, and
 * difficulty curve.
 */

import {
  ZoneRegistry,
  type ZoneConfig,
  type ZoneRoomEntry,
  type ZoneEncounterEntry,
} from '../levels/ZoneRegistry';

export interface ZoneLayoutEntry {
  roomId: string;
  encounterId: string;
  targetDifficulty: number;
  actualDifficulty: number;
}

export interface ZoneLayout {
  zoneId: string;
  rooms: ZoneLayoutEntry[];
}

export class ZoneGenerator {
  /**
   * Generate a linear zone layout from a registered zone config.
   * Returns null if the zone ID is not found in the registry.
   */
  generate(zoneId: string): ZoneLayout | null {
    const config = ZoneRegistry.get(zoneId);
    if (!config) {
      console.error(`[ZoneGenerator] Zone "${zoneId}" not found in registry`);
      return null;
    }

    return this.generateFromConfig(config);
  }

  /**
   * Generate a linear zone layout directly from a ZoneConfig.
   */
  generateFromConfig(config: ZoneConfig): ZoneLayout {
    const roomCount = this.randomInt(config.roomCount.min, config.roomCount.max);
    const rooms: ZoneLayoutEntry[] = [];

    // Track used encounters to avoid repeating the same encounter back-to-back
    let lastEncounterId = '';

    for (let i = 0; i < roomCount; i++) {
      const targetDifficulty = this.getDifficultyAtIndex(config, i);

      const room = this.selectRoom(config, targetDifficulty);
      const encounter = this.selectEncounter(
        config,
        targetDifficulty,
        lastEncounterId,
      );

      rooms.push({
        roomId: room.roomId,
        encounterId: encounter.encounterId,
        targetDifficulty,
        actualDifficulty: encounter.difficulty,
      });

      lastEncounterId = encounter.encounterId;
    }

    console.log(
      `[ZoneGenerator] Generated "${config.id}" layout: ${roomCount} rooms`,
      rooms.map((r) => `${r.roomId}/${r.encounterId}(d${r.actualDifficulty})`),
    );

    return { zoneId: config.id, rooms };
  }

  // ── Private helpers ────────────────────────────────────────────

  /**
   * Get the target difficulty for a room at the given index.
   * If index exceeds the curve length, reuses the last value.
   */
  private getDifficultyAtIndex(config: ZoneConfig, index: number): number {
    const curve = config.difficultyCurve;
    if (curve.length === 0) return 1;
    return curve[Math.min(index, curve.length - 1)];
  }

  /**
   * Select a room from the pool that fits the target difficulty.
   * Uses weighted random selection among eligible rooms.
   */
  private selectRoom(config: ZoneConfig, targetDifficulty: number): ZoneRoomEntry {
    const eligible = config.roomPool.filter(
      (r) => targetDifficulty >= r.minDifficulty && targetDifficulty <= r.maxDifficulty,
    );

    if (eligible.length === 0) {
      // Fallback: pick the room closest to the target difficulty
      console.warn(
        `[ZoneGenerator] No rooms fit difficulty ${targetDifficulty}, using closest match`,
      );
      return this.closestRoom(config.roomPool, targetDifficulty);
    }

    return this.weightedRandom(eligible);
  }

  /**
   * Select an encounter from the pool that's within tolerance of target difficulty.
   * Avoids repeating the last encounter if possible.
   */
  private selectEncounter(
    config: ZoneConfig,
    targetDifficulty: number,
    lastEncounterId: string,
  ): ZoneEncounterEntry {
    const tolerance = config.difficultyTolerance;

    let eligible = config.encounterPool.filter(
      (e) => Math.abs(e.difficulty - targetDifficulty) <= tolerance,
    );

    if (eligible.length === 0) {
      // Fallback: pick the encounter closest to target difficulty
      console.warn(
        `[ZoneGenerator] No encounters within tolerance for difficulty ${targetDifficulty}, using closest`,
      );
      return this.closestEncounter(config.encounterPool, targetDifficulty);
    }

    // Try to avoid back-to-back repeats
    if (eligible.length > 1) {
      const nonRepeat = eligible.filter((e) => e.encounterId !== lastEncounterId);
      if (nonRepeat.length > 0) {
        eligible = nonRepeat;
      }
    }

    return this.weightedRandom(eligible);
  }

  /**
   * Weighted random selection from an array of items with a `weight` property.
   */
  private weightedRandom<T extends { weight: number }>(items: T[]): T {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const item of items) {
      roll -= item.weight;
      if (roll <= 0) return item;
    }

    // Fallback (shouldn't happen)
    return items[items.length - 1];
  }

  /**
   * Find the room whose difficulty range midpoint is closest to target.
   */
  private closestRoom(pool: ZoneRoomEntry[], target: number): ZoneRoomEntry {
    let best = pool[0];
    let bestDist = Infinity;

    for (const room of pool) {
      const mid = (room.minDifficulty + room.maxDifficulty) / 2;
      const dist = Math.abs(mid - target);
      if (dist < bestDist) {
        bestDist = dist;
        best = room;
      }
    }

    return best;
  }

  /**
   * Find the encounter whose difficulty is closest to target.
   */
  private closestEncounter(pool: ZoneEncounterEntry[], target: number): ZoneEncounterEntry {
    let best = pool[0];
    let bestDist = Infinity;

    for (const enc of pool) {
      const dist = Math.abs(enc.difficulty - target);
      if (dist < bestDist) {
        bestDist = dist;
        best = enc;
      }
    }

    return best;
  }

  /**
   * Random integer in [min, max] inclusive.
   */
  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
