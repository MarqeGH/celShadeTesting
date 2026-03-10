import { Howl, Howler } from 'howler';
import { EventBus } from '../app/EventBus';
import { SaveManager } from '../save/SaveManager';
import { getSFXPath, getMusicPath } from './SFXRegistry';
import { getToneParams } from './ToneBank';

// ── Ambient drone types and configs ─────────────────────────────

interface AmbientNodes {
  droneOsc: OscillatorNode;
  droneOsc2: OscillatorNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
  masterGain: GainNode;
  filter: BiquadFilterNode;
}

interface AmbientConfig {
  droneFreq: number;
  droneType: OscillatorType;
  detuneRatio: number;
  lfoRate: number;
  lfoDepth: number;
  filterFreq: number;
}

/** Per-zone ambient drone configurations */
const AMBIENT_CONFIGS: Record<string, AmbientConfig> = {
  'hub': {
    droneFreq: 55,          // low A1 hum
    droneType: 'sine',
    detuneRatio: 1.002,     // subtle beating
    lfoRate: 0.08,          // very slow pulse
    lfoDepth: 0.04,
    filterFreq: 300,        // very muffled
  },
  'shattered-atrium': {
    droneFreq: 65,          // low C2 drone
    droneType: 'sawtooth',
    detuneRatio: 1.005,     // wider beat for tension
    lfoRate: 0.15,          // slightly faster
    lfoDepth: 0.06,
    filterFreq: 500,        // a bit more presence
  },
  'default': {
    droneFreq: 60,
    droneType: 'sine',
    detuneRatio: 1.003,
    lfoRate: 0.1,
    lfoDepth: 0.05,
    filterFreq: 400,
  },
};

/**
 * Audio system using Howler.js.
 * Plays SFX and music, reads volumes from SaveManager settings.
 * Subscribes to EventBus for automatic combat sound triggers.
 * Falls back to Web Audio API procedural tones when files are missing.
 * Provides procedural ambient drones per zone.
 */
export class AudioManager {
  private eventBus: EventBus;

  private sfxCache = new Map<string, Howl>();
  private musicCache = new Map<string, Howl>();
  private failedSFX = new Set<string>();
  private currentMusic: Howl | null = null;
  private currentMusicId: string | null = null;
  private audioCtx: AudioContext | null = null;

  // Ambient drone state
  private ambientNodes: AmbientNodes | null = null;
  private ambientZoneId: string | null = null;
  private ambientVolume = 0.3;

  private masterVolume: number;
  private sfxVolume: number;
  private musicVolume: number;
  private _muted = true; // off by default — press M to toggle

  constructor(eventBus: EventBus, saveManager: SaveManager) {
    this.eventBus = eventBus;

    // Read initial volumes from save data
    const settings = saveManager.getData().settings;
    this.masterVolume = settings.masterVolume;
    this.sfxVolume = settings.sfxVolume;
    this.musicVolume = settings.musicVolume;

    // Start muted — Howler global volume 0
    Howler.volume(0);

    this.subscribe();
    console.log('[AudioManager] Initialized');
  }

  // ── SFX ──────────────────────────────────────────────────────

  /**
   * Play a sound effect by registry ID.
   * Falls back to procedural tone if the audio file is missing.
   */
  playSFX(id: string, volume?: number): void {
    if (this._muted) return;
    const vol = (volume ?? 1.0) * this.sfxVolume * this.masterVolume;

    // If file previously failed to load, skip Howl and use tone
    if (this.failedSFX.has(id)) {
      this.playTone(id, vol);
      return;
    }

    const howl = this.getOrLoadSFX(id);
    if (!howl) {
      this.playTone(id, vol);
      return;
    }

    howl.volume(vol);
    howl.play();
  }

  private getOrLoadSFX(id: string): Howl | null {
    const cached = this.sfxCache.get(id);
    if (cached) return cached;

    const path = getSFXPath(id);
    if (!path) return null;

    const howl = new Howl({
      src: [path],
      preload: true,
      onloaderror: () => {
        this.failedSFX.add(id);
        this.sfxCache.delete(id);
      },
    });
    this.sfxCache.set(id, howl);
    return howl;
  }

  // ── Procedural tone fallback ──────────────────────────────────

  private getAudioContext(): AudioContext | null {
    if (!this.audioCtx) {
      try {
        this.audioCtx = new AudioContext();
      } catch {
        return null;
      }
    }
    return this.audioCtx;
  }

  /**
   * Generate a procedural tone via Web Audio API.
   * Public for direct use; also used as fallback when files are missing.
   */
  generateTone(
    frequency: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume: number = 0.3,
  ): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  private playTone(id: string, volume: number): void {
    const params = getToneParams(id);
    if (!params) return;
    this.generateTone(params.frequency, params.duration, params.type, volume * params.volume);
  }

  // ── Ambient drone system ───────────────────────────────────────

  /**
   * Start a procedural ambient drone for the given zone.
   * Crossfades from current ambient if one is playing.
   */
  playAmbient(zoneId: string): void {
    // Track desired zone even when muted, so unmute can start it
    this.ambientZoneId = zoneId;
    if (this._muted) return;
    if (this.ambientNodes) {
      // Already playing same zone
      this.stopAmbientImmediate();
    }

    const ctx = this.getAudioContext();
    if (!ctx) return;

    const config = AMBIENT_CONFIGS[zoneId] ?? AMBIENT_CONFIGS['default'];
    const targetVol = this.ambientVolume * this.masterVolume;

    // Primary drone oscillator
    const droneOsc = ctx.createOscillator();
    droneOsc.type = config.droneType;
    droneOsc.frequency.value = config.droneFreq;

    // Secondary detuned oscillator for richness
    const droneOsc2 = ctx.createOscillator();
    droneOsc2.type = config.droneType;
    droneOsc2.frequency.value = config.droneFreq * config.detuneRatio;

    // LFO for slow volume modulation
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = config.lfoRate;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = config.lfoDepth;

    // Master gain for the ambient mix
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    // Fade in over 1.5s
    masterGain.gain.linearRampToValueAtTime(targetVol, ctx.currentTime + 1.5);

    // Low-pass filter for muffled, atmospheric feel
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = config.filterFreq;
    filter.Q.value = 0.7;

    // Connect: oscillators → filter → masterGain → destination
    droneOsc.connect(filter);
    droneOsc2.connect(filter);
    filter.connect(masterGain);

    // LFO modulates masterGain
    lfo.connect(lfoGain);
    lfoGain.connect(masterGain.gain);

    masterGain.connect(ctx.destination);

    droneOsc.start();
    droneOsc2.start();
    lfo.start();

    this.ambientNodes = { droneOsc, droneOsc2, lfo, lfoGain, masterGain, filter };
    this.ambientZoneId = zoneId;
  }

  /** Fade ambient out over duration seconds. */
  fadeAmbientOut(duration: number = 0.8): void {
    if (!this.ambientNodes) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const gain = this.ambientNodes.masterGain;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

    // Schedule cleanup after fade
    const nodes = this.ambientNodes;
    this.ambientNodes = null;
    // Don't clear ambientZoneId — so resumeAmbient knows what to restart
    setTimeout(() => this.cleanupAmbientNodes(nodes), duration * 1000 + 100);
  }

  /** Resume ambient for the current zone (after pause). */
  resumeAmbient(): void {
    if (this.ambientNodes) return; // already playing
    if (this.ambientZoneId) {
      const zoneId = this.ambientZoneId;
      this.ambientZoneId = null; // clear so playAmbient doesn't skip
      this.playAmbient(zoneId);
    }
  }

  /** Stop ambient immediately (no fade). */
  stopAmbient(): void {
    this.stopAmbientImmediate();
    this.ambientZoneId = null;
  }

  /** Set ambient volume (0–1). */
  setAmbientVolume(v: number): void {
    this.ambientVolume = Math.max(0, Math.min(1, v));
    if (this.ambientNodes) {
      const ctx = this.getAudioContext();
      if (ctx) {
        const targetVol = this.ambientVolume * this.masterVolume;
        this.ambientNodes.masterGain.gain.setValueAtTime(targetVol, ctx.currentTime);
      }
    }
  }

  getAmbientVolume(): number { return this.ambientVolume; }

  private stopAmbientImmediate(): void {
    if (!this.ambientNodes) return;
    this.cleanupAmbientNodes(this.ambientNodes);
    this.ambientNodes = null;
  }

  private cleanupAmbientNodes(nodes: AmbientNodes): void {
    try {
      nodes.droneOsc.stop();
      nodes.droneOsc2.stop();
      nodes.lfo.stop();
      nodes.droneOsc.disconnect();
      nodes.droneOsc2.disconnect();
      nodes.lfo.disconnect();
      nodes.lfoGain.disconnect();
      nodes.filter.disconnect();
      nodes.masterGain.disconnect();
    } catch {
      // nodes may already be stopped/disconnected
    }
  }

  // ── Music ────────────────────────────────────────────────────

  /** Play a music track by registry ID. Loops by default. */
  playMusic(id: string, loop: boolean = true): void {
    if (this.currentMusicId === id && this.currentMusic?.playing()) return;

    this.stopMusic();

    const howl = this.getOrLoadMusic(id);
    if (!howl) return;

    howl.volume(this.musicVolume);
    howl.loop(loop);
    howl.play();
    this.currentMusic = howl;
    this.currentMusicId = id;
  }

  /** Stop currently playing music. */
  stopMusic(): void {
    if (this.currentMusic) {
      this.currentMusic.stop();
      this.currentMusic = null;
      this.currentMusicId = null;
    }
  }

  private getOrLoadMusic(id: string): Howl | null {
    const cached = this.musicCache.get(id);
    if (cached) return cached;

    const path = getMusicPath(id);
    if (!path) return null;

    const howl = new Howl({
      src: [path],
      preload: true,
      onloaderror: () => {
        this.musicCache.delete(id);
      },
    });
    this.musicCache.set(id, howl);
    return howl;
  }

  // ── Volume controls ──────────────────────────────────────────

  setMasterVolume(v: number): void {
    this.masterVolume = Math.max(0, Math.min(1, v));
    Howler.volume(this.masterVolume);
  }

  setSFXVolume(v: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, v));
  }

  setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.currentMusic) {
      this.currentMusic.volume(this.musicVolume);
    }
  }

  getMasterVolume(): number { return this.masterVolume; }
  getSFXVolume(): number { return this.sfxVolume; }
  getMusicVolume(): number { return this.musicVolume; }

  // ── Mute toggle ───────────────────────────────────────────────

  get isMuted(): boolean { return this._muted; }

  /** Toggle mute on/off. When unmuting, restores volumes and starts ambient. */
  toggleMute(): boolean {
    this._muted = !this._muted;

    if (this._muted) {
      Howler.volume(0);
      this.stopAmbientImmediate();
    } else {
      Howler.volume(this.masterVolume);
      // Restart ambient for current zone if one was set
      if (this.ambientZoneId && !this.ambientNodes) {
        const zoneId = this.ambientZoneId;
        this.ambientZoneId = null; // clear so playAmbient doesn't skip
        this.playAmbient(zoneId);
      }
    }

    console.log(`[AudioManager] Audio ${this._muted ? 'OFF' : 'ON'}`);
    return !this._muted;
  }

  // ── EventBus subscriptions ───────────────────────────────────

  private onPlayerDamaged = (): void => { this.playSFX('player-hit'); };
  private onEnemyDamaged = (): void => { this.playSFX('hit-impact'); };
  private onEnemyDied = (): void => { this.playSFX('enemy-death'); };
  private onShardCollected = (): void => { this.playSFX('shard-collect'); };
  private onPlayerAttack = (): void => { this.playSFX('attack-whoosh'); };
  private onPlayerDodge = (): void => { this.playSFX('dodge-swoosh'); };
  private onPlayerParrySuccess = (): void => { this.playSFX('parry-clang'); };

  private subscribe(): void {
    this.eventBus.on('PLAYER_DAMAGED', this.onPlayerDamaged);
    this.eventBus.on('ENEMY_DAMAGED', this.onEnemyDamaged);
    this.eventBus.on('ENEMY_DIED', this.onEnemyDied);
    this.eventBus.on('SHARD_COLLECTED', this.onShardCollected);
    this.eventBus.on('PLAYER_ATTACK', this.onPlayerAttack);
    this.eventBus.on('PLAYER_DODGE', this.onPlayerDodge);
    this.eventBus.on('PLAYER_PARRY_SUCCESS', this.onPlayerParrySuccess);
  }

  private unsubscribe(): void {
    this.eventBus.off('PLAYER_DAMAGED', this.onPlayerDamaged);
    this.eventBus.off('ENEMY_DAMAGED', this.onEnemyDamaged);
    this.eventBus.off('ENEMY_DIED', this.onEnemyDied);
    this.eventBus.off('SHARD_COLLECTED', this.onShardCollected);
    this.eventBus.off('PLAYER_ATTACK', this.onPlayerAttack);
    this.eventBus.off('PLAYER_DODGE', this.onPlayerDodge);
    this.eventBus.off('PLAYER_PARRY_SUCCESS', this.onPlayerParrySuccess);
  }

  // ── Cleanup ──────────────────────────────────────────────────

  dispose(): void {
    this.unsubscribe();
    this.stopMusic();
    this.stopAmbient();

    for (const howl of this.sfxCache.values()) {
      howl.unload();
    }
    this.sfxCache.clear();

    for (const howl of this.musicCache.values()) {
      howl.unload();
    }
    this.musicCache.clear();

    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }
}
