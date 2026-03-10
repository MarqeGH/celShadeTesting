/**
 * Procedural tone definitions for each SFX ID.
 * Used as fallback when audio files are missing.
 */

export interface ToneParams {
  frequency: number;
  duration: number;
  type: OscillatorType;
  volume: number;
}

const TONE_MAP: Record<string, ToneParams> = {
  'attack-whoosh':  { frequency: 200,  duration: 0.15, type: 'sawtooth', volume: 0.2 },
  'hit-impact':     { frequency: 120,  duration: 0.12, type: 'square',   volume: 0.3 },
  'player-hit':     { frequency: 80,   duration: 0.2,  type: 'sawtooth', volume: 0.35 },
  'parry-clang':    { frequency: 800,  duration: 0.25, type: 'triangle', volume: 0.3 },
  'enemy-death':    { frequency: 150,  duration: 0.4,  type: 'sawtooth', volume: 0.25 },
  'shard-collect':  { frequency: 600,  duration: 0.15, type: 'sine',     volume: 0.2 },
  'dodge-swoosh':   { frequency: 300,  duration: 0.12, type: 'sine',     volume: 0.15 },
};

/** Get procedural tone parameters for an SFX ID. */
export function getToneParams(id: string): ToneParams | undefined {
  return TONE_MAP[id];
}
