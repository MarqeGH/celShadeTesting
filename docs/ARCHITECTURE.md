# Architecture

## System Overview

```
┌──────────────────────────────────────────────────────┐
│                    Game (app/Game.ts)                 │
│  Owns: loop, scene manager, event bus, all systems   │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────┐  ┌──────────┐  ┌───────────────────┐   │
│  │  Input   │→│  Player   │→│  Combat System    │   │
│  │  System  │  │Controller│  │  (hit resolution) │   │
│  └─────────┘  └──────────┘  └───────────────────┘   │
│       │            │               │                 │
│       ▼            ▼               ▼                 │
│  ┌─────────┐  ┌──────────┐  ┌───────────────────┐   │
│  │ Camera  │  │  Enemy   │  │  Damage Calculator │   │
│  │Controller│  │  System  │  │  + Stagger System │   │
│  └─────────┘  └──────────┘  └───────────────────┘   │
│                    │                                 │
│                    ▼                                 │
│  ┌─────────────────────────────────────────────┐     │
│  │              AI / State Machines             │     │
│  └─────────────────────────────────────────────┘     │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐   │
│  │  World   │  │Progression│  │   UI / HUD       │   │
│  │  System  │  │  System  │  │   (HTML overlay)  │   │
│  └──────────┘  └──────────┘  └───────────────────┘   │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐   │
│  │  Audio   │  │   Save   │  │   Debug / Dev     │   │
│  │  Manager │  │  Manager │  │   Tools           │   │
│  └──────────┘  └──────────┘  └───────────────────┘   │
│                                                      │
├──────────────────────────────────────────────────────┤
│            Rendering Pipeline (Three.js)             │
│  Renderer → CelShading → PostProcessing → Screen    │
└──────────────────────────────────────────────────────┘
```

---

## System Definitions

### 1. App Bootstrap

| Field | Value |
|-------|-------|
| **Responsibility** | Initialize Three.js, create game systems, start loop |
| **Dependencies** | None (root) |
| **Files** | `src/main.ts`, `src/app/Game.ts`, `src/app/GameLoop.ts` |
| **Notes** | `Game.ts` is the composition root. It instantiates all systems and passes references. No global singletons — use dependency injection via constructor. |

### 2. Render Loop

| Field | Value |
|-------|-------|
| **Responsibility** | Fixed-timestep update (60Hz), variable render, delta time management |
| **Dependencies** | App Bootstrap |
| **Files** | `src/app/GameLoop.ts`, `src/engine/Clock.ts` |
| **Notes** | Use fixed timestep for gameplay logic (16.67ms). Render at display refresh rate. Accumulator pattern: `while (accumulator >= fixedStep) { update(fixedStep); accumulator -= fixedStep; } render(alpha);` |

### 3. Event Bus

| Field | Value |
|-------|-------|
| **Responsibility** | Decoupled communication between systems |
| **Dependencies** | None |
| **Files** | `src/app/EventBus.ts` |
| **Notes** | Typed events. Systems emit events (e.g., `PLAYER_HIT`, `ENEMY_DIED`, `ROOM_CLEARED`). Other systems subscribe. Avoids circular dependencies. Keep event list in a single enum/const file. |

Key events:
- `PLAYER_DAMAGED` — HUD listens, camera shake listens
- `ENEMY_DAMAGED` — damage numbers listen, stagger system listens
- `ENEMY_DIED` — encounter system listens, pickup system listens
- `ROOM_CLEARED` — door system listens, progression listens
- `PLAYER_DIED` — run state listens, UI listens
- `RUN_STARTED` / `RUN_ENDED` — progression and save listen

### 4. Input System

| Field | Value |
|-------|-------|
| **Responsibility** | Keyboard + mouse + gamepad input abstraction |
| **Dependencies** | None |
| **Files** | `src/app/InputManager.ts` (add to structure) |
| **Notes** | Maps raw inputs to game actions (`attack`, `dodge`, `move_forward`, `lock_on`). Supports rebinding. Polls once per frame. Provides `isPressed`, `justPressed`, `justReleased`. Buffer system for attack queuing (150ms buffer). |

### 5. Rendering Pipeline

| Field | Value |
|-------|-------|
| **Responsibility** | Three.js scene rendering with cel-shading and post-processing |
| **Dependencies** | App Bootstrap |
| **Files** | `src/rendering/Renderer.ts`, `src/rendering/CelShadingPipeline.ts`, `src/rendering/PostProcessing.ts`, `src/shaders/*` |
| **Notes** | Cel-shading via custom ShaderMaterial with toon ramp texture. Outline pass via inverted hull method or post-process edge detection. Post-processing chain: outline → color grading → optional chromatic aberration on damage. All materials should be created from a factory that applies the cel-shade pipeline. |

### 6. Player Controller

| Field | Value |
|-------|-------|
| **Responsibility** | Player movement, state management, input-to-action routing |
| **Dependencies** | Input System, Combat System, Camera |
| **Files** | `src/player/PlayerController.ts`, `src/player/PlayerStateMachine.ts`, `src/player/PlayerStats.ts`, `src/player/PlayerAnimator.ts`, `src/player/PlayerModel.ts` |
| **Notes** | State machine states: `idle`, `run`, `dodge`, `light_attack`, `heavy_attack`, `stagger`, `heal`, `dead`. Movement is camera-relative. Dodge has i-frames (configurable window). Player mesh is a flickering polyhedron with vertex displacement noise. |

State transition rules:
```
idle → run (movement input)
idle → dodge (dodge input + stamina)
idle → light_attack (attack input + stamina)
idle → heal (heal input + heal charges)
any → stagger (on hit, if poise broken)
any → dead (HP ≤ 0)
stagger → idle (after stagger duration)
dodge → idle (after dodge duration)
light_attack → idle (after attack duration)
light_attack → light_attack (combo input during combo window)
```

### 7. Camera / Lock-On

| Field | Value |
|-------|-------|
| **Responsibility** | Third-person camera follow, lock-on targeting, shake |
| **Dependencies** | Player Controller, Enemy System |
| **Files** | `src/camera/CameraController.ts`, `src/camera/LockOnSystem.ts`, `src/camera/CameraShake.ts` |
| **Notes** | Default: third-person orbit with right-stick/mouse look. Lock-on: camera focuses between player and target, movement becomes strafe-relative. Target switching via input while locked on. Camera collision with environment via raycasting. Shake is additive offset with decay. |

### 8. Combat System

| Field | Value |
|-------|-------|
| **Responsibility** | Hit detection, damage application, combat event dispatch |
| **Dependencies** | Hitbox Manager, Damage Calculator, Stagger System, Event Bus |
| **Files** | `src/combat/CombatSystem.ts`, `src/combat/HitboxManager.ts`, `src/combat/DamageCalculator.ts`, `src/combat/WeaponSystem.ts`, `src/combat/StaggerSystem.ts` |
| **Notes** | Each frame: active hitboxes are checked against active hurtboxes. Hits are deduplicated per attack instance (one hit per swing per target). Damage flows: `hitbox overlap → DamageCalculator.calculate(attacker, defender, attack) → apply damage → emit event → stagger check`. |

### 9. Hitbox / Hurtbox System

| Field | Value |
|-------|-------|
| **Responsibility** | Manage spatial volumes for attack and vulnerability detection |
| **Dependencies** | Collision System |
| **Files** | `src/combat/HitboxManager.ts`, `src/engine/CollisionSystem.ts` |
| **Notes** | Hitboxes: attached to attackers, active only during attack window. Hurtboxes: attached to all damageable entities, always active. Both are simple shapes (sphere, AABB). Hitboxes carry: owner ID, damage data, attack instance ID. Hurtboxes carry: owner reference. No physics — just overlap tests. |

### 10. Enemy AI / State Machines

| Field | Value |
|-------|-------|
| **Responsibility** | Enemy decision-making and behavior execution |
| **Dependencies** | Perception, Player position, Combat System |
| **Files** | `src/ai/StateMachine.ts`, `src/ai/AIState.ts`, `src/ai/Perception.ts`, `src/ai/states/*` |
| **Notes** | Generic FSM that enemies instantiate with per-type state configurations. States are classes with `enter()`, `update(dt)`, `exit()`. Transitions are condition-based (distance thresholds, timers, health thresholds). Perception provides: distance to player, can-see-player, time since last hit. States are reusable across enemy types — a Triangle and a Cube can both use `ChaseState` with different speed configs. |

### 11. Enemy System

| Field | Value |
|-------|-------|
| **Responsibility** | Enemy lifecycle: spawning, updating, death, cleanup |
| **Dependencies** | AI, Combat, Rendering, Data Loading |
| **Files** | `src/enemies/BaseEnemy.ts`, `src/enemies/EnemyFactory.ts`, `src/enemies/EnemyRegistry.ts`, per-enemy files |
| **Notes** | `BaseEnemy` owns: mesh, FSM, stats, hitbox/hurtbox references. `EnemyFactory` reads data JSON, creates instance of correct class. `EnemyRegistry` maps string type IDs to class constructors. New enemy type = new class + new JSON data + registry entry. |

### 12. Level / World Composition

| Field | Value |
|-------|-------|
| **Responsibility** | Assemble rooms into zones, manage room transitions |
| **Dependencies** | Data Loading, Encounter Spawning, Rendering |
| **Files** | `src/world/RoomAssembler.ts`, `src/world/RoomModule.ts`, `src/world/ZoneGenerator.ts`, `src/world/DoorSystem.ts` |
| **Notes** | Zones are linear sequences of 5–8 rooms with branching paths. Each room is a `RoomModule`: floor geometry, walls, spawn points, exit positions, hazard placements. `ZoneGenerator` picks rooms from zone-specific pool, connects exits. Rooms are loaded, positioned, and activated on entry. Only current + adjacent rooms are in the scene. |

### 13. Encounter Spawning

| Field | Value |
|-------|-------|
| **Responsibility** | Populate rooms with enemies based on encounter data |
| **Dependencies** | Enemy Factory, Room Module, Event Bus |
| **Files** | `src/world/EncounterManager.ts` (add to structure) |
| **Notes** | Encounters are data-defined: `{ enemies: [{type, count, spawnPoint}], waves: [...] }`. Triggered on room entry. Tracks alive enemy count. Emits `ROOM_CLEARED` when all waves defeated. Supports wave-based spawning with delays. |

### 14. Progression / Run State

| Field | Value |
|-------|-------|
| **Responsibility** | Track current run state and persistent meta-progression |
| **Dependencies** | Event Bus, Save System |
| **Files** | `src/progression/RunState.ts`, `src/progression/MetaProgression.ts`, `src/progression/UnlockRegistry.ts` |
| **Notes** | `RunState`: current zone, room index, HP, stamina, equipped weapon, collected shards, active buffs. Reset on death. `MetaProgression`: total shards spent, unlocked weapons, unlocked abilities. Persists via SaveManager. Unlocks expand the pool, not raw power. |

### 15. UI / HUD

| Field | Value |
|-------|-------|
| **Responsibility** | Player-facing information display |
| **Dependencies** | Event Bus, Player Stats, Run State |
| **Files** | `src/ui/HUD.ts`, `src/ui/MenuSystem.ts`, `src/ui/DamageNumbers.ts`, `src/ui/UIManager.ts` |
| **Notes** | HTML/CSS overlay positioned via `position: absolute` over the Three.js canvas. HUD shows: HP bar, stamina bar, shard count, heal charges. Damage numbers are CSS-animated floating text. Menus: pause, death screen, hub/shop. UIManager controls which layers are visible per game state. |

### 16. Save / Meta Progression

| Field | Value |
|-------|-------|
| **Responsibility** | Persist player progression between sessions |
| **Dependencies** | None |
| **Files** | `src/save/SaveManager.ts`, `src/save/SaveSchema.ts` |
| **Notes** | localStorage-based. Schema versioned for migrations. Saves: unlocks, total currency, settings, best run stats. Does NOT save mid-run state (roguelike — death = reset). Save/load is synchronous. |

### 17. Data Loading

| Field | Value |
|-------|-------|
| **Responsibility** | Load JSON data files and assets at startup and zone transitions |
| **Dependencies** | None |
| **Files** | `src/engine/AssetLoader.ts` |
| **Notes** | Loads: enemy data (JSON), room modules (JSON), weapon data (JSON), GLTF models, textures, audio. Returns typed data. Loading screen between zones. Preload zone assets on zone selection. Use Three.js loaders (GLTFLoader, TextureLoader) with a wrapper for promises and progress tracking. |

### 18. Audio System

| Field | Value |
|-------|-------|
| **Responsibility** | Play music and sound effects |
| **Dependencies** | Event Bus |
| **Files** | `src/audio/AudioManager.ts`, `src/audio/SFXRegistry.ts` |
| **Notes** | Howler.js for cross-browser audio. SFXRegistry maps event names to audio file paths. AudioManager exposes: `playSFX(id)`, `playMusic(id)`, `stopMusic()`, volume controls. Events like `PLAYER_DAMAGED` auto-trigger associated SFX via EventBus subscription. |

### 19. Debug / Dev Tools

| Field | Value |
|-------|-------|
| **Responsibility** | Development aids: FPS, collider viz, state display, god mode |
| **Dependencies** | All systems (read-only access) |
| **Files** | `src/utils/debug.ts` |
| **Notes** | Toggle via key (F1). Shows: FPS counter, active hitbox/hurtbox wireframes, enemy FSM state labels, player state, draw call count. God mode: invincibility toggle, instant kill toggle. Must be strippable for production builds via build flag. |
