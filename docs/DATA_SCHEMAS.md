# Data Schemas

> All data is JSON, loaded at runtime. TypeScript interfaces are provided as canonical schema definitions. JSON files in `data/` must conform to these interfaces.

---

## Enemy Schema

```typescript
interface EnemyData {
  id: string;                    // Unique identifier, e.g., "triangle-shard"
  name: string;                  // Display name
  shape: string;                 // Shape type for model loading
  stats: {
    maxHP: number;
    moveSpeed: number;           // m/s
    turnSpeed: number;           // degrees/s
    poise: number;               // Stagger threshold
    poiseRegenDelay: number;     // ms before poise starts recovering
    poiseRegenRate: number;      // poise/s
  };
  perception: {
    aggroRange: number;          // meters — distance to notice player
    attackRange: number;         // meters — distance to begin attack
    retreatRange: number;        // meters — distance to back away (0 = never)
    losRequired: boolean;        // line of sight needed for aggro?
  };
  attacks: AttackData[];
  drops: {
    shards: { min: number; max: number };
    fragmentChance: number;      // 0.0–1.0
  };
  fsm: {
    initialState: string;
    states: FSMStateConfig[];
  };
}
```

### Example: `data/enemies/triangle-shard.json`
```json
{
  "id": "triangle-shard",
  "name": "Triangle Shard",
  "shape": "triangle",
  "stats": {
    "maxHP": 30,
    "moveSpeed": 6,
    "turnSpeed": 180,
    "poise": 20,
    "poiseRegenDelay": 2000,
    "poiseRegenRate": 5
  },
  "perception": {
    "aggroRange": 10,
    "attackRange": 4,
    "retreatRange": 0,
    "losRequired": true
  },
  "attacks": [
    {
      "id": "lunge",
      "name": "Lunge",
      "telegraphDuration": 400,
      "activeDuration": 200,
      "recoveryDuration": 600,
      "damage": 15,
      "staggerDamage": 10,
      "range": 4,
      "hitboxShape": "line",
      "hitboxSize": { "length": 4, "width": 1 },
      "movementDuringAttack": { "type": "dash", "distance": 4, "speed": 20 }
    },
    {
      "id": "slash",
      "name": "Slash",
      "telegraphDuration": 300,
      "activeDuration": 150,
      "recoveryDuration": 400,
      "damage": 10,
      "staggerDamage": 5,
      "range": 2,
      "hitboxShape": "arc",
      "hitboxSize": { "radius": 2, "angle": 90 },
      "movementDuringAttack": null
    }
  ],
  "drops": {
    "shards": { "min": 3, "max": 7 },
    "fragmentChance": 0.05
  },
  "fsm": {
    "initialState": "idle",
    "states": [
      {
        "name": "idle",
        "transitions": [
          { "to": "chase", "condition": "playerInAggroRange" }
        ]
      },
      {
        "name": "chase",
        "transitions": [
          { "to": "attack", "condition": "playerInAttackRange" },
          { "to": "idle", "condition": "playerOutOfAggroRange" }
        ]
      },
      {
        "name": "attack",
        "params": { "attackPool": ["lunge", "slash"], "attackCooldown": 800 },
        "transitions": [
          { "to": "chase", "condition": "attackComplete_and_playerOutOfAttackRange" },
          { "to": "attack", "condition": "attackComplete_and_playerInAttackRange_and_cooldownReady" }
        ]
      },
      {
        "name": "staggered",
        "params": { "duration": 1000 },
        "transitions": [
          { "to": "chase", "condition": "staggerComplete" }
        ]
      }
    ]
  }
}
```

---

## Attack Schema

```typescript
interface AttackData {
  id: string;
  name: string;
  telegraphDuration: number;     // ms
  activeDuration: number;        // ms — hitbox active window
  recoveryDuration: number;      // ms — vulnerable after attack
  damage: number;
  staggerDamage: number;         // poise damage to target
  range: number;                 // meters
  hitboxShape: "sphere" | "arc" | "line" | "circle";
  hitboxSize: Record<string, number>;  // shape-dependent dimensions
  movementDuringAttack: {
    type: "dash" | "step" | "none";
    distance: number;
    speed: number;
  } | null;
  projectile?: ProjectileData;   // if ranged
}

interface ProjectileData {
  shape: string;                 // mesh/visual type
  speed: number;                 // m/s
  lifetime: number;              // ms
  size: number;                  // meters (radius)
  homing: boolean;
  homingStrength?: number;       // turning rate if homing
}
```

---

## Encounter Schema

```typescript
interface EncounterData {
  id: string;
  difficulty: number;            // 1–10 scale
  waves: EncounterWave[];
  roomConstraints?: string[];    // Room module IDs this encounter works in (empty = any)
}

interface EncounterWave {
  delay: number;                 // ms after previous wave cleared (or room entry for wave 0)
  spawns: SpawnEntry[];
}

interface SpawnEntry {
  enemyId: string;               // references EnemyData.id
  count: number;
  spawnPoint: "random" | "nearest" | "farthest" | number; // index or strategy
}
```

### Example: `data/encounters/zone1-encounters.json`
```json
[
  {
    "id": "z1-intro",
    "difficulty": 1,
    "waves": [
      {
        "delay": 0,
        "spawns": [
          { "enemyId": "triangle-shard", "count": 2, "spawnPoint": "random" }
        ]
      }
    ]
  },
  {
    "id": "z1-ranged-intro",
    "difficulty": 3,
    "waves": [
      {
        "delay": 0,
        "spawns": [
          { "enemyId": "triangle-shard", "count": 2, "spawnPoint": "nearest" },
          { "enemyId": "cube-sentinel", "count": 1, "spawnPoint": "farthest" }
        ]
      }
    ]
  },
  {
    "id": "z1-wave-fight",
    "difficulty": 5,
    "waves": [
      {
        "delay": 0,
        "spawns": [
          { "enemyId": "triangle-shard", "count": 3, "spawnPoint": "random" }
        ]
      },
      {
        "delay": 1000,
        "spawns": [
          { "enemyId": "cube-sentinel", "count": 2, "spawnPoint": "farthest" }
        ]
      }
    ]
  }
]
```

---

## Room Module Schema

```typescript
interface RoomModuleData {
  id: string;
  zone: string;                  // which zone this belongs to
  size: { x: number; y: number; z: number };  // meters
  geometry: string;              // reference to geometry asset or procedural type
  spawnPoints: Vec3[];           // enemy spawn positions
  playerEntry: Vec3;             // where player enters
  exits: ExitPoint[];
  hazards: HazardPlacement[];
  props: PropPlacement[];        // decorative or interactive objects
}

interface ExitPoint {
  position: Vec3;
  direction: "north" | "south" | "east" | "west";
  locked: boolean;               // requires room cleared to open
}

interface HazardPlacement {
  type: string;                  // hazard type ID
  position: Vec3;
  params: Record<string, number>; // type-specific (radius, interval, etc.)
}

interface PropPlacement {
  type: string;
  position: Vec3;
  rotation: Vec3;
  scale: number;
}

type Vec3 = { x: number; y: number; z: number };
```

### Example: `data/rooms/atrium-room-square.json`
```json
{
  "id": "atrium-room-square",
  "zone": "shattered-atrium",
  "size": { "x": 12, "y": 4, "z": 12 },
  "geometry": "prefab:atrium-room-square",
  "spawnPoints": [
    { "x": -4, "y": 0, "z": -4 },
    { "x": 4, "y": 0, "z": -4 },
    { "x": -4, "y": 0, "z": 4 },
    { "x": 4, "y": 0, "z": 4 }
  ],
  "playerEntry": { "x": 0, "y": 0, "z": -5.5 },
  "exits": [
    { "position": { "x": 0, "y": 0, "z": 5.5 }, "direction": "north", "locked": true },
    { "position": { "x": 5.5, "y": 0, "z": 0 }, "direction": "east", "locked": true }
  ],
  "hazards": [
    {
      "type": "static-discharge",
      "position": { "x": 3, "y": 0, "z": 3 },
      "params": { "radius": 1.5, "damagePerTick": 5, "tickInterval": 1000 }
    }
  ],
  "props": [
    { "type": "pillar-cracked", "position": { "x": 0, "y": 0, "z": 0 }, "rotation": { "x": 0, "y": 0, "z": 0 }, "scale": 1.0 }
  ]
}
```

---

## Weapon Schema

```typescript
interface WeaponData {
  id: string;
  name: string;
  description: string;
  baseDamage: number;
  heavyMultiplier: number;
  attackSpeed: number;           // multiplier (1.0 = normal)
  range: number;                 // meters
  staggerDamage: number;
  comboHits: number;             // light combo chain length
  staminaCostLight: number;
  staminaCostHeavy: number;
  hitboxShape: "arc" | "line" | "sphere";
  hitboxSize: Record<string, number>;
  unlockCost: number;            // meta-currency to unlock (0 = starter)
}
```

### Example: `data/weapons/fracture-blade.json`
```json
{
  "id": "fracture-blade",
  "name": "Fracture Blade",
  "description": "A jagged shard. Balanced. Reliable.",
  "baseDamage": 18,
  "heavyMultiplier": 2.0,
  "attackSpeed": 1.0,
  "range": 2.5,
  "staggerDamage": 15,
  "comboHits": 2,
  "staminaCostLight": 12,
  "staminaCostHeavy": 25,
  "hitboxShape": "arc",
  "hitboxSize": { "radius": 2.5, "angle": 120 },
  "unlockCost": 0
}
```

---

## Player Stats Schema

```typescript
interface PlayerStats {
  maxHP: number;
  currentHP: number;
  maxStamina: number;
  currentStamina: number;
  staminaRegenRate: number;      // per second
  staminaRegenDelay: number;     // ms
  moveSpeed: number;
  sprintSpeed: number;
  dodgeDistance: number;
  dodgeIframeStart: number;      // ms into dodge
  dodgeIframeEnd: number;        // ms into dodge
  maxHealCharges: number;
  currentHealCharges: number;
  healAmount: number;
  poise: number;
  equippedWeaponId: string;
  secondaryWeaponId: string | null;
}
```

---

## Progression / Unlock Schema

```typescript
interface UnlockData {
  id: string;
  name: string;
  description: string;
  category: "weapon" | "ability" | "stat" | "cosmetic";
  cost: number;                  // meta-currency
  prerequisite: string | null;   // another unlock ID, or null
  effect: UnlockEffect;
}

interface UnlockEffect {
  type: "add_to_pool" | "stat_bonus" | "ability_grant";
  target: string;                // weapon ID, stat name, or ability ID
  value?: number;                // for stat bonuses
}
```

### Example: `data/progression/unlocks.json`
```json
[
  {
    "id": "unlock-edge-spike",
    "name": "Edge Spike",
    "description": "A fast, short-range weapon. High attack speed, low damage.",
    "category": "weapon",
    "cost": 50,
    "prerequisite": null,
    "effect": { "type": "add_to_pool", "target": "edge-spike" }
  },
  {
    "id": "unlock-hp-1",
    "name": "Resilient Form I",
    "description": "+10 max HP",
    "category": "stat",
    "cost": 30,
    "prerequisite": null,
    "effect": { "type": "stat_bonus", "target": "maxHP", "value": 10 }
  },
  {
    "id": "unlock-hp-2",
    "name": "Resilient Form II",
    "description": "+10 max HP",
    "category": "stat",
    "cost": 80,
    "prerequisite": "unlock-hp-1",
    "effect": { "type": "stat_bonus", "target": "maxHP", "value": 10 }
  }
]
```

---

## FSM State Config Schema

```typescript
interface FSMStateConfig {
  name: string;
  params?: Record<string, any>;  // State-specific parameters
  transitions: FSMTransition[];
}

interface FSMTransition {
  to: string;                    // target state name
  condition: string;             // condition function ID (e.g., "playerInAggroRange")
}
```

### Available Conditions (standard set)
| Condition ID | Description |
|-------------|-------------|
| `playerInAggroRange` | Distance to player ≤ perception.aggroRange |
| `playerOutOfAggroRange` | Distance to player > perception.aggroRange × 1.5 |
| `playerInAttackRange` | Distance to player ≤ perception.attackRange |
| `attackComplete_and_playerOutOfAttackRange` | Last attack finished AND player out of range |
| `attackComplete_and_playerInAttackRange_and_cooldownReady` | Attack finished + in range + cooldown elapsed |
| `staggerComplete` | Stagger timer has elapsed |
| `healthBelowThreshold` | HP below configured % |
| `playerTooClose` | Distance < perception.retreatRange |
