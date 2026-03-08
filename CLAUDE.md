# CLAUDE.md — Celtest Project Guide

## What This Is

3D cel-shaded soulslike roguelike built with **Three.js + TypeScript + Vite**. Humans have collapsed into abstract geometric shapes. The player is an unstable form fighting through zones of collapsed humanity.

**Current state**: 47 of 86 tasks complete (T-001–T-046 + T-BUG-001). The game is playable — player combat, three enemy types (TriangleShard, CubeSentinel, SpiralDancer), wave-based encounters, zone progression, death/retry loop, save system all functional. Phase 6 (T-047–T-085) is in progress: 39 tasks covering enemy variety, weapons, audio, game flow, meta-progression, UI, and polish.

## Stack

- **Three.js** (r160+) — rendering, scene graph, materials
- **TypeScript** (strict mode) — all source code
- **Vite** — build tool and dev server
- **Howler.js** — audio
- **Vitest** — testing
- **No physics engine** — custom AABB/sphere collisions only
- **No UI framework** — HUD/menus are plain HTML/CSS overlay on canvas

## Project Layout

```
docs/                — 12 design documents (architecture, enemies, combat, etc.)
tasks/TASKS.md       — 39 remaining tasks in Phase 6 (see tasks/completed/ for done work)
tasks/completed/     — Archived completed tasks grouped by system area (5 files)
data/enemies/        — Enemy JSON data (triangle-shard.json, cube-sentinel.json, spiral-dancer.json)
data/weapons/        — Weapon JSON (fracture-blade.json)
data/rooms/          — Room module JSON (atrium-room-square.json)
data/encounters/     — Encounter wave JSON (zone1-encounters.json)
src/                 — 64 TypeScript source files (see subfolder table below)
```

### Key src/ Subfolders

| Folder | Owns |
|--------|------|
| `app/` | Game.ts (composition root), GameLoop.ts, EventBus.ts, InputManager.ts |
| `engine/` | AssetLoader, CollisionSystem, Clock, ObjectPool |
| `rendering/` | Renderer, CelShadingPipeline, PostProcessing, ParticleSystem |
| `shaders/` | GLSL as TypeScript template literal strings (cel, outline) |
| `player/` | PlayerController, PlayerStateMachine, PlayerStats, PlayerModel |
| `player/states/` | One file per player state (Idle, Run, Dodge, LightAttack, HeavyAttack, Parry, Heal, Dead, TimedStub) + shared `PlayerContext` interface. Barrel-exported via `index.ts` |
| `camera/` | CameraController, LockOnSystem, CameraShake |
| `combat/` | CombatSystem, HitboxManager, DamageCalculator, WeaponSystem, StaggerSystem |
| `enemies/` | BaseEnemy (abstract), EnemyFactory, EnemyRegistry, `shared.ts` (common utilities) |
| `enemies/triangle-shard/` | TriangleShard.ts + states.ts (5 AI states) |
| `enemies/cube-sentinel/` | CubeSentinel.ts + states.ts (6 AI states) |
| `enemies/spiral-dancer/` | SpiralDancer.ts + states.ts (6 AI states) |
| `ai/` | StateMachine (generic FSM), AIState |
| `world/` | RoomAssembler, RoomModule, ZoneGenerator, DoorSystem, EncounterManager |
| `levels/` | Zone1Config, ZoneRegistry |
| `interactions/` | PickupSystem, Interactable |
| `ui/` | HUD, MenuSystem, DamageNumbers, UIManager — all HTML/CSS |
| `progression/` | RunState |
| `utils/` | debug.ts |

## Architecture Rules

- **Game.ts is the composition root**. It instantiates all systems and passes references. No global singletons — use constructor injection.
- **EventBus for decoupled communication**. Systems emit typed events (`PLAYER_DAMAGED`, `ENEMY_DIED`, `ROOM_CLEARED`, etc.). Never import system-to-system for notifications.
- **Fixed-timestep game loop**: 60Hz update with accumulator pattern, variable render rate.
- **FSM everywhere**: Player states and enemy AI both use the same generic `StateMachine` class in `src/ai/StateMachine.ts`.
- **Data-driven content**: Enemies, weapons, rooms, encounters are all JSON in `data/`. Add new content by adding JSON + a behavior class, not by modifying core systems.
- **Hitbox/hurtbox model**: Hitboxes are temporary (active during attack window only). Hurtboxes are persistent. One hit per attack instance per target. No physics.

## Critical Conventions

### No Magic Numbers
All tuning values (speeds, damages, stamina costs, timing windows) live in centralized config (`src/config/`). Use the config system — don't inline magic numbers.

### Data Schemas Are Canonical
TypeScript interfaces in `docs/DATA_SCHEMAS.md` define the shape of all JSON files. Enemy JSON, weapon JSON, room JSON, encounter JSON must conform. Schemas include: `EnemyData`, `AttackData`, `RoomModuleData`, `EncounterData`, `WeaponData`, `PlayerStats`, `UnlockData`, `FSMStateConfig`.

### Enemy Implementation Pattern
1. Create `data/enemies/{id}.json` conforming to `EnemyData` schema
2. Create `src/enemies/{id}/` subfolder with `{Name}.ts` extending `BaseEnemy` and `states.ts` for AI states
3. Override `createMesh()` and `initFSM()`. Use utilities from `src/enemies/shared.ts` (`distToPlayer`, `pickAttack`)
4. Register in `EnemyRegistry` — factory handles the rest
5. Add side-effect import in `Game.ts`: `import '../enemies/{id}/{Name}';`

### Player State Machine States
`idle`, `run`, `dodge`, `light_attack`, `heavy_attack`, `stagger`, `parry`, `heal`, `dead`. Use a state registry pattern so new states can be added without modifying the FSM core.

### UI Is HTML/CSS
All UI (HUD, menus, damage numbers) is `position: absolute` HTML/CSS overlay on the Three.js canvas. Not rendered on canvas. CSS animations for transitions.

### Cel-Shading
Custom `ShaderMaterial` with 4-step toon ramp. Material factory: `createCelMaterial(baseColor)`. No image textures on geometry — color from material properties only.

### Performance Targets
- 60fps on mid-range hardware
- Draw calls under 200/frame
- Object pool particles, projectiles, damage numbers, pickups — no runtime allocation in combat

## Task System

47 of 86 tasks complete. `tasks/TASKS.md` contains completed Phase 5 tasks (T-042–T-046, T-BUG-001) and all Phase 6 tasks (T-047–T-085). Earlier completed tasks are archived in `tasks/completed/`:

| Archive | Tasks |
|---------|-------|
| `completed/core-infrastructure.md` | T-001, T-003, T-004, T-005, T-014, T-024 |
| `completed/player-combat.md` | T-002, T-006–T-010, T-015–T-019, T-031, T-039–T-041 |
| `completed/enemies.md` | T-020–T-023 |
| `completed/world-progression.md` | T-013, T-027–T-030, T-035–T-037 |
| `completed/rendering-ui-polish.md` | T-011, T-012, T-025, T-026, T-032–T-034, T-038 |

**Next open task**: T-047 (Monolith Brute enemy). See `tasks/TASKS.md` for full Phase 6 breakdown: enemies (T-047–T-050), weapons (T-051–T-055), rooms (T-056–T-058), world (T-059–T-061), UI/flow (T-062–T-076), combat (T-077–T-079), polish (T-080–T-082), tooling (T-083–T-085).

### Work Types

Every task has a **Work Type** field that categorizes its domain. Agents should stay within their Work Type's file boundaries:

| Work Type | Scope | Stay within |
|-----------|-------|-------------|
| `infrastructure` | Bootstrap, config, event bus, collision primitives, loaders, pools | `src/app/`, `src/engine/`, `src/config/`, `src/utils/` |
| `gameplay` | Player mechanics, combat, AI, enemy behavior, interactions | `src/player/`, `src/combat/`, `src/enemies/`, `src/ai/`, `src/camera/`, `src/interactions/` |
| `rendering` | Shaders, materials, post-processing, mesh creation | `src/rendering/`, `src/shaders/`, `src/player/PlayerModel.ts` |
| `data` | JSON schemas, registries, factory patterns | `data/`, `src/enemies/EnemyFactory.ts`, `src/enemies/EnemyRegistry.ts` |
| `world` | Rooms, zones, encounters, doors, hazards | `src/world/`, `src/levels/` |
| `UI` | HUD, menus, overlays | `src/ui/` |
| `tooling` | Debug tools, dev utilities | `src/utils/debug.ts` |
| `polish` | Particles, camera shake, damage numbers, VFX | `src/rendering/ParticleSystem.ts`, `src/camera/CameraShake.ts`, `src/ui/DamageNumbers.ts` |
| `meta` | Save, progression, run state | `src/progression/`, `src/save/` |

**Key boundary rules**: gameplay agents don't touch rendering pipeline. Rendering agents don't touch combat logic. Polish agents don't change balance values. Data agents don't modify engine internals.

### Task Completion Protocol
- Prepend `[DONE]` to completed task titles in `tasks/TASKS.md`
- Add `[BLOCKED: reason]` if stuck
- New bugs: `T-BUG-{number}`
- Branch per task: `feat/T-{ID}-{short-name}`

## High-Conflict Files (Coordinate Carefully)

These files are touched by many tasks. Use registry/array patterns so additions don't require editing existing lines:

- `src/app/Game.ts` — system registration
- `src/player/PlayerStateMachine.ts` — state additions
- `src/player/PlayerController.ts` — movement + collision
- `src/combat/CombatSystem.ts` — hit resolution
- `src/main.ts` — entry point

All files in `data/`, `src/enemies/` (except BaseEnemy), `src/ui/`, `src/shaders/`, and `tests/` are safe to work on independently.

## Key Design Decisions

- **No jump**. Grounded combat only.
- **No dialogue/text**. Lore is environmental and behavioral.
- **No inventory**. Weapons are equipped-or-not, max 2 carried.
- **Roguelike meta-progression expands variety, not power**. Unlocks add to the pool. Stat caps at +20%.
- **Rooms are data-driven prefab assemblies**, not procedurally generated geometry.
- **Stamina gates everything**: attack (12), dodge (20), heavy (25), sprint (3/s). Regen 25/s after 400ms pause. Exhaustion at 0 until 20.
- **All attacks telegraph**: minimum 300ms wind-up. Red glow = melee, orange = ranged, white flash = unblockable.

## Reference Docs

| Need to know about... | Read |
|------------------------|------|
| System boundaries and dependencies | `docs/ARCHITECTURE.md` |
| Enemy stats, attacks, behavior | `docs/ENEMY_BIBLE.md` |
| Zone themes, hazards, room modules | `docs/ENVIRONMENT_BIBLE.md` |
| Player kit, stamina, combat pacing | `docs/PLAYER_AND_COMBAT_SPEC.md` |
| JSON data shapes and examples | `docs/DATA_SCHEMAS.md` |
| Remaining tasks and open bugs | `tasks/TASKS.md` |
| What was already built (by area) | `tasks/completed/*.md` |
| Implementation order and phasing | `docs/AGENT_EXECUTION_PLAN.md` |
| Minimum playable vertical slice | `docs/FIRST_IMPLEMENTATION_SLICE.md` |
| File/folder layout | `docs/PROJECT_STRUCTURE.md` |
| Seed TODO checklists per file | `docs/TODO_SEED_FILES.md` |
