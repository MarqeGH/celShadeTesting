# Project Structure

```
celtest/
├── public/
│   ├── index.html                  # Entry HTML shell
│   └── favicon.ico
│
├── assets/
│   ├── models/                     # GLTF/GLB geometry files
│   │   ├── player/
│   │   ├── enemies/
│   │   ├── environment/
│   │   └── props/
│   ├── textures/                   # Minimal — mostly ramp textures for cel shading
│   ├── audio/
│   │   ├── sfx/
│   │   └── music/
│   ├── fonts/
│   └── shaders/                    # Raw GLSL files if not inlined
│       ├── cel.vert
│       ├── cel.frag
│       └── outline.frag
│
├── data/                           # Runtime-loaded JSON data (enemies, weapons, rooms, etc.)
│   ├── enemies/
│   │   ├── triangle-shard.json
│   │   ├── cube-sentinel.json
│   │   └── ...
│   ├── weapons/
│   │   ├── fracture-blade.json
│   │   └── ...
│   ├── encounters/
│   │   ├── zone1-encounters.json
│   │   └── ...
│   ├── rooms/
│   │   ├── corridor-straight.json
│   │   └── ...
│   └── progression/
│       ├── unlocks.json
│       └── run-config.json
│
├── src/
│   ├── app/                        # Application bootstrap, game loop, scene management
│   │   ├── Game.ts                 # Main game class — owns loop, scene, state
│   │   ├── GameLoop.ts             # Fixed-timestep update + render loop
│   │   ├── SceneManager.ts         # Manages active Three.js scene and transitions
│   │   └── EventBus.ts             # Global pub/sub event system
│   │
│   ├── engine/                     # Low-level engine utilities
│   │   ├── Clock.ts                # Delta time, fixed step accumulator
│   │   ├── AssetLoader.ts          # GLTF, texture, JSON, audio loader
│   │   ├── ObjectPool.ts           # Generic object pool for particles, projectiles
│   │   └── CollisionSystem.ts      # AABB and sphere collision detection + response
│   │
│   ├── rendering/                  # Three.js rendering pipeline
│   │   ├── Renderer.ts             # WebGLRenderer setup, resize, render call
│   │   ├── CelShadingPipeline.ts   # Custom cel-shading material + outline pass
│   │   ├── PostProcessing.ts       # EffectComposer setup (outline, color grade, etc.)
│   │   └── ParticleSystem.ts       # Geometric particle emitters
│   │
│   ├── shaders/                    # GLSL shader source as TS template literals
│   │   ├── celVertex.ts
│   │   ├── celFragment.ts
│   │   ├── outlineVertex.ts
│   │   └── outlineFragment.ts
│   │
│   ├── player/                     # Player character systems
│   │   ├── PlayerController.ts     # Movement, input routing, state machine owner
│   │   ├── PlayerStateMachine.ts   # States: idle, run, dodge, attack, stagger, dead
│   │   ├── PlayerStats.ts          # HP, stamina, current buffs, damage calc
│   │   ├── PlayerAnimator.ts       # Animation state binding (geometric morphs/transforms)
│   │   └── PlayerModel.ts          # Three.js mesh setup for player shape
│   │
│   ├── camera/                     # Camera control
│   │   ├── CameraController.ts     # Third-person follow + orbit
│   │   ├── LockOnSystem.ts         # Target lock-on with switching
│   │   └── CameraShake.ts          # Screen shake on hits
│   │
│   ├── combat/                     # Combat resolution
│   │   ├── CombatSystem.ts         # Central damage pipeline, hit registration
│   │   ├── HitboxManager.ts        # Hitbox/hurtbox lifecycle per frame
│   │   ├── DamageCalculator.ts     # Damage formula, resistances, crits
│   │   ├── WeaponSystem.ts         # Weapon data, swing arcs, cooldowns
│   │   └── StaggerSystem.ts        # Poise, stagger thresholds, recovery
│   │
│   ├── enemies/                    # Enemy implementations
│   │   ├── BaseEnemy.ts            # Abstract enemy class — FSM, health, hitbox owner
│   │   ├── EnemyFactory.ts         # Spawns enemy instances from data
│   │   ├── EnemyRegistry.ts        # Maps enemy type IDs to classes
│   │   ├── TriangleShard.ts        # Basic melee enemy
│   │   ├── CubeSentinel.ts         # Ranged enemy
│   │   ├── SpiralDancer.ts         # Fast skirmisher
│   │   ├── MonolithBrute.ts        # Heavy bruiser
│   │   ├── LatticeWeaver.ts        # Area denial
│   │   └── PrismElite.ts           # Mini-boss
│   │
│   ├── ai/                         # AI behavior
│   │   ├── StateMachine.ts         # Generic FSM implementation
│   │   ├── AIState.ts              # Base state interface
│   │   ├── states/                 # Reusable AI states
│   │   │   ├── IdleState.ts
│   │   │   ├── PatrolState.ts
│   │   │   ├── ChaseState.ts
│   │   │   ├── AttackState.ts
│   │   │   ├── RetreatState.ts
│   │   │   └── StaggeredState.ts
│   │   └── Perception.ts           # Distance checks, line of sight, aggro
│   │
│   ├── world/                      # World/level composition
│   │   ├── RoomAssembler.ts        # Builds rooms from module data
│   │   ├── RoomModule.ts           # Single room: geometry, spawns, exits
│   │   ├── ZoneGenerator.ts        # Assembles a run's zone from room pool
│   │   ├── DoorSystem.ts           # Room transitions and gating
│   │   └── EnvironmentHazard.ts    # Hazard base class (damage zones, etc.)
│   │
│   ├── levels/                     # Zone-specific configuration
│   │   ├── Zone1Config.ts          # Shattered Atrium config
│   │   └── ZoneRegistry.ts         # Maps zone IDs to configs
│   │
│   ├── interactions/               # Non-combat interactions
│   │   ├── Interactable.ts         # Base interactable (pickups, shrines, etc.)
│   │   ├── PickupSystem.ts         # Shard/fragment/echo collection
│   │   └── ShrineSystem.ts         # Between-room healing/upgrade shrines
│   │
│   ├── progression/                # Run and meta progression
│   │   ├── RunState.ts             # Current run: floor, currency, equipped items
│   │   ├── MetaProgression.ts      # Permanent unlocks, currency
│   │   └── UnlockRegistry.ts       # Available unlocks and costs
│   │
│   ├── ui/                         # HTML/CSS overlay UI
│   │   ├── HUD.ts                  # Health bar, stamina bar, shard count
│   │   ├── MenuSystem.ts           # Pause, death, hub menus
│   │   ├── DamageNumbers.ts        # Floating damage indicators
│   │   └── UIManager.ts            # Manages UI layer visibility
│   │
│   ├── audio/                      # Audio management
│   │   ├── AudioManager.ts         # Howler.js wrapper, spatial audio
│   │   └── SFXRegistry.ts          # Maps game events to sound files
│   │
│   ├── save/                       # Persistence
│   │   ├── SaveManager.ts          # localStorage read/write
│   │   └── SaveSchema.ts           # Save data shape and migration
│   │
│   ├── utils/                      # Shared utilities
│   │   ├── math.ts                 # Lerp, clamp, random range, vectors
│   │   ├── timer.ts                # Cooldown timer helper
│   │   ├── debug.ts                # Debug overlay, FPS counter, collider viz
│   │   └── constants.ts            # Game-wide constants
│   │
│   ├── config/                     # Game configuration
│   │   ├── gameConfig.ts           # Tuning values: speeds, damages, timings
│   │   └── renderConfig.ts         # Resolution, shadow quality, post-process toggles
│   │
│   └── main.ts                     # Entry point — creates Game, starts loop
│
├── tests/
│   ├── combat/
│   │   └── DamageCalculator.test.ts
│   ├── ai/
│   │   └── StateMachine.test.ts
│   └── engine/
│       └── CollisionSystem.test.ts
│
├── tasks/                          # Task registry for agent execution
│   └── TASKS.md
│
├── docs/                           # Project documentation
│   ├── README.md
│   ├── PROJECT_STRUCTURE.md
│   ├── ARCHITECTURE.md
│   ├── GAMEPLAY_PILLARS.md
│   ├── LORE_BASIS.md
│   ├── ENEMY_BIBLE.md
│   ├── ENVIRONMENT_BIBLE.md
│   ├── PLAYER_AND_COMBAT_SPEC.md
│   ├── DATA_SCHEMAS.md
│   ├── AGENT_EXECUTION_PLAN.md
│   └── TODO_SEED_FILES.md
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .gitignore
```

## Folder Purposes

| Folder | Purpose |
|--------|---------|
| `src/app/` | Game bootstrap, main loop, scene transitions, event bus |
| `src/engine/` | Low-level utilities: asset loading, collision, object pooling |
| `src/rendering/` | Three.js renderer, cel-shading pipeline, post-processing |
| `src/shaders/` | GLSL shader source embedded as TypeScript strings |
| `src/player/` | Player movement, state machine, stats, animation |
| `src/camera/` | Third-person camera, lock-on targeting, screen shake |
| `src/combat/` | Damage resolution, hitbox lifecycle, weapons, stagger |
| `src/enemies/` | Enemy base class, factory, per-type implementations |
| `src/ai/` | Generic FSM, reusable AI states, perception/aggro |
| `src/world/` | Room assembly, zone generation, doors, hazards |
| `src/levels/` | Per-zone configuration and room pool definitions |
| `src/interactions/` | Pickups, shrines, non-combat interactables |
| `src/progression/` | Run state, meta-progression, unlock system |
| `src/ui/` | HTML/CSS overlay HUD, menus, damage numbers |
| `src/audio/` | Audio playback and event-to-sound mapping |
| `src/save/` | localStorage persistence and save data schema |
| `src/utils/` | Math helpers, timers, debug tools, constants |
| `src/config/` | Tunable game values and render settings |
| `data/` | JSON data files loaded at runtime (enemies, rooms, etc.) |
| `assets/` | Static assets: models, textures, audio, fonts |
| `tasks/` | Agent task registry and execution tracking |
| `tests/` | Unit and integration tests (Vitest) |
