/**
 * Zone 1: The Shattered Atrium
 *
 * Introduction zone. Teaches room navigation, combat basics, and door mechanics.
 * 5–6 rooms. Difficulty escalates from 1 to 6.
 *
 * Room pool references room JSON ids from data/rooms/.
 * Encounter pool references encounter ids from data/encounters/zone1-encounters.json.
 */

import { ZoneRegistry, type ZoneConfig } from './ZoneRegistry';

const zone1Config: ZoneConfig = {
  id: 'shattered-atrium',
  name: 'The Shattered Atrium',
  roomCount: { min: 5, max: 6 },

  roomPool: [
    // Tutorial corridor — always available, best at low difficulty
    { roomId: 'atrium-hall-straight', minDifficulty: 1, maxDifficulty: 3, weight: 1 },
    // Standard combat room — mid range
    { roomId: 'atrium-room-square', minDifficulty: 1, maxDifficulty: 6, weight: 2 },
    // T-junction — mid to high
    { roomId: 'atrium-junction-T', minDifficulty: 3, maxDifficulty: 6, weight: 1 },
    // Balcony — higher difficulty (vertical play)
    { roomId: 'atrium-balcony', minDifficulty: 4, maxDifficulty: 7, weight: 1 },
    // Boss arena — final room only (max difficulty)
    { roomId: 'atrium-boss-arena', minDifficulty: 7, maxDifficulty: 10, weight: 1 },
  ],

  encounterPool: [
    { encounterId: 'z1-intro', difficulty: 1, weight: 2 },
    { encounterId: 'z1-first-real', difficulty: 2, weight: 2 },
    { encounterId: 'z1-ranged-intro', difficulty: 3, weight: 1 },
    { encounterId: 'z1-wave-fight', difficulty: 5, weight: 1 },
    { encounterId: 'z1-pressure', difficulty: 6, weight: 1 },
  ],

  // Target difficulty at each room index (0-based)
  // Room 0: easy intro, ramps up through the zone
  difficultyCurve: [1, 2, 3, 5, 6, 7],

  // Encounters within ±1.5 of the target difficulty are valid candidates
  difficultyTolerance: 1.5,
};

// Auto-register on import
ZoneRegistry.register(zone1Config);

export { zone1Config };
