// Centralized gameplay configuration.
// All tuning values live here — systems import from this file
// instead of using hardcoded magic numbers.

export const GAME_CONFIG = {
  // ── Timing ──────────────────────────────────────────────────
  timing: {
    fixedTimestep: 1 / 60,
    maxDeltaTime: 0.25,
  },

  // ── Player Movement ─────────────────────────────────────────
  player: {
    walkSpeed: 5,
    sprintSpeed: 8,
    rotationSpeed: 15,
    radius: 0.5,
    exhaustedWalkSpeed: 3,
  },

  // ── Player Stats ────────────────────────────────────────────
  stats: {
    maxHP: 100,
    maxStamina: 100,
    maxHealCharges: 3,
    healAmount: 35,
    staminaRegenRate: 25,
    staminaRegenDelay: 0.4,
    exhaustionClearThreshold: 20,
  },

  // ── Stamina Costs ───────────────────────────────────────────
  stamina: {
    dodge: 20,
    lightAttack: 12,
    heavyAttack: 25,
    parry: 8,
    sprintPerSec: 3,
  },

  // ── Dodge ───────────────────────────────────────────────────
  dodge: {
    distance: 4,
    duration: 0.3,
    recovery: 0.1,
    iframeStart: 0.05,
    iframeEnd: 0.25,
  },

  // ── Parry ───────────────────────────────────────────────────
  parry: {
    window: 0.15,
    recovery: 0.2,
    staminaRecovery: 10,
    buffDuration: 3.0,
    buffMultiplier: 1.5,
  },

  // ── Heal ────────────────────────────────────────────────────
  heal: {
    duration: 0.8,
  },

  // ── Light Attack ────────────────────────────────────────────
  lightAttack: {
    telegraph: 0.1,
    active: 0.15,
    recovery: 0.2,
    hitboxRadius: 2.5,
    hitboxArcDeg: 120,
    maxCombo: 2,
  },

  // ── Heavy Attack ────────────────────────────────────────────
  heavyAttack: {
    chargeMin: 0.3,
    chargeMax: 0.8,
    telegraph: 0.25,
    active: 0.2,
    recovery: 0.3,
    hitboxRadius: 2.5,
    hitboxArcDeg: 120,
    damageMultMin: 1.5,
    damageMultMax: 2.0,
  },

  // ── Camera ──────────────────────────────────────────────────
  camera: {
    distance: 8,
    heightOffset: 3,
    followSmoothing: 0.1,
    sensitivityX: 0.003,
    sensitivityY: 0.003,
    lockOnRange: 15,
  },

  // ── Input ───────────────────────────────────────────────────
  input: {
    bufferMs: 150,
  },

  // ── World ───────────────────────────────────────────────────
  world: {
    arenaSize: 20,
    wallHeight: 3,
    wallThickness: 0.4,
    doorInteractRange: 2.5,
  },

  // ── Pickups ─────────────────────────────────────────────────
  pickups: {
    collectionRadius: 2,
    magnetRadius: 3,
    lifetime: 30,
  },

  // ── Enemy ───────────────────────────────────────────────────
  enemy: {
    hitFlashDuration: 0.12,
    deathCleanupDelay: 1.5,
    shatterPieceCount: 8,
  },

  // ── Hazards ────────────────────────────────────────────────
  hazards: {
    staticDischarge: {
      defaultRadius: 1.5,
      defaultDamage: 5,
      defaultInterval: 1000,
      pulseSpeed: 2.0,
    },
    looseTile: {
      defaultSize: 1.0,
      collapseDelay: 1000,
      respawnDelay: 2000,
      collapseDepth: 3,
    },
  },

  // ── Physics ─────────────────────────────────────────────────
  physics: {
    gravity: -9.8,
  },
} as const;

export type GameConfig = typeof GAME_CONFIG;
