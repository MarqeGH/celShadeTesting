# Task Registry

> 42 of 46 tasks completed. Remaining work below.
> Completed task details are archived in `tasks/completed/`:
> - [Core Infrastructure](completed/core-infrastructure.md) — T-001, T-003, T-004, T-005, T-014, T-024
> - [Player & Combat](completed/player-combat.md) — T-002, T-006–T-010, T-015–T-019, T-031, T-039–T-041
> - [Enemies](completed/enemies.md) — T-020–T-023
> - [World & Progression](completed/world-progression.md) — T-013, T-027–T-030, T-035–T-037
> - [Rendering, UI & Polish](completed/rendering-ui-polish.md) — T-011, T-012, T-025, T-026, T-032–T-034, T-038

---

## Remaining Tasks

### [DONE] T-042: Save System

| Field | Value |
|-------|-------|
| **Work Type** | `meta` |
| **Priority** | P2 |
| **Depends On** | T-036 |
| **Target Files** | `src/save/SaveManager.ts`, `src/save/SaveSchema.ts` |
| **Description** | Implement localStorage-based save system. SaveSchema defines shape: `{ version: number, metaCurrency: number, unlocks: string[], settings: {...}, bestRun: {...} }`. SaveManager provides: `save(data)`, `load(): SaveData`, `reset()`. Version field enables future migrations. Auto-save on run end. Load on game start. |
| **Acceptance Criteria** | Data persists across browser sessions. Schema is validated on load. Corrupted data is handled gracefully (reset to defaults). Version migration path exists. |

**Implementation note**: `SaveSchema.ts` defines `SaveData` with version, metaCurrency, unlocks, settings (volumes + cameraSensitivity), and bestRun (rooms/enemies/shards). `SaveManager.ts` provides save/load/reset with localStorage, JSON validation, version migration path, auto-save on `RUN_ENDED` (awards 50% shards as meta-currency). Wired into `Game.ts` after EventBus construction. Corrupted/missing data resets to defaults gracefully.

---

### T-043: Object Pool (Enhancement)

| Field | Value |
|-------|-------|
| **Work Type** | `infrastructure` |
| **Priority** | P1 |
| **Depends On** | T-001 |
| **Target Files** | `src/engine/ObjectPool.ts` |
| **Description** | Enhance the existing ObjectPool with `preWarm(count)` for upfront allocation at scene start. Currently used by CubeSentinel projectiles and ParticleSystem. Extend usage to damage numbers and pickups. |
| **Acceptance Criteria** | Pre-warm creates specified count upfront. All poolable systems use ObjectPool. No runtime allocation during combat. |

---

### T-044: Math Utilities

| Field | Value |
|-------|-------|
| **Work Type** | `infrastructure` |
| **Priority** | P0 |
| **Depends On** | None |
| **Target Files** | `src/utils/math.ts`, `src/utils/timer.ts`, `src/utils/constants.ts` |
| **Description** | Create utility functions. math.ts: `lerp`, `clamp`, `randomRange`, `randomInt`, `degToRad`, `radToDeg`, `distanceVec3`, `lerpVec3`. timer.ts: `CooldownTimer` class with `start(duration)`, `update(dt)`, `isReady()`, `reset()`. constants.ts: `FIXED_TIMESTEP`, `PLAYER_WALK_SPEED`, etc. |
| **Acceptance Criteria** | All math functions produce correct results. CooldownTimer works. Constants are exported and typed. |

---

### T-045: Game Config

| Field | Value |
|-------|-------|
| **Work Type** | `infrastructure` |
| **Priority** | P0 |
| **Depends On** | None |
| **Target Files** | `src/config/gameConfig.ts`, `src/config/renderConfig.ts` |
| **Description** | Create centralized configuration files. gameConfig.ts: all gameplay tuning values (player speeds, damage values, stamina costs, timing windows) as a typed const object. renderConfig.ts: resolution scale, shadow quality, outline width, post-processing toggles. All values referenced by systems instead of hardcoded numbers. |
| **Acceptance Criteria** | All tuning values are in config files. No magic numbers in gameplay code. Changing a config value changes behavior without code changes. |

---

## Open Bugs

### T-BUG-001: Enemy Wall Collision

| Field | Value |
|-------|-------|
| **Work Type** | `gameplay` |
| **Priority** | P1 |
| **Depends On** | T-014, T-020, T-013 |
| **Target Files** | `src/enemies/BaseEnemy.ts`, `src/world/EncounterManager.ts`, `src/app/Game.ts` |
| **Description** | Enemies walk through arena walls (especially Cube Sentinels retreating). Add sphere collider to BaseEnemy and resolve against wall AABBs after each movement update. EncounterManager needs access to current room's wall colliders. |
| **Acceptance Criteria** | Enemies cannot walk through walls. Retreat stops at wall boundaries. Enemy movement slides along walls. |

---

## Work Type Reference

| Work Type | Scope | Stay within |
|-----------|-------|-------------|
| `infrastructure` | Bootstrap, config, event bus, collision, loaders, pools | `src/app/`, `src/engine/`, `src/config/`, `src/utils/` |
| `gameplay` | Player mechanics, combat, AI, enemy behavior, interactions | `src/player/`, `src/combat/`, `src/enemies/`, `src/ai/`, `src/camera/`, `src/interactions/` |
| `rendering` | Shaders, materials, post-processing, mesh creation | `src/rendering/`, `src/shaders/`, `src/player/PlayerModel.ts` |
| `data` | JSON schemas, registries, factory patterns | `data/`, `src/enemies/EnemyFactory.ts`, `src/enemies/EnemyRegistry.ts` |
| `world` | Rooms, zones, encounters, doors, hazards | `src/world/`, `src/levels/` |
| `UI` | HUD, menus, overlays | `src/ui/` |
| `tooling` | Debug tools, dev utilities | `src/utils/debug.ts` |
| `polish` | Particles, camera shake, damage numbers, VFX | `src/rendering/ParticleSystem.ts`, `src/camera/CameraShake.ts`, `src/ui/DamageNumbers.ts` |
| `meta` | Save, progression, run state | `src/progression/`, `src/save/` |

**Boundary rules**: gameplay agents don't touch rendering pipeline. Rendering agents don't touch combat logic. Polish agents don't change balance values. Data agents don't modify engine internals.

---

## Task Completion Protocol
- Prepend `[DONE]` to completed task titles
- Add `[BLOCKED: reason]` if stuck
- New bugs: `T-BUG-{number}`
- Branch per task: `feat/T-{ID}-{short-name}`
