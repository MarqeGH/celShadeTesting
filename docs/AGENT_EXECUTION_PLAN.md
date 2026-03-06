# Agent Execution Plan

> This document defines how multiple autonomous implementation agents should work through the Celtest project safely and efficiently.

---

## Recommended Implementation Order

### Phase 1: Foundation (Must complete before anything else)
**Goal**: Running app, visible scene, character moves.

| Order | Tasks | Rationale |
|-------|-------|-----------|
| 1.1 | T-044 (Math utils), T-045 (Config), T-004 (EventBus), T-005 (Input) | Zero dependencies. Pure utilities. |
| 1.2 | T-001 (Bootstrap) | Project scaffold. |
| 1.3 | T-024 (AssetLoader) | Needed by many systems. |
| 1.4 | T-002 (Basic scene), T-043 (Object pool) | Three.js scene. Object pool is standalone. |
| 1.5 | T-003 (Game loop) | Requires scene. |
| 1.6 | T-006 (Player model), T-014 (Collision), T-013 (Test arena), T-011 (Cel-shading) | All depend on scene, independent of each other. |
| 1.7 | T-007 (Camera) | Requires game loop + input. |
| 1.8 | T-008 (Player movement) | Requires input, model, camera. |
| 1.9 | T-015 (Player-wall collision) | Requires movement + arena + collision. |

**Phase 1 Checkpoint**: Player visible in cel-shaded arena, moves with WASD, camera follows, walls are solid.

---

### Phase 2: Combat Core (Must complete before enemy content)
**Goal**: Player can attack, take damage, and interact with combat systems.

| Order | Tasks | Rationale |
|-------|-------|-----------|
| 2.1 | T-009 (Player FSM) | State machine is foundation for combat. |
| 2.2 | T-010 (Stamina), T-018 (Hitbox/Hurtbox) | Independent systems. |
| 2.3 | T-017 (Light attack) | Requires FSM, stamina, hitbox. |
| 2.4 | T-019 (Damage calculator) | Requires hitbox system. |
| 2.5 | T-031 (Stagger) | Requires damage system. |
| 2.6 | T-016 (Dodge) | Requires FSM, stamina. |
| 2.7 | T-026 (Debug overlay) | Critical for combat testing. |

**Phase 2 Checkpoint**: Player can attack, dodge, has stamina management. Hitboxes visible in debug. Damage flows through the system.

---

### Phase 3: Enemies (Must complete before world/encounter systems)
**Goal**: At least one functional enemy to fight.

| Order | Tasks | Rationale |
|-------|-------|-----------|
| 3.1 | T-020 (BaseEnemy) | Enemy foundation. |
| 3.2 | T-021 (Factory + Registry) | Spawning infrastructure. |
| 3.3 | T-022 (Triangle Shard) | First enemy implementation. |
| 3.4 | T-025 (HUD) | Needed to see health/stamina in combat testing. |
| 3.5 | T-033 (Lock-on) | Needed for meaningful enemy combat. |
| 3.6 | T-035 (Pickups) | Reward loop for killing enemies. |

**Phase 3 Checkpoint**: Player can fight Triangle Shards. Lock on, dodge attacks, deal damage. Enemies die, drop shards. HUD shows health/stamina.

---

### Phase 4: World Assembly
**Goal**: Rooms load from data, encounters spawn, doors connect rooms.

| Order | Tasks | Rationale |
|-------|-------|-----------|
| 4.1 | T-027 (Room assembler) | Room construction from data. |
| 4.2 | T-028 (Encounter manager) | Enemy spawning in rooms. |
| 4.3 | T-029 (Door system) | Room transitions. |
| 4.4 | T-036 (Run state) | Track run progress. |
| 4.5 | T-030 (Zone generator) | Full zone assembly. |

**Phase 4 Checkpoint**: A full zone of 5+ rooms plays end-to-end. Encounters spawn and clear. Doors unlock and transition.

---

### Phase 5: Polish & Content Expansion
**Goal**: Second enemy, full combat kit, UI, persistence.

| Order | Tasks | Rationale |
|-------|-------|-----------|
| 5.x (parallel) | T-023 (Cube Sentinel), T-039 (Parry), T-040 (Heavy attack), T-041 (Healing) | Independent content + features. |
| 5.x (parallel) | T-032 (Damage numbers), T-034 (Camera shake), T-038 (Particles) | Visual polish. |
| 5.x | T-037 (Death screen), T-042 (Save system) | Meta-loop. |
| 5.x | T-012 (Outline post-process) | Visual polish. |

**Phase 5 Checkpoint**: Two enemy types, full player combat kit, save/load works, death/retry loop functional.

---

## Parallelization Rules

### Can Be Parallelized (No Shared Files)
| Parallel Group | Tasks |
|----------------|-------|
| **Utilities** | T-044, T-045, T-004, T-005 (all independent, no file overlap) |
| **Scene-level** | T-006, T-014, T-013, T-011 (different subsystems, different files) |
| **Combat prep** | T-010, T-018 (PlayerStats vs HitboxManager — no overlap) |
| **Post-combat** | T-016, T-017 (dodge vs attack — different state implementations, but BOTH touch PlayerStateMachine.ts — see conflict rules below) |
| **Content expansion** | T-023, T-039, T-040, T-041 (different files entirely) |
| **Polish** | T-032, T-034, T-038, T-012 (different rendering/UI subsystems) |

### CANNOT Be Parallelized (Shared Files / Sequential Dependencies)
| Conflict | Reason |
|----------|--------|
| T-016 and T-017 | Both modify `PlayerStateMachine.ts` — implement sequentially or coordinate carefully |
| T-009 before T-016 / T-017 | FSM must exist before states are added |
| T-020 before T-022 / T-023 | Base class before implementations |
| T-027 before T-028 | Room module before encounter spawning |
| T-008 before T-015 | Movement before collision response |

---

## Pre-Combat-Testing Requirements

Before any meaningful combat testing can happen, these must be complete:

- [ ] T-003 (Game loop running)
- [ ] T-008 (Player moves)
- [ ] T-009 (Player FSM with idle/run/attack/dodge states)
- [ ] T-010 (Stamina drains and regens)
- [ ] T-014 (Collision detection works)
- [ ] T-017 (Light attack with hitbox)
- [ ] T-018 (Hitbox/hurtbox overlap detection)
- [ ] T-019 (Damage flows from hit to HP reduction)
- [ ] T-020 (At least one enemy takes damage and dies)
- [ ] T-026 (Debug overlay for hitbox visualization)

---

## Pre-Content-Expansion Requirements

Before adding new enemies (beyond Triangle Shard):

- [ ] T-020 (BaseEnemy is stable and tested)
- [ ] T-021 (Factory creates enemies from data)
- [ ] T-022 (Triangle Shard works end-to-end — proves the pipeline)
- [ ] All combat systems stable (T-017 through T-019, T-031)
- [ ] Data schema for enemies is finalized (no breaking changes expected)

---

## File Ownership & Conflict Avoidance

### Rules
1. **One agent per file at a time**. No two agents should modify the same file concurrently.
2. **Claim files before starting**. Agent should document which files it will modify.
3. **Core files need extra care**:
   - `src/app/Game.ts` — many systems register here. Use a registration pattern (array of systems) rather than hardcoded references, so new systems can be added without modifying existing lines.
   - `src/player/PlayerStateMachine.ts` — states are added over time. Use a state registry pattern so new states can be added without modifying the state machine core.
   - `src/app/EventBus.ts` — events are added over time. Use a string union type that can be extended.
4. **Interface files are append-only**. Adding new events, new enemy types, or new state types should be additive, not modifying existing entries.
5. **Data files are independent**. Each enemy JSON, room JSON, etc. is its own file — no conflicts.

### High-Conflict Files (Coordinate Carefully)
| File | Modified By Tasks |
|------|-------------------|
| `src/app/Game.ts` | T-002, T-003, and any system that registers with Game |
| `src/player/PlayerStateMachine.ts` | T-009, T-016, T-017, T-039, T-040, T-041 |
| `src/player/PlayerController.ts` | T-008, T-015 |
| `src/combat/CombatSystem.ts` | T-019, T-039 |
| `src/main.ts` | T-001, T-002 |

### Low-Conflict Files (Safe to Work on in Parallel)
- All files in `data/` (independent JSON files)
- All files in `src/enemies/` (except BaseEnemy.ts)
- All files in `src/ui/` (each UI component is independent)
- All files in `src/shaders/` (independent shader sources)
- All test files in `tests/`

---

## Branch Strategy

### Recommended: Feature Branch per Task

```
main
├── feat/T-001-bootstrap
├── feat/T-002-basic-scene
├── feat/T-003-game-loop
├── feat/T-004-event-bus
├── ...
```

### Rules
1. Each task gets its own branch: `feat/T-{ID}-{short-name}`
2. Branch from `main` (or from the latest merged state)
3. Task branches should be short-lived (merge within 1 session)
4. Merge to `main` after task passes acceptance criteria
5. If two tasks conflict, the one that started first merges first; the second rebases
6. **Never force-push to main**

### Merge Order
Merge in dependency order. If T-008 depends on T-005, T-006, T-007 — those must be merged before T-008 can be verified.

---

## Review Checkpoints

| Checkpoint | After Phase | What to Verify |
|------------|-------------|----------------|
| **CP1: Scene** | Phase 1 | Player moves in arena. Camera works. Cel-shading visible. 60fps. No console errors. |
| **CP2: Combat** | Phase 2 | Player attacks, dodges. Hitboxes visible in debug. Stamina system works. Damage formula correct. |
| **CP3: Enemy** | Phase 3 | Triangle Shard full behavior loop. Lock-on works. HUD displays. Enemy dies and drops shards. |
| **CP4: World** | Phase 4 | Full zone plays: rooms load, encounters spawn, doors connect, run progresses. |
| **CP5: Loop** | Phase 5 | Death → death screen → restart. Save/load works. Two enemy types. Full combat kit. |

At each checkpoint, run through the verification manually and document any issues before proceeding.

---

## Agent Communication Protocol

Since agents are autonomous and don't communicate directly:

1. **Task status**: Update task status in `tasks/TASKS.md` (prepend `[DONE]` to completed task titles)
2. **Blockers**: If a task is blocked, add a `[BLOCKED: reason]` note to the task
3. **Deviations**: If implementation deviates from spec, add a note to the task explaining why
4. **Bugs found**: Create new tasks for discovered bugs with prefix `T-BUG-{number}`
5. **File manifest**: Each completed task should list actual files created/modified in its status update
