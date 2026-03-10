/**
 * Maps SFX IDs to audio file paths.
 * Placeholder paths for now — actual files added in T-070.
 */

export interface SFXEntry {
  id: string;
  path: string;
}

const SFX_ENTRIES: SFXEntry[] = [
  { id: 'attack-whoosh',  path: 'assets/audio/sfx/attack-whoosh.mp3' },
  { id: 'hit-impact',     path: 'assets/audio/sfx/hit-impact.mp3' },
  { id: 'player-hit',     path: 'assets/audio/sfx/player-hit.mp3' },
  { id: 'parry-clang',    path: 'assets/audio/sfx/parry-clang.mp3' },
  { id: 'enemy-death',    path: 'assets/audio/sfx/enemy-death.mp3' },
  { id: 'shard-collect',  path: 'assets/audio/sfx/shard-collect.mp3' },
  { id: 'dodge-swoosh',   path: 'assets/audio/sfx/dodge-swoosh.mp3' },
];

const MUSIC_ENTRIES: SFXEntry[] = [
  { id: 'zone1-ambient', path: 'assets/audio/ambient/zone1-ambient.mp3' },
  { id: 'hub-ambient',   path: 'assets/audio/ambient/hub-ambient.mp3' },
];

/** Lookup map built once at import time. */
const sfxMap = new Map<string, string>();
for (const entry of SFX_ENTRIES) {
  sfxMap.set(entry.id, entry.path);
}

const musicMap = new Map<string, string>();
for (const entry of MUSIC_ENTRIES) {
  musicMap.set(entry.id, entry.path);
}

/** Get the file path for an SFX id. */
export function getSFXPath(id: string): string | undefined {
  return sfxMap.get(id);
}

/** Get the file path for a music id. */
export function getMusicPath(id: string): string | undefined {
  return musicMap.get(id);
}

/** Get all registered SFX ids. */
export function getAllSFXIds(): string[] {
  return Array.from(sfxMap.keys());
}

/** Get all registered music ids. */
export function getAllMusicIds(): string[] {
  return Array.from(musicMap.keys());
}
