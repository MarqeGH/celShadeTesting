// ── Timing ──────────────────────────────────────────────────
export const FIXED_TIMESTEP = 1 / 60;
export const MAX_DELTA_TIME = 0.25;

// ── Player Movement ─────────────────────────────────────────
export const PLAYER_WALK_SPEED = 5;
export const PLAYER_SPRINT_SPEED = 8;
export const PLAYER_ROTATION_SPEED = 15;
export const PLAYER_RADIUS = 0.5;
export const EXHAUSTED_WALK_SPEED = 3;

// ── Player Stats ────────────────────────────────────────────
export const MAX_HP = 100;
export const MAX_STAMINA = 100;
export const MAX_HEAL_CHARGES = 3;
export const HEAL_AMOUNT = 35;
export const STAMINA_REGEN_RATE = 25;
export const STAMINA_REGEN_DELAY = 0.4;
export const EXHAUSTION_CLEAR_THRESHOLD = 20;

// ── Stamina Costs ───────────────────────────────────────────
export const STAMINA_COST_DODGE = 20;
export const STAMINA_COST_LIGHT_ATTACK = 12;
export const STAMINA_COST_HEAVY_ATTACK = 25;
export const STAMINA_COST_PARRY = 8;
export const SPRINT_STAMINA_PER_SEC = 3;

// ── Dodge ───────────────────────────────────────────────────
export const DODGE_DISTANCE = 4;
export const DODGE_DURATION = 0.3;
export const DODGE_RECOVERY = 0.1;
export const IFRAME_START = 0.05;
export const IFRAME_END = 0.25;

// ── Parry ───────────────────────────────────────────────────
export const PARRY_WINDOW = 0.15;
export const PARRY_RECOVERY = 0.2;
export const PARRY_STAMINA_RECOVERY = 10;
export const PARRY_BUFF_DURATION = 3.0;
export const PARRY_BUFF_MULTIPLIER = 1.5;

// ── Heal ────────────────────────────────────────────────────
export const HEAL_DURATION = 0.8;

// ── Light Attack ────────────────────────────────────────────
export const LIGHT_TELEGRAPH = 0.1;
export const LIGHT_ACTIVE = 0.15;
export const LIGHT_RECOVERY = 0.2;
export const LIGHT_HITBOX_RADIUS = 2.5;
export const LIGHT_HITBOX_ARC_DEG = 120;
export const MAX_LIGHT_COMBO = 2;

// ── Heavy Attack ────────────────────────────────────────────
export const HEAVY_CHARGE_MIN = 0.3;
export const HEAVY_CHARGE_MAX = 0.8;
export const HEAVY_TELEGRAPH = 0.25;
export const HEAVY_ACTIVE = 0.2;
export const HEAVY_RECOVERY = 0.3;
export const HEAVY_HITBOX_RADIUS = 2.5;
export const HEAVY_HITBOX_ARC_DEG = 120;
export const HEAVY_DAMAGE_MULT_MIN = 1.5;
export const HEAVY_DAMAGE_MULT_MAX = 2.0;

// ── Camera ──────────────────────────────────────────────────
export const CAMERA_DISTANCE = 8;
export const CAMERA_HEIGHT_OFFSET = 3;
export const CAMERA_FOLLOW_SMOOTHING = 0.1;
export const CAMERA_SENSITIVITY_X = 0.003;
export const CAMERA_SENSITIVITY_Y = 0.003;
export const LOCK_ON_RANGE = 15;

// ── Input ───────────────────────────────────────────────────
export const INPUT_BUFFER_MS = 150;

// ── World ───────────────────────────────────────────────────
export const ARENA_SIZE = 20;
export const WALL_HEIGHT = 3;
export const WALL_THICKNESS = 0.4;
export const DOOR_INTERACT_RANGE = 2.5;

// ── Pickups ─────────────────────────────────────────────────
export const PICKUP_COLLECTION_RADIUS = 2;
export const PICKUP_MAGNET_RADIUS = 3;
export const PICKUP_LIFETIME = 30;

// ── Enemy ───────────────────────────────────────────────────
export const ENEMY_HIT_FLASH_DURATION = 0.12;
export const ENEMY_DEATH_CLEANUP_DELAY = 1.5;
export const ENEMY_SHATTER_PIECE_COUNT = 8;

// ── Physics ─────────────────────────────────────────────────
export const GRAVITY = -9.8;
