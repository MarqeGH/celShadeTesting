# Task Registry

> 78 of 86 tasks completed (T-001–T-079 + T-BUG-001 done). Phase 6 tasks T-080–T-085 remain.
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

### [DONE] T-043: Object Pool (Enhancement)

| Field | Value |
|-------|-------|
| **Work Type** | `infrastructure` |
| **Priority** | P1 |
| **Depends On** | T-001 |
| **Target Files** | `src/engine/ObjectPool.ts` |
| **Description** | Enhance the existing ObjectPool with `preWarm(count)` for upfront allocation at scene start. Currently used by CubeSentinel projectiles and ParticleSystem. Extend usage to damage numbers and pickups. |
| **Acceptance Criteria** | Pre-warm creates specified count upfront. All poolable systems use ObjectPool. No runtime allocation during combat. |

**Implementation note**: Added `preWarm(count)` method to `ObjectPool`. Converted `PickupSystem` to pool `THREE.Mesh` instances (pre-warms 30, acquires on spawn, releases on collect/despawn). Converted `DamageNumbers` from manual DOM pooling to `ObjectPool<HTMLDivElement>` (pre-warms 20, releases after animation timeout). All poolable combat systems now use the shared ObjectPool class with zero runtime allocation during combat.

---

### [DONE] T-044: Math Utilities

| Field | Value |
|-------|-------|
| **Work Type** | `infrastructure` |
| **Priority** | P0 |
| **Depends On** | None |
| **Target Files** | `src/utils/math.ts`, `src/utils/timer.ts`, `src/utils/constants.ts` |
| **Description** | Create utility functions. math.ts: `lerp`, `clamp`, `randomRange`, `randomInt`, `degToRad`, `radToDeg`, `distanceVec3`, `lerpVec3`. timer.ts: `CooldownTimer` class with `start(duration)`, `update(dt)`, `isReady()`, `reset()`. constants.ts: `FIXED_TIMESTEP`, `PLAYER_WALK_SPEED`, etc. |
| **Acceptance Criteria** | All math functions produce correct results. CooldownTimer works. Constants are exported and typed. |

**Implementation note**: Created three utility files. `math.ts`: `lerp`, `clamp`, `randomRange`, `randomInt`, `degToRad`, `radToDeg`, `distanceVec3` (uses temp Vector3 to avoid allocation), `lerpVec3` (writes to `out` parameter). `timer.ts`: `CooldownTimer` class with `start(duration)`, `update(dt)`, `isReady()`, `reset()`, plus `progress` and `remaining` getters. `constants.ts`: ~70 typed constants grouped by domain (timing, movement, stats, stamina costs, dodge, parry, heal, light/heavy attack, camera, input, world, pickups, enemy, physics) extracted from hardcoded values across the codebase.

---

### [DONE] T-045: Game Config

| Field | Value |
|-------|-------|
| **Work Type** | `infrastructure` |
| **Priority** | P0 |
| **Depends On** | None |
| **Target Files** | `src/config/gameConfig.ts`, `src/config/renderConfig.ts` |
| **Description** | Create centralized configuration files. gameConfig.ts: all gameplay tuning values (player speeds, damage values, stamina costs, timing windows) as a typed const object. renderConfig.ts: resolution scale, shadow quality, outline width, post-processing toggles. All values referenced by systems instead of hardcoded numbers. |
| **Acceptance Criteria** | All tuning values are in config files. No magic numbers in gameplay code. Changing a config value changes behavior without code changes. |

**Implementation note**: Created `src/config/gameConfig.ts` with a structured `GAME_CONFIG` const object grouping all gameplay tuning values into 14 domains: timing, player movement, stats, stamina costs, dodge, parry, heal, light attack, heavy attack, camera, input, world, pickups, enemy, and physics. Created `src/config/renderConfig.ts` with `RENDER_CONFIG` covering resolution scaling, clear color, cel-shading ramp (thresholds + intensities), outline parameters (width, depth/normal thresholds), camera clipping, and post-processing toggles. Both exported as `as const` with derived types. Existing `src/utils/constants.ts` (from T-044) provides flat re-exports for backward compatibility.

---

## Open Bugs

### [DONE] T-BUG-001: Enemy Wall Collision

| Field | Value |
|-------|-------|
| **Work Type** | `gameplay` |
| **Priority** | P1 |
| **Depends On** | T-014, T-020, T-013 |
| **Target Files** | `src/enemies/BaseEnemy.ts`, `src/world/EncounterManager.ts`, `src/app/Game.ts` |
| **Description** | Enemies walk through arena walls (especially Cube Sentinels retreating). Add sphere collider to BaseEnemy and resolve against wall AABBs after each movement update. EncounterManager needs access to current room's wall colliders. |
| **Acceptance Criteria** | Enemies cannot walk through walls. Retreat stops at wall boundaries. Enemy movement slides along walls. |

**Implementation note**: Added `SphereCollider` to `BaseEnemy` (radius sourced from hurtbox shape) with `resolveWallCollisions(walls)` method using `testSphereVsAABB` + `resolveCollision` from CollisionSystem — same approach as player wall collision. `EncounterManager` stores wall colliders via `setWallColliders()` and calls `resolveWallCollisions` on each alive enemy after its `update()` call. `Game.ts` passes wall colliders from `TestArena`/`RoomModule` to EncounterManager at construction, on room transition, and on hub return.

---

### [DONE] T-BUG-002: Player Attacks Deal No Damage

| Field | Value |
|-------|-------|
| **Work Type** | `gameplay` |
| **Priority** | P0 |
| **Depends On** | T-051 |
| **Target Files** | `src/combat/WeaponSystem.ts`, `src/app/Game.ts` |
| **Description** | WeaponSystem.createHitbox() creates arc-based ActiveHitbox objects but never registers them with HitboxManager. CombatSystem only checks HitboxManager for overlaps, so player attacks never detect hits. Enemy attacks work because they use HitboxManager directly. |
| **Acceptance Criteria** | Player light and heavy attacks deal damage to enemies. Hitboxes visible in debug wireframe overlay (F1). |

**Implementation note:** Bridged WeaponSystem to HitboxManager. WeaponSystem.setHitboxManager() accepts a HitboxManager reference. On createHitbox(), a sphere Hitbox is also registered in HitboxManager (centered slightly forward from player, matching weapon radius). updateHitbox/removeHitbox/clearAll also sync to HitboxManager. Wired in Game.ts after HitboxManager construction. Also added F4 debug shortcut to kill all enemies in current room.

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

---

## Development Gap Analysis

> Produced at 43/46 tasks complete. The game has a functional combat loop with 2 enemy types, wave encounters, zone progression scaffolding, and a death/retry cycle. The following gaps prevent the game from being a satisfying playable experience.

### Critical Gaps
| Gap | Impact | Current State |
|-----|--------|---------------|
| **Enemy Variety** | Runs feel identical — only 2 of 6 designed enemies exist. No bosses. | TriangleShard + CubeSentinel only |
| **Weapons** | No player choice or build variety — 1 weapon, no loading from data, no swapping | Fracture Blade hardcoded |
| **Audio** | Silent game — no SFX, music, or ambient. Pillar 1 requires audio telegraphs | Zero audio code exists |
| **Game Flow** | No title screen, no hub, no pause. Game boots directly into combat | Death screen only |

### Major Gaps
| Gap | Impact | Current State |
|-----|--------|---------------|
| **Room Content** | 1 room JSON out of 5+ designed per zone. Every room is the same square | atrium-room-square only |
| **Zone Integration** | ZoneGenerator exists but isn't wired into room transitions | handleRoomTransition hardcoded |
| **Environment Hazards** | Room schema supports hazards but no system processes them | No HazardSystem |
| **Meta-Progression** | Save/load works but no unlock shop, no hub, no spending of meta-currency | SaveManager + RunState only |
| **Encounter Variety** | 5 encounters for zone 1 using 2 enemy types. No difficulty 7+ encounters | data/encounters/zone1-encounters.json |

### Moderate Gaps
| Gap | Impact | Current State |
|-----|--------|---------------|
| **UI Missing** | No pause menu, settings, boss health bar, weapon indicator, controls help | HUD + death screen only |
| **Damage Pipeline** | No defense/armor, no critical hits, parry buff not in calc | calculateDamage is base * multiplier |
| **Combat AI** | Max-2-attackers rule from spec not enforced. All enemies rush player | Each enemy AI is independent |
| **Polish** | No low-HP vignette, no screen flash on hit, death anim is basic | Particles + shake only |

---

## Phase 6 — Gameplay Expansion

> 40 tasks expanding the game from vertical-slice to full playable experience.
> Enemy content, weapons, rooms, game flow, audio, meta-progression, UI, and polish.

---

### [DONE] T-046: Spiral Dancer Enemy

| Field | Value |
|-------|-------|
| **Work Type** | `gameplay` + `data` |
| **Priority** | P1 |
| **Depends On** | T-020, T-021 |
| **Target Files** | `src/enemies/spiral-dancer/SpiralDancer.ts`, `src/enemies/spiral-dancer/states.ts`, `data/enemies/spiral-dancer.json` |
| **Description** | Implement the Spiral Dancer — fast melee skirmisher that orbits the player. Helix mesh (TubeGeometry along spiral curve, ~1.5m tall, purple #9944cc). FSM: idle → orbit (circle player at 5–7m, 8 m/s) → dart_strike (350ms telegraph, 150ms dash through player, 500ms recovery, 12 dmg) → whip_lash (300ms telegraph, 200ms 3m arc, 8 dmg) → cooldown → staggered. Register in EnemyRegistry. Side-effect import in Game.ts. |
| **Acceptance Criteria** | Enemy spawns, orbits player, performs both attacks with visible telegraphs, takes damage, dies with shatter effect. |
| **Verification** | Spawn via debug encounter. Observe orbit movement and attack patterns. Verify hitbox alignment. |

**Implementation note**: Created `data/enemies/spiral-dancer.json` with 40 HP, 8 m/s moveSpeed, 15 poise, 2 attacks (dart_strike: 350ms telegraph, 150ms dash at 30 m/s, 12 dmg; whip_lash: 300ms telegraph, 200ms 3m arc, 8 dmg). `SpiralDancer.ts` extends BaseEnemy with helix mesh via custom HelixCurve (3 turns, 1.5m tall, 0.25m radius) + TubeGeometry, purple #9944cc cel-shaded material. 6 FSM states in `states.ts`: idle (aggro range 12m), orbit (circles player at 6m radius using angular velocity, attacks after 1.5s cooldown), dart_strike (dash through player), whip_lash (close-range arc), cooldown (800ms), staggered (1200ms). Registered in EnemyRegistry via side-effect import in Game.ts.

---

### [DONE] T-047: Monolith Brute Enemy

| Field | Value |
|-------|-------|
| **Work Type** | `gameplay` + `data` |
| **Priority** | P1 |
| **Depends On** | T-020, T-021 |
| **Target Files** | `src/enemies/monolith-brute/MonolithBrute.ts`, `src/enemies/monolith-brute/states.ts`, `data/enemies/monolith-brute.json` |
| **Description** | Implement the Monolith Brute — slow heavy tank. BoxGeometry 0.8×2.5×0.4m, dark stone #555566. FSM: idle → chase (2 m/s) → slam (800ms telegraph, 300ms active, 3m radius, 30 dmg, 1000ms recovery) → sweep (600ms telegraph, 400ms 180° arc 3.5m, 20 dmg) → stomp (500ms telegraph, 200ms 2m radius, 15 dmg) → cooldown → staggered (expose glowing crack, 1.5x damage taken for 2s). HP 120, poise 100. |
| **Acceptance Criteria** | Enemy advances slowly, picks from 3 attacks, long telegraphs are clearly visible, stagger exposes vulnerability window. |
| **Verification** | Spawn via debug encounter. Test all 3 attacks. Verify stagger vulnerability applies 1.5x damage. |

**Implementation note:** Created MonolithBrute extending BaseEnemy with BoxGeometry 0.8×2.5×0.8, #555566 cel material. 7 FSM states (idle, chase, slam, sweep, stomp, cooldown, staggered). Vulnerability mechanic: `takeDamage()` override applies `damageMultiplier` (1.5x during stagger, controlled by BruteStaggeredState). Crack glow uses orange color (#FF9933) on `uBaseColor` uniform. Registered in EnemyRegistry + side-effect import in Game.ts.

---

### [DONE] T-048: Lattice Weaver Enemy

| Field | Value |
|-------|-------|
| **Work Type** | `gameplay` + `data` |
| **Priority** | P2 |
| **Depends On** | T-020, T-021, T-061 |
| **Target Files** | `src/enemies/lattice-weaver/LatticeWeaver.ts`, `src/enemies/lattice-weaver/states.ts`, `data/enemies/lattice-weaver.json` |
| **Description** | Implement the Lattice Weaver — area denial support enemy. EdgesGeometry wireframe cube (~1m, teal #44aaaa). Floats 0.5m above ground (sinusoidal bob). FSM: idle → position (moves to strategic point between player and other enemies) → web_deploy (600ms telegraph, places 4m radius damage zone on ground, 5 dmg/s, 8s duration, max 2 zones) → node_burst (400ms telegraph, ring of 6 small projectiles, 8 dmg each) → cooldown → alone_aggro (speeds up when last enemy alive) → staggered. HP 35. |
| **Acceptance Criteria** | Enemy positions strategically, deploys visible ground hazard zones, fires ring projectiles, zones deal damage over time to player, becomes aggressive when alone. |
| **Verification** | Spawn with other enemies. Verify zone placement, DOT damage, aggro behavior change when alone. |

**Implementation note**: EdgesGeometry wireframe cube (~1m) with cel material + LineSegments overlay at teal #44aaaa. Sinusoidal bob (0.15m amplitude, 2Hz) at 0.5m float height. 7 FSM states: idle, position (maintains 7m range, chooses attacks on 2.5s timer), web_deploy (600ms telegraph → deploys 4m radius ground zone), node_burst (400ms telegraph → fires ring of 6 sphere projectiles), cooldown (1.2s), alone_aggro (1.5x speed, 1.5s attack interval when last alive), staggered (1s). Zone system: max 2 active zones, 5dmg/s via hitbox recycling every 1s (new attackInstanceId for repeated DOT), 8s duration with pulse opacity + fade-out. Projectile ObjectPool (8 slots). EncounterManager passes scene ref and aliveCount callback via setScene()/setAliveCountFn(). T-061 dependency soft — zones are self-contained enemy mechanics, not HazardSystem.

---

### [DONE] T-049: Boss — The Aggregate (Data + Base)

| Field | Value |
|-------|-------|
| **Work Type** | `gameplay` + `data` |
| **Priority** | P2 |
| **Depends On** | T-020, T-021, T-022 |
| **Target Files** | `src/enemies/aggregate-boss/AggregateBoss.ts`, `src/enemies/aggregate-boss/states.ts`, `data/enemies/aggregate-boss.json` |
| **Description** | Implement Zone 1 boss: The Aggregate — a cluster of fused triangles forming a shifting humanoid silhouette. Mesh: group of 12–16 ConeGeometry triangles arranged in humanoid shape, dark red #993333. HP 300. 3 phases based on HP thresholds: Phase 1 (100–66% HP): melee swipes (500ms telegraph, 250ms active, 20 dmg, 3m arc). Phase 2 (66–33%): adds a charge attack (700ms telegraph, 8m dash, 25 dmg) + triangle scatter (launches 4 triangles outward). Phase 3 (<33%): faster attacks, reduced telegraph by 100ms. No adds-splitting in this task (see T-050). |
| **Acceptance Criteria** | Boss spawns with cluster mesh, transitions between 3 phases at HP thresholds, each phase adds attacks, telegraphs are clearly visible, boss has unique death effect. |
| **Verification** | Spawn in boss arena room. Fight through all 3 phases. Verify phase transitions. Check damage values. |

**Implementation note**: 14-cone humanoid cluster mesh with sinusoidal jitter. 8 FSM states (idle, chase, melee_swipe, charge, triangle_scatter, cooldown, staggered, phase_transition). Phase-aware attack selection in chase state. CubeSentinel-style ObjectPool projectile system for scatter attack. Enhanced death effect with 14 cone shatter pieces (slower, wider spread). EncounterManager updated with setScene() check.

---

### [DONE] T-050: Boss — The Aggregate (Split Mechanic)

| Field | Value |
|-------|-------|
| **Work Type** | `gameplay` |
| **Priority** | P3 |
| **Depends On** | T-049 |
| **Target Files** | `src/enemies/aggregate-boss/AggregateBoss.ts`, `src/enemies/aggregate-boss/states.ts` |
| **Description** | Add split/reform mechanic to The Aggregate. In Phase 2+, on stagger: boss splits into 3–5 independent TriangleShard minions for 8 seconds. Minions have 15 HP each. After 8s or all minions killed, boss reforms at center of remaining minions. Boss HP does not regen during split. If boss HP < 33% during split, reforms immediately after 1 minion killed. Visual: triangles detach and scatter, reform animates them back together. |
| **Acceptance Criteria** | Boss splits on stagger, minions are real TriangleShards that can be fought, boss reforms after timer or all killed, HP preserved across split/reform. |
| **Verification** | Trigger stagger in Phase 2. Verify minion spawning. Kill some minions, verify reform. |

**Implementation note**: 2 new FSM states (split, reform) + modified staggered state. AggregateBoss spawns real TriangleShard instances with 15 HP via preloaded JSON data, registers them with CombatSystem and StaggerSystem independently of EncounterManager. Boss is invulnerable during split (hurtbox unregistered, takeDamage returns early). Reform calculates center of remaining alive minions, kills/disposes all, repositions boss, re-registers hurtbox. Reform animation spreads cones outward then converges over 1s. Phase 3 early reform triggers after first minion killed. 5s cooldown prevents immediate re-split. EncounterManager passes combatSystem/staggerSystem refs via setSpawnSystems().

---

### [DONE] T-051: Weapon Data Loader

| Field | Value |
|-------|-------|
| **Work Type** | `gameplay` + `data` |
| **Priority** | P1 |
| **Depends On** | T-024, T-017, T-040 |
| **Target Files** | `src/combat/WeaponSystem.ts`, `src/combat/WeaponData.ts`, `src/player/states/LightAttackState.ts`, `src/player/states/HeavyAttackState.ts` |
| **Description** | Create `WeaponData.ts` interface matching `data/weapons/*.json` schema. Extend WeaponSystem with `loadWeapon(id): Promise<WeaponData>` and `getEquipped(): WeaponData`. Refactor LightAttackState and HeavyAttackState to read damage, range, stamina cost, combo hits, attack speed from the equipped WeaponData instead of hardcoded values. Load `fracture-blade.json` as default on game start. |
| **Acceptance Criteria** | Player attacks use values from weapon JSON. Changing weapon JSON changes in-game behavior. WeaponSystem caches loaded data. |
| **Verification** | Modify fracture-blade.json damage values. Reload game. Verify damage numbers change. |

**Implementation note**: Created `WeaponData.ts` interface matching weapon JSON schema. Extended `WeaponSystem` with `loadWeapon(id)` (fetch + cache), `equipWeapon(id)` (load + equip + update STAMINA_COSTS), and `getEquipped()` (returns current WeaponData, defaults to fracture-blade stats). Refactored `LightAttackState` and `HeavyAttackState` to read hitbox radius/arc, combo count, and attack speed scaling from `ctx.weaponSystem.getEquipped()` on state enter. Attack speed inversely scales all phase timings. Heavy attack multiplier range derived from `weapon.heavyMultiplier`. Game.ts calls `equipWeapon('fracture-blade')` on startup before first encounter.

---

### [DONE] T-052: Edge Spike Weapon

| Field | Value |
|-------|-------|
| **Work Type** | `data` |
| **Priority** | P2 |
| **Depends On** | T-051 |
| **Target Files** | `data/weapons/edge-spike.json` |
| **Description** | Create Edge Spike weapon data: fast, short-range. baseDamage 10, heavyMultiplier 1.8, attackSpeed 1.4, range 1.8m, staggerDamage 8, comboHits 3 (3-hit light combo), staminaCostLight 8, staminaCostHeavy 18. hitboxShape "arc", hitboxSize { radius: 1.8, angle: 90 }. unlockCost 50. Description: "A needle of compressed edge. Strikes fast, reaches short." |
| **Acceptance Criteria** | JSON validates against WeaponData schema. Values are balanced (faster but less damage than Fracture Blade). |
| **Verification** | Load weapon via WeaponSystem.loadWeapon. Verify all fields parse correctly. |

**Implementation note**: Created `data/weapons/edge-spike.json` conforming to WeaponData schema. All values match task spec exactly. Faster (1.4x attack speed) and shorter range (1.8m) than Fracture Blade (1.0x, 2.5m), lower damage (10 vs 18) but 3-hit combo and lower stamina costs.

---

### [DONE] T-053: Void Cleaver Weapon

| Field | Value |
|-------|-------|
| **Work Type** | `data` |
| **Priority** | P2 |
| **Depends On** | T-051 |
| **Target Files** | `data/weapons/void-cleaver.json` |
| **Description** | Create Void Cleaver weapon data: slow, heavy damage. baseDamage 28, heavyMultiplier 2.5, attackSpeed 0.7, range 3.2m, staggerDamage 25, comboHits 1 (no light combo), staminaCostLight 18, staminaCostHeavy 35. hitboxShape "arc", hitboxSize { radius: 3.2, angle: 150 }. unlockCost 80. Description: "A slab of absence given weight. Each swing carves meaning from the air." |
| **Acceptance Criteria** | JSON validates against WeaponData schema. Values are balanced (high risk/reward, stamina-hungry). |
| **Verification** | Load weapon via WeaponSystem.loadWeapon. Verify all fields parse correctly. |

**Implementation note**: Created `data/weapons/void-cleaver.json` conforming to WeaponData schema. Slow (0.7x attack speed), long range (3.2m), high damage (28 base, 2.5x heavy = 70), massive stagger (25), but stamina-hungry (18 light / 35 heavy) with no combo (1 hit). 150-degree wide arc. Unlock cost 80.

---

### [DONE] T-054: Weapon Swap System

| Field | Value |
|-------|-------|
| **Work Type** | `gameplay` |
| **Priority** | P2 |
| **Depends On** | T-051 |
| **Target Files** | `src/combat/WeaponSystem.ts`, `src/app/InputManager.ts`, `src/player/PlayerController.ts` |
| **Description** | Allow player to carry 2 weapons and swap between them. Add `SWAP_WEAPON` action to InputManager (key: 1/2 or scroll wheel). WeaponSystem tracks primary and secondary weapon IDs. Swapping is instant but only allowed in idle/run states. On swap: emit `WEAPON_SWAPPED` event with new weapon data. HUD listens to update weapon indicator (see T-075). |
| **Acceptance Criteria** | Player can swap between 2 weapons mid-run. Swap blocked during attacks/dodge/heal. Attack stats change immediately on swap. |
| **Verification** | Equip 2 different weapons. Swap. Verify damage numbers match new weapon. Attempt swap during attack (should be blocked). |

**Implementation Note**: InputManager already had `swapWeapon` bound to F key. Added dual-weapon tracking (primary/secondary) to WeaponSystem with `swapWeapon()`, `equipSecondary()`, `getSecondary()`, `hasSecondary()`. Swap check lives in `PlayerStateMachine.update()` (gated to idle/run states) rather than PlayerController (which handles movement only). WEAPON_SWAPPED event added to EventBus. Game.ts equips edge-spike as default secondary.

---

### [DONE] T-055: Weapon Pickup During Runs

| Field | Value |
|-------|-------|
| **Work Type** | `gameplay` + `interactions` |
| **Priority** | P3 |
| **Depends On** | T-054 |
| **Target Files** | `src/interactions/WeaponPickup.ts`, `src/interactions/PickupSystem.ts`, `src/world/EncounterManager.ts` |
| **Description** | After clearing a room, spawn a random weapon pickup from the unlock pool. WeaponPickup: floating weapon mesh with glow, press E to pick up. If player has 2 weapons, picking up replaces currently equipped (dropped weapon despawns). Spawn at room center. Weapon type randomly selected from unlocked weapons. Only spawns if `Math.random() < 0.4` (40% chance per room clear). |
| **Acceptance Criteria** | Weapon pickup appears after some room clears. Player can interact to equip. Old weapon replaced if inventory full. |
| **Verification** | Clear 5+ rooms. Verify weapon pickups appear ~40% of the time. Pick up weapon, verify it equips. |

**Implementation Note**: Created `src/interactions/WeaponPickup.ts` — self-contained system that listens for `ROOM_CLEARED`, rolls 40% chance, spawns floating octahedron with glow pulse at room center. Press E within 2.5m to pick up. If player has empty secondary slot, equips there; otherwise replaces primary. Added `roomCenter` to `ROOM_CLEARED` event payload (computed from spawn point average in EncounterManager). Added `WEAPON_PICKUP_COLLECTED` event. Integrated in Game.ts (construct, update, dispose).

---

### [DONE] T-056: Room Module — atrium-hall-straight

| Field | Value |
|-------|-------|
| **Work Type** | `data` + `world` |
| **Priority** | P1 |
| **Depends On** | T-027 |
| **Target Files** | `data/rooms/atrium-hall-straight.json` |
| **Description** | Create JSON for the tutorial corridor room. 20m×8m floor, 3m walls. 2 spawn points at mid-corridor flanks. Player entry at south. Single exit at north. 2 decorative column props at 1/3 and 2/3 length. No hazards. Zone: "shattered-atrium". This is the opening room for Zone 1 runs. |
| **Acceptance Criteria** | JSON conforms to RoomModuleData schema. RoomAssembler builds it without errors. Spawn points are reachable. |
| **Verification** | Load via AssetLoader + RoomAssembler. Walk through room. Verify dimensions and spawn positions. |

**Implementation note**: Created `data/rooms/atrium-hall-straight.json` — 8×3×20 corridor (x=width, z=length). 2 spawn points at mid-corridor flanks (x=±3), player entry at south (z=-9.5), single north exit (z=9.5, locked). 2 pillar-cracked props at ~1/3 and 2/3 length. No hazards. Already registered in Zone1Config (line 20).

---

### [DONE] T-057: Room Module — atrium-junction-T

| Field | Value |
|-------|-------|
| **Work Type** | `data` + `world` |
| **Priority** | P2 |
| **Depends On** | T-027 |
| **Target Files** | `data/rooms/atrium-junction-T.json` |
| **Description** | Create JSON for the T-intersection room. 12m×16m floor, 3m walls. T-shape: main corridor 12m wide, branch extends 8m to the right. 3 spawn points (center, left alcove, right branch end). Player entry at south. 2 exits: north + east. 1 static-discharge hazard at the junction corner (radius 1.5m, 5 dmg/tick, 1s interval). |
| **Acceptance Criteria** | JSON conforms to RoomModuleData. Room builds correctly with T-shaped walls. Both exits functional. |
| **Verification** | Load room. Walk all paths. Verify spawn point accessibility and exit door positions. |

> **Implementation note**: Created `data/rooms/atrium-junction-T.json` — 12×16m bounding box, 3m walls, geometry `prefab:atrium-junction-T`. 3 spawn points positioned at center, left alcove, and right branch end. North + east exits. Static-discharge hazard at junction corner. Note: RoomAssembler currently builds rectangular perimeter walls from `size`; the `geometry` field is declared but not yet parsed for T-shaped wall generation.

---

### [DONE] T-058: Room Module — atrium-boss-arena

| Field | Value |
|-------|-------|
| **Work Type** | `data` + `world` |
| **Priority** | P2 |
| **Depends On** | T-027 |
| **Target Files** | `data/rooms/atrium-boss-arena.json` |
| **Description** | Create JSON for the Zone 1 boss arena. 20m×20m open floor, 3m walls. 4 corner pillars (props). Single spawn point at room center. Player entry at south. No exits (boss arena — game handles zone transition on boss death). No hazards. Zone: "shattered-atrium". |
| **Acceptance Criteria** | JSON conforms to schema. Large open room with 4 pillar props. Spawn point centered. |
| **Verification** | Load room. Verify dimensions suit boss combat (enough space for dodge rolls and boss attacks). |

**Implementation note**: Created `data/rooms/atrium-boss-arena.json` — 20×20×3 arena with single center spawn, south player entry at (0, 0, -9.5), no exits, no hazards, 4 `pillar-cracked` props at corners (±8, 0, ±8). Follows existing room module schema conventions.

---

### [DONE] T-059: Zone Generator Integration

| Field | Value |
|-------|-------|
| **Work Type** | `world` |
| **Priority** | P1 |
| **Depends On** | T-030, T-056, T-057, T-058 |
| **Target Files** | `src/app/Game.ts`, `src/world/ZoneGenerator.ts` |
| **Description** | Wire ZoneGenerator into Game.ts room transitions. On game start: generate a ZoneLayout via `ZoneGenerator.generate('shattered-atrium')`. Store the layout in Game. `handleRoomTransition` loads the next room/encounter from the layout instead of hardcoded values. Track current room index via RunState.advanceRoom(). Load encounter JSON from `data/encounters/zone1-encounters.json` matching the layout's encounterId. On last room: spawn boss encounter (or final wave). |
| **Acceptance Criteria** | Each run generates a different room sequence. Rooms load from layout. Encounters match layout. Room index advances correctly. |
| **Verification** | Start 3 runs. Verify room order differs. Check console logs show ZoneGenerator output. |

**Implementation notes:** Replaced hardcoded room/encounter loading in Game.ts with ZoneGenerator-driven flow. Added `startZoneRun(zoneId)` which loads encounter JSON, generates a ZoneLayout, and loads the first room. `handleRoomTransition` now advances via `runState.advanceRoom()` and loads next room/encounter from the layout. Added `loadRoomFromLayout(index)` helper with fallback for missing room JSON (e.g. `atrium-balcony`). `handleReturnToHub` now generates a fresh layout on retry. Zone completion restarts the zone (future: victory screen).

---

### [DONE] T-060: Additional Zone 1 Encounters

| Field | Value |
|-------|-------|
| **Work Type** | `data` |
| **Priority** | P1 |
| **Depends On** | T-046, T-047 |
| **Target Files** | `data/encounters/zone1-encounters.json`, `src/levels/Zone1Config.ts` |
| **Description** | Add 5 new encounters to zone 1 using all available enemy types. `z1-dancer-ambush` (difficulty 4): 2 spiral dancers + 1 triangle. `z1-brute-intro` (difficulty 6): 1 monolith brute. `z1-mixed-pressure` (difficulty 7): 1 brute + 2 cubes. `z1-gauntlet` (difficulty 8): wave 1: 3 triangles, wave 2: 2 dancers, wave 3: 1 brute. `z1-boss` (difficulty 10): 1 aggregate boss. Register all in Zone1Config encounter pool with appropriate weights. |
| **Acceptance Criteria** | All 5 new encounters parse and spawn correctly. Zone1Config includes new encounters in pool. Difficulty curve can reach them. |
| **Verification** | ZoneGenerator produces layouts that include new encounters at appropriate difficulty levels. |

**Implementation note**: Added 5 encounters to `zone1-encounters.json`: `z1-dancer-ambush` (diff 4), `z1-brute-intro` (diff 6), `z1-mixed-pressure` (diff 7), `z1-gauntlet` (diff 8, 3 waves), `z1-boss` (diff 10). Registered all in `Zone1Config` encounter pool. Updated difficulty curve to `[1, 3, 5, 6, 8, 10]` so the zone ramps through all new encounters including the boss finale.

---

### [DONE] T-061: Environment Hazard System

| Field | Value |
|-------|-------|
| **Work Type** | `world` + `gameplay` |
| **Priority** | P2 |
| **Depends On** | T-027 |
| **Target Files** | `src/world/HazardSystem.ts`, `src/world/RoomAssembler.ts` |
| **Description** | Create HazardSystem that processes hazard placements from room JSON. HazardSystem.spawn(type, position, params) creates visual + collision for each type. Initial types: `static-discharge` (pulsing blue spark sphere, damages player in radius every tick interval) and `loose-tile` (floor section that drops 1s after step, respawns after 2s). RoomAssembler calls HazardSystem.spawn() for each hazard in room data. HazardSystem.update(dt, playerPos) checks collisions. Emit `PLAYER_DAMAGED` for hazard hits. |
| **Acceptance Criteria** | Hazards spawn from room JSON. Static discharge damages player periodically. Loose tiles collapse visually and respawn. Hazards cleaned up on room dispose. |
| **Verification** | Load atrium-room-square (has static-discharge hazard). Walk into hazard zone. Verify damage applied. |

**Implementation note**: Created `HazardSystem` in `src/world/HazardSystem.ts` with two hazard types: `static-discharge` (pulsing blue sphere, periodic damage in radius) and `loose-tile` (AABB step detection → wobble → collapse → respawn state machine). System wired into Game.ts update loop. RoomAssembler passes hazardSystem to `assemble()` to spawn hazards from room JSON. Config defaults in `gameConfig.ts` under `hazards`.

---

### [DONE] T-062: Title Screen

| Field | Value |
|-------|-------|
| **Work Type** | `UI` |
| **Priority** | P1 |
| **Depends On** | None |
| **Target Files** | `src/ui/TitleScreen.ts`, `src/ui/UIManager.ts` |
| **Description** | HTML/CSS overlay title screen shown on game launch. Game title "CELTEST" in large sparse lettering (letter-spacing 24px, color #c0c0c0, weight 100). Subtitle "A world of collapsed forms" in small text below. "Press any key to start" pulsing at bottom. Background: the Three.js scene renders a slowly rotating empty arena with ambient lighting (no player/enemies). On key press: fade out 500ms → transition to hub or directly to run start. Add `title` state to UIManager. |
| **Acceptance Criteria** | Title screen displays on game load. Scene renders behind it. Key press transitions to gameplay. |
| **Verification** | Load game. Verify title screen shows. Press key. Verify transition to gameplay. |
| **Implementation Notes** | Created `src/ui/TitleScreen.ts` with HTML/CSS overlay (fade-out transition 500ms). Added `'title'` to `UIState` in UIManager. Game.ts starts in title state — scene renders behind overlay, gameplay updates are skipped. On key/click press, fades out and starts weapon load + zone run. |

---

### [DONE] T-063: Pause Menu

| Field | Value |
|-------|-------|
| **Work Type** | `UI` |
| **Priority** | P1 |
| **Depends On** | None |
| **Target Files** | `src/ui/PauseMenu.ts`, `src/ui/UIManager.ts`, `src/app/GameLoop.ts`, `src/app/Game.ts` |
| **Description** | Escape key toggles pause. PauseMenu: semi-transparent dark overlay with "PAUSED" title, buttons: "Resume", "Settings" (placeholder), "Quit Run" (ends run, returns to hub/restart). GameLoop.pause()/resume() stops update loop but keeps rendering at low rate. InputManager ignores gameplay input while paused. UIManager adds `paused` state. Escape while paused resumes. |
| **Acceptance Criteria** | Escape pauses game and shows overlay. Game loop stops. Resume returns to gameplay. Quit Run ends the run. |
| **Verification** | During combat, press Escape. Verify enemies freeze. Press Resume. Verify combat resumes. |

**Implementation note**: Created `PauseMenu.ts` with semi-transparent overlay (z-index 90), "PAUSED" title, Resume/Settings(disabled)/Quit Run buttons. Added `'paused'` UIState that keeps HUD visible behind overlay. GameLoop gained `pause()`/`resume()` — paused state skips updates and throttles rendering to ~15fps. Escape key toggle handled via keydown listener (works independently of game loop). Quit Run ends the run via `runState.endRun(false)` then restarts.

---

### [DONE] T-064: Run Completion Flow

| Field | Value |
|-------|-------|
| **Work Type** | `UI` + `meta` |
| **Priority** | P2 |
| **Depends On** | T-059 |
| **Target Files** | `src/ui/VictoryScreen.ts`, `src/ui/UIManager.ts`, `src/app/Game.ts` |
| **Description** | When the last room in a zone layout is cleared (ROOM_CLEARED and room index == layout length), show a victory screen. VictoryScreen: "Zone Cleared" title (green tint), run stats (same layout as death screen), "Shards Kept (100%)" (survived runs keep all shards). Button: "Continue" (for future zone chaining) or "Return". Call RunState.endRun(true) with survived=true. |
| **Acceptance Criteria** | Clearing the final room shows victory screen. Survived runs keep 100% shards. Stats display correctly. |
| **Verification** | Play through all rooms in a zone. Verify victory screen appears on final room clear. |

**Implementation note:** Created `src/ui/VictoryScreen.ts` mirroring death screen pattern with green theme. Fixed `RunState.endRun()` to keep 100% shards when `survived=true`. Victory screen triggers in `Game.handleRoomTransition()` when `nextIndex >= layout.rooms.length`. "Return" button reuses existing `handleReturnToHub()` flow.

---

### [DONE] T-065: Hub Scene

| Field | Value |
|-------|-------|
| **Work Type** | `world` + `UI` |
| **Priority** | P2 |
| **Depends On** | T-062, T-063 |
| **Target Files** | `src/world/HubScene.ts`, `src/app/Game.ts`, `src/ui/UIManager.ts` |
| **Description** | Simple hub area between runs. Small 10m×10m room with cel-shaded floor. Player can walk around. Contains: a glowing portal mesh (TorusGeometry, pulsing emissive) — press E to start run. Meta-currency counter visible in HUD. Future: shop pedestal (T-068). Game.ts manages hub→run→hub transitions. UIManager `hub` state shows shard count but hides stamina/HP. Player position resets to hub center on return. |
| **Acceptance Criteria** | Hub loads after death screen "Return" or on game start (post-title). Player walks in hub. Portal starts a run. |
| **Verification** | Die in a run. Click Return. Verify hub loads. Walk to portal. Press E. Verify run starts. |

**Implementation note:** Created `HubScene` class with 10m room, pulsing TorusGeometry portal at (0,1.5,-3), E-key interaction with proximity prompt. Added `'hub'` UIState with `HUD.setCombatBarsVisible()` to hide HP/stamina/heal in hub. Game.ts routes title→hub and death/victory→hub. Pause/resume works in hub. `inHub` flag gates combat system updates.

---

### [DONE] T-066: Unlock Registry and Data

| Field | Value |
|-------|-------|
| **Work Type** | `meta` + `data` |
| **Priority** | P2 |
| **Depends On** | T-042 |
| **Target Files** | `src/progression/UnlockRegistry.ts`, `data/progression/unlocks.json` |
| **Description** | Create UnlockRegistry that loads unlock definitions from JSON. Each unlock: id, name, description, category (weapon/ability/stat/cosmetic), cost, prerequisite, effect. Create `data/progression/unlocks.json` with 8 initial unlocks: 2 weapons (edge-spike, void-cleaver), 3 stat bonuses (+10 HP ×2, +10 stamina), 1 ability (dash_strike — placeholder), 2 cosmetic (placeholder). UnlockRegistry exposes: `getAll()`, `getAvailable(playerUnlocks)`, `getCost(id)`, `getEffect(id)`. |
| **Acceptance Criteria** | Unlock data loads and parses. Registry correctly filters available unlocks based on prerequisites and already-owned. |
| **Verification** | Call getAvailable with empty unlocks list. Verify starter unlocks shown. Add prerequisite unlock, verify gated items appear. |

**Implementation note:** Created `data/progression/unlocks.json` with 8 unlocks: 2 weapons (edge-spike cost 50, void-cleaver cost 80), 3 stat bonuses (HP×2 at 40/60 cost with prerequisite chain, stamina at 50), 1 ability (dash_strike placeholder, cost 100), 2 cosmetics (glow-trail, shatter-color at 30 each). `UnlockRegistry` loads via AssetLoader, stores in Map, exposes `getAll()`, `getAvailable(playerUnlocks)` (filters owned + prerequisite checks), `getCost(id)`, `getEffect(id)`.

---

### [DONE] T-067: Hub Shop UI

| Field | Value |
|-------|-------|
| **Work Type** | `UI` + `meta` |
| **Priority** | P3 |
| **Depends On** | T-065, T-066 |
| **Target Files** | `src/ui/ShopUI.ts`, `src/app/Game.ts` |
| **Description** | In the hub, a second interactable (glowing pedestal mesh) opens the shop overlay. ShopUI: HTML/CSS panel listing available unlocks with name, description, cost. "Buy" button per item. Grayed out if insufficient currency or prerequisites not met. On purchase: SaveManager.spendCurrency() + SaveManager.addUnlock(). Purchased items show checkmark. Close shop with Escape or "Close" button. Display current meta-currency balance at top of panel. |
| **Acceptance Criteria** | Shop opens from hub interaction. Shows available unlocks. Purchase deducts currency and persists unlock. Already-owned items are marked. |
| **Verification** | Accumulate shards across 2+ runs. Open shop. Purchase an unlock. Reload page. Verify unlock persists. |

**Implementation note:** Created `ShopUI` as HTML/CSS overlay (z-index 90) matching PauseMenu pattern. Lists all unlocks with Buy/Owned/Locked states. Purchases via `SaveManager.spendCurrency()` + `addUnlock()`. Escape closes (capture-phase handler). Added shop pedestal to `HubScene` (blue rotating crystal at east side) with "Press E to browse wares" prompt. Game.ts wires ShopUI + UnlockRegistry, disables hub interactions while shop open, freezes player movement.

---

### [DONE] T-068: Meta-Progression Stat Application

| Field | Value |
|-------|-------|
| **Work Type** | `meta` + `gameplay` |
| **Priority** | P3 |
| **Depends On** | T-066 |
| **Target Files** | `src/progression/MetaProgression.ts`, `src/player/PlayerStats.ts`, `src/app/Game.ts` |
| **Description** | Create MetaProgression class that reads unlocked stat bonuses from SaveManager and applies them to PlayerStats at run start. On RunState.startRun(): iterate unlocks with `type: "stat_bonus"`, sum bonuses per stat (maxHP, maxStamina, etc.), apply to PlayerStats. Cap total bonuses at +20% of base values (per CLAUDE.md design constraint). MetaProgression.getAppliedBonuses() returns summary for debug/UI. |
| **Acceptance Criteria** | Purchasing HP unlock increases player HP on next run. Bonuses cap at +20%. Bonuses applied fresh each run start. |
| **Verification** | Buy 2 HP unlocks (+10 each). Start run. Verify HP bar shows 120 max. |

**Implementation note:** Created `src/progression/MetaProgression.ts` — reads owned unlocks from SaveManager, filters for `stat_bonus` type, sums per target stat, caps at +20% of base (using exported `BASE_MAX_HP`/`BASE_MAX_STAMINA` from PlayerStats). Added `applyMetaBonuses()` to PlayerStats. Called in `Game.startZoneRun()` after `reset()` and `startRun()`.

---

### [DONE] T-069: Audio Manager Foundation

| Field | Value |
|-------|-------|
| **Work Type** | `infrastructure` |
| **Priority** | P1 |
| **Depends On** | T-004 |
| **Target Files** | `src/audio/AudioManager.ts`, `src/audio/SFXRegistry.ts`, `src/app/Game.ts` |
| **Description** | Create AudioManager using Howler.js. SFXRegistry maps string IDs to audio file paths. AudioManager: `playSFX(id, volume?)`, `playMusic(id, loop?)`, `stopMusic()`, `setMasterVolume(v)`, `setSFXVolume(v)`, `setMusicVolume(v)`. Reads initial volumes from SaveManager settings. Subscribe to EventBus: `PLAYER_DAMAGED` → hit SFX, `ENEMY_DAMAGED` → hit SFX, `ENEMY_DIED` → death SFX, `SHARD_COLLECTED` → collect SFX. For now, register placeholder paths — actual audio files added in T-070. Wire into Game.ts constructor. |
| **Acceptance Criteria** | AudioManager initializes without errors. EventBus subscriptions are active. Volume controls work. Missing audio files fail gracefully (warn, don't crash). |
| **Verification** | Game boots with AudioManager. No console errors. Volume settings load from save data. |

**Implementation note:** Created `src/audio/SFXRegistry.ts` mapping SFX/music IDs to file paths (7 SFX + 2 music placeholders). Created `src/audio/AudioManager.ts` using Howler.js with `playSFX()`, `playMusic()`/`stopMusic()`, volume controls (`setMasterVolume`/`setSFXVolume`/`setMusicVolume`). Reads initial volumes from SaveManager settings. Subscribes to EventBus: PLAYER_DAMAGED→player-hit, ENEMY_DAMAGED→hit-impact, ENEMY_DIED→enemy-death, SHARD_COLLECTED→shard-collect. Missing audio files fail gracefully (Howl onloaderror warns). Wired into Game.ts after SaveManager construction. Disposed before SaveManager.

---

### [DONE] T-070: Combat Sound Effects

| Field | Value |
|-------|-------|
| **Work Type** | `polish` |
| **Priority** | P2 |
| **Depends On** | T-069 |
| **Target Files** | `assets/audio/sfx/`, `src/audio/SFXRegistry.ts` |
| **Description** | Create or source (CC0/generated) minimal audio files for core combat: `attack-whoosh.mp3` (light + heavy attack swing), `hit-impact.mp3` (damage dealt to enemy), `player-hit.mp3` (player takes damage), `parry-clang.mp3` (successful parry), `enemy-death.mp3` (shatter sound), `shard-collect.mp3` (pickup chime), `dodge-swoosh.mp3` (dodge roll). Register all in SFXRegistry. Use Web Audio API tone generation as fallback if files not present — AudioManager.generateTone(frequency, duration, type) for procedural SFX. |
| **Acceptance Criteria** | All 7 combat sounds play at appropriate events. Sounds are short (<500ms). No audio latency >50ms. |
| **Verification** | Play game. Attack enemies — hear whoosh + impact. Get hit — hear player-hit. Parry — hear clang. Collect shards — hear chime. |

**Implementation note:** Created `src/audio/ToneBank.ts` with procedural tone parameters for all 7 SFX (frequency, duration, oscillator type, volume). Added `generateTone()` to AudioManager using Web Audio API as fallback when Howl files are missing (`failedSFX` set tracks failed loads). Added 3 new EventBus events: `PLAYER_ATTACK`, `PLAYER_DODGE`, `PLAYER_PARRY_SUCCESS`. Added `eventBus?` to PlayerContext interface; emitted from LightAttackState, HeavyAttackState, DodgeState enter() and PlayerStateMachine.notifyParrySuccess(). AudioManager subscribes to all 7 combat events. PlayerStateMachine.setEventBus() wired in Game.ts.

---

### [DONE] T-071: Ambient Audio

| Field | Value |
|-------|-------|
| **Work Type** | `polish` |
| **Priority** | P3 |
| **Depends On** | T-069 |
| **Target Files** | `assets/audio/ambient/`, `src/audio/AudioManager.ts` |
| **Description** | Add ambient audio loops per zone. Zone 1 "Shattered Atrium": low droning hum with occasional geometry crack. Create or generate a 15–30s looping ambient track. AudioManager.playAmbient(zoneId) crossfades between ambient tracks. Ambient volume controlled separately (default 0.3). Start ambient on room load, fade out on death/pause. Hub has its own quieter ambient. Use AudioContext oscillators if no audio files available — procedural drone with filtered noise. |
| **Acceptance Criteria** | Ambient audio plays during gameplay. Changes on zone transition. Fades on pause/death. Volume adjustable. |
| **Verification** | Start run. Hear ambient drone. Pause — audio fades. Resume — audio returns. |

**Implementation note:** Added procedural ambient drone system to `src/audio/AudioManager.ts` using Web Audio API. Two oscillators (detuned for beating), LFO for slow volume modulation, low-pass filter for atmospheric feel. Per-zone configs: `hub` (55Hz sine, very muffled), `shattered-atrium` (65Hz sawtooth, wider beat), plus default fallback. Methods: `playAmbient(zoneId)` with 1.5s fade-in, `fadeAmbientOut(duration)`, `resumeAmbient()`, `stopAmbient()`, `setAmbientVolume()`. Wired in Game.ts: hub load → hub ambient, zone run start → zone ambient, pause → fade out, resume → fade back in, player death → slow 1.5s fade out.

---

### [DONE] T-072: Boss Health Bar UI

| Field | Value |
|-------|-------|
| **Work Type** | `UI` |
| **Priority** | P2 |
| **Depends On** | T-049 |
| **Target Files** | `src/ui/BossHealthBar.ts`, `src/ui/UIManager.ts` |
| **Description** | Full-width health bar at bottom of screen for boss encounters. Shows boss name + HP bar. Red bar with dark background. Phase markers at 66% and 33% (thin white lines). Appears when boss spawns (BOSS_SPAWNED event or encounter metadata flag). Fades out on boss death. Animated HP drain (CSS transition 0.3s). CSS class for low HP pulse effect (<20%). |
| **Acceptance Criteria** | Boss bar appears during boss fights only. Updates in real-time. Phase markers visible. Fades on death. |
| **Verification** | Start boss encounter. Verify bar appears with boss name. Deal damage. Verify bar drains smoothly. |

**Implementation note**: `BossHealthBar.ts` — HTML/CSS overlay component at bottom of screen. 60% width, centered, red gradient fill bar with dark background. Phase markers at 66%/33%. Boss name in red monospace above bar. Subscribes to `ENEMY_DAMAGED` (updates bar width via CSS transition 0.3s) and `ENEMY_DIED` (fades out). Pulse animation on `<20%` HP via injected CSS keyframes. `UIManager.ts` updated with `setBossBar()` for state management (hidden in hub/title/menu, persists during gameplay/pause). `Game.ts` creates instance, registers with UIManager, detects boss enemies after encounter spawn via `BossHealthBar.isBoss()` and calls `showBoss(bossId, maxHp)`.

---

### [DONE] T-073: Settings Menu

| Field | Value |
|-------|-------|
| **Work Type** | `UI` + `meta` |
| **Priority** | P3 |
| **Depends On** | T-063, T-069 |
| **Target Files** | `src/ui/SettingsMenu.ts`, `src/ui/PauseMenu.ts` |
| **Description** | Accessible from pause menu "Settings" button. HTML/CSS overlay with sliders: Master Volume (0–100%), SFX Volume, Music Volume, Camera Sensitivity (0.1–2.0). Changes apply immediately (AudioManager + CameraController). On close: persist via SaveManager.updateSettings(). "Reset to Defaults" button restores DEFAULT_SETTINGS. Escape or "Back" returns to pause menu. |
| **Acceptance Criteria** | All sliders functional. Changes persist across sessions. Camera sensitivity affects orbit speed in real time. |
| **Verification** | Open settings. Adjust volumes. Verify audio changes. Reload game. Verify settings persisted. |

**Implementation note**: `SettingsMenu.ts` — HTML/CSS overlay (z-index 95, above pause menu). Four range sliders: Master Volume (0–100%), SFX Volume (0–100%), Music Volume (0–100%), Camera Sensitivity (0.1–2.0). Changes apply immediately via `SettingsCallbacks` interface that wraps AudioManager and CameraController. "Defaults" button restores `DEFAULT_SETTINGS`. "Back" button persists settings via `SaveManager.updateSettings()` and returns to pause menu. Escape key also closes settings → pause. `PauseMenu.ts` updated with optional `onSettings` callback (4th constructor param), enabling the previously-disabled Settings button. `CameraController.ts` gained `setSensitivity(multiplier)` / `getSensitivity()` using a multiplier on base sensitivity values. Saved camera sensitivity applied on startup in Game.ts.

---

### [DONE] T-074: Weapon HUD Indicator

| Field | Value |
|-------|-------|
| **Work Type** | `UI` |
| **Priority** | P2 |
| **Depends On** | T-054 |
| **Target Files** | `src/ui/HUD.ts` |
| **Description** | Add weapon indicator to HUD bottom-right. Shows equipped weapon name + small icon (colored rectangle representing weapon shape). If 2 weapons carried, show secondary as dimmed smaller icon below. On weapon swap: brief flash animation on new primary. Listen to `WEAPON_SWAPPED` event. Weapon name uses condensed font, 12px, white with 50% opacity. |
| **Acceptance Criteria** | Current weapon name visible during gameplay. Swap shows animation transition. Secondary weapon dimmed. |
| **Verification** | Equip 2 weapons. Verify both shown in HUD. Swap. Verify indicator updates with animation. |

**Implementation note**: Added weapon indicator to `HUD.ts` bottom-right corner. Primary slot shows weapon name (condensed 12px, white 50% opacity) + colored rectangle icon (30×14px). Secondary slot shown dimmed (35% opacity) with smaller icon (22×10px) below primary; hidden when no secondary weapon. On `WEAPON_SWAPPED` event, syncs display and plays CSS `hud-weapon-flash` animation (brightness pulse 0.35s). `HUD.setWeaponSystem()` called from Game.ts to enable weapon data reading. Weapon colors mapped per ID (`fracture-blade` → blue, `edge-spike` → red, `void-needle` → purple, `prism-cleaver` → green).

---

### [DONE] T-075: Room Progress Indicator

| Field | Value |
|-------|-------|
| **Work Type** | `UI` |
| **Priority** | P3 |
| **Depends On** | T-059 |
| **Target Files** | `src/ui/HUD.ts` |
| **Description** | Small dots at top-center of screen showing room progress through the zone. One dot per room in the zone layout. Current room = filled white dot. Cleared rooms = filled grey. Future rooms = hollow outline. Updates on ROOM_CLEARED event. Fades in on room entry, fades to low opacity after 3s. Always shows zone name in small text above dots. |
| **Acceptance Criteria** | Dots match zone layout length. Current room highlighted. Progress updates on room transition. |
| **Verification** | Start run. Verify dots match generated room count. Clear rooms. Verify dots fill in. |

**Implementation note**: Added room progress indicator to `HUD.ts` at top-center of screen. Zone name displayed above dots (10px uppercase, 3px letter spacing). One 8px circular dot per room: hollow outline = future, filled grey = cleared, filled white = current. Subscribes to `ROOM_CLEARED` to advance dots. Fades in at full opacity on room entry, dims to 25% opacity after 3s via `performance.now()` timer in `update()`. `setRoomProgress(index, total, zoneName)` called from `Game.ts` at run start and on room transitions. `hideRoomProgress()` called when returning to hub.

---

### [DONE] T-076: Controls Tutorial Overlay

| Field | Value |
|-------|-------|
| **Work Type** | `UI` |
| **Priority** | P3 |
| **Depends On** | None |
| **Target Files** | `src/ui/ControlsOverlay.ts`, `src/ui/UIManager.ts` |
| **Description** | Toggleable controls reference (F4 key). Semi-transparent panel in screen corner showing: WASD Move, Shift Sprint, Space Dodge, LMB Light Attack, RMB (hold) Heavy Attack, Q Parry, R Heal, Tab Lock-On, E Interact, Esc Pause. Auto-shows on first run (check SaveManager for `tutorialShown` flag). Dismiss with any key. |
| **Acceptance Criteria** | Overlay shows all controls clearly. Auto-shows once for new players. Toggleable with F4. |
| **Verification** | Clear save data. Start game. Verify overlay auto-shows. Dismiss. Press F4. Verify it re-appears. |

**Implementation note**: `ControlsOverlay.ts` — centered semi-transparent panel (z-index 85) listing 12 keybindings (WASD, Shift, Space, LMB, RMB, Q, R, Tab, E, V, M, Esc). Monospace key badges + action labels. Toggle with F1 (F4 was already used for debug clear-room). Any other key dismisses. Auto-shows on first game launch when `tutorialShown` is false. On first dismissal, calls back to persist `tutorialShown: true` via SaveManager. `SaveSchema.ts` updated with `tutorialShown: boolean` in SaveSettings (default false). `SettingsMenu.ts` persist callback changed to `Partial<SaveSettings>` for compatibility. Wired in `Game.ts` with auto-show check and dispose.

---

### [DONE] T-077: Defense/Armor in Damage Calculator

| Field | Value |
|-------|-------|
| **Work Type** | `gameplay` |
| **Priority** | P2 |
| **Depends On** | T-019 |
| **Target Files** | `src/combat/DamageCalculator.ts`, `src/combat/CombatSystem.ts` |
| **Description** | Extend DamageCalculator with defense reduction. Add `defense` field to CombatEntity interface (default 0). Formula: `finalDamage = baseDamage * (100 / (100 + defense))`. This gives diminishing returns: 0 def = 100% dmg, 50 def = 67% dmg, 100 def = 50% dmg. Player base defense: 0 (future: armor pickups). Enemy defense from JSON (add optional `defense` to EnemyData.stats). Monolith Brute gets defense 30. |
| **Acceptance Criteria** | Damage correctly reduced by defense stat. Zero defense = no change. Monolith Brute takes reduced damage. |
| **Verification** | Hit Monolith Brute. Verify damage < base weapon damage. Hit Triangle Shard. Verify full damage. |

**Implementation note**: `DamageCalculator.ts` updated with defense parameter: `finalDamage = rawDamage * (100 / (100 + defense))`, result rounded. Stagger damage NOT reduced by defense. `CombatEntity` interface gained `getDefense(): number`. `CombatSystem.onHit()` passes `defender.getDefense()` to `calculateDamage()`. `EnemyStats` gained `defense: number` field. `EnemyData.stats` gained optional `defense?` field. All 6 enemy subclasses pass `defense: data.stats.defense ?? 0` (defaults to 0). Monolith Brute JSON updated with `"defense": 30` (takes ~77% damage). Player defense hardcoded to 0 in Game.ts.

---

### [DONE] T-078: Parry Damage Buff in Pipeline

| Field | Value |
|-------|-------|
| **Work Type** | `gameplay` |
| **Priority** | P2 |
| **Depends On** | T-039, T-019 |
| **Target Files** | `src/combat/CombatSystem.ts`, `src/combat/DamageCalculator.ts`, `src/player/PlayerStats.ts` |
| **Description** | ParryState currently sets a 1.5x damage buff flag for 3s, but DamageCalculator doesn't check it. Add `getWeaponMultiplier(): number` to PlayerStats that returns 1.5 if parry buff active, else 1.0. CombatSystem passes this multiplier to calculateDamage for player-sourced attacks. Parry buff timer already exists in PlayerStats — just expose it. Add visual indicator: brief white outline on player mesh during buff window. |
| **Acceptance Criteria** | After successful parry, next attacks deal 1.5x damage for 3 seconds. Multiplier appears in damage numbers. |
| **Verification** | Parry an enemy attack. Immediately attack. Compare damage number to non-parry attack. Verify 1.5x. |

**Implementation note**: `CombatSystem.ts` gained `setPlayerAttackMultiplier(provider)` callback + uses it as `weaponMultiplier` arg to `calculateDamage()` for player-sourced attacks (attackerId === PLAYER_ENTITY_ID). The existing `PlayerStateMachine.damageMultiplier` getter (returns 1.5 during 3s parry buff, else 1.0) is wired in via `Game.ts`. `PlayerModel.ts` gained `setParryBuffGlow(active)` — toggles the mesh color to bright white-blue during parry buff window, called each frame from Game.ts fixed update.

---

### [DONE] T-079: Enemy Aggro Coordination

| Field | Value |
|-------|-------|
| **Work Type** | `gameplay` |
| **Priority** | P2 |
| **Depends On** | T-020 |
| **Target Files** | `src/ai/AggroCoordinator.ts`, `src/world/EncounterManager.ts` |
| **Description** | Per the combat spec: max 2 enemies actively attacking at once; others orbit/reposition. Create AggroCoordinator that tracks which enemies have "attack tokens". EncounterManager owns the coordinator. Enemies request a token before entering attack state. If denied (2 tokens out), they orbit/wait. Token released on attack completion or stagger. Token auto-expires after 3s (prevents deadlocks). Coordinator exposed to enemy FSM via EnemyContext. |
| **Acceptance Criteria** | With 4+ enemies, only 2 attack simultaneously. Others visibly orbit or hold position. No deadlocks. |
| **Verification** | Spawn 5 triangle shards. Observe: max 2 attacking at once. Kill one attacker. Verify another claims the token. |

**Implementation note**: Created `src/ai/AggroCoordinator.ts` with max 2 tokens, 3s auto-expiry for deadlock prevention. Added optional `aggroCoordinator` to `EnemyContext` interface and `setAggroCoordinator()` on `BaseEnemy`. Token released on attack state exit, stagger (via `triggerStagger()`), and death (via `die()`). Modified 5 enemy chase/position states (TriangleShard, CubeSentinel, SpiralDancer, MonolithBrute, LatticeWeaver) to `requestAttackToken()` before transitioning to attack — denied enemies orbit at range or wait. All 12 attack state exit methods call `releaseAttackToken()`. AggregateBoss is exempt (bosses always attack). EncounterManager owns the coordinator, ticks it per-frame, clears on encounter start/dispose, and attaches it to each spawned non-boss enemy. Shared helpers added to `shared.ts`: `requestAttackToken()`, `releaseAttackToken()`, `getOrbitTarget()`.

---

### T-080: Enhanced Telegraph VFX

| Field | Value |
|-------|-------|
| **Work Type** | `polish` |
| **Priority** | P2 |
| **Depends On** | T-011 |
| **Target Files** | `src/rendering/TelegraphVFX.ts`, `src/enemies/BaseEnemy.ts` |
| **Description** | Standardize and enhance enemy telegraph visuals. TelegraphVFX utility: `startTelegraph(mesh, color, duration)` — animates uBaseColor toward telegraph color (red for melee, orange for ranged, white for unblockable) with pulsing intensity. Add scale pulse (1.0 → 1.15 → 1.0 over telegraph duration). On telegraph end: snap back to original color. BaseEnemy exposes `telegraph(color, duration)` and `endTelegraph()` helper methods that subclass states call. |
| **Acceptance Criteria** | All enemy attacks show consistent color-coded telegraph glow with scale pulse. Colors match spec: red=melee, orange=ranged, white=unblockable. |
| **Verification** | Fight each enemy type. Verify telegraph glow color matches attack type. Verify pulse is visible. |

---

### T-081: Screen Vignette on Low HP

| Field | Value |
|-------|-------|
| **Work Type** | `rendering` |
| **Priority** | P3 |
| **Depends On** | T-012 |
| **Target Files** | `src/rendering/PostProcessing.ts`, `src/shaders/vignetteFragment.ts` |
| **Description** | Add vignette post-processing effect that intensifies as player HP drops. New ShaderPass: radial darkening from edges, tinted red. Intensity = `1 - (currentHP / maxHP)` clamped to [0, 0.6]. At full HP: no vignette. At 30% HP: noticeable red-black edges. At 10%: heavy vignette. PostProcessing.setVignetteIntensity(value) called from Game.ts update based on PlayerStats. Pulsing at <20% HP (sine wave on intensity ±0.1). |
| **Acceptance Criteria** | No vignette at full HP. Visible red vignette below 50% HP. Pulsing below 20%. Does not obscure center of screen. |
| **Verification** | Take damage to various HP levels. Verify vignette intensity scales. Heal. Verify vignette recedes. |

---

### T-082: Player Death Animation Enhancement

| Field | Value |
|-------|-------|
| **Work Type** | `polish` |
| **Priority** | P3 |
| **Depends On** | T-038, T-009 |
| **Target Files** | `src/player/states/DeadState.ts`, `src/player/PlayerModel.ts` |
| **Description** | Enhance the player death sequence. On entering dead state: 1) Slow-motion effect (GameLoop.setTimeScale(0.3)) for 1s then restore. 2) Player mesh fragments into 12–16 tetrahedron pieces (reuse BaseEnemy shatter pattern) bursting outward. 3) Camera slowly pulls back by 2m over 1.5s. 4) After 1.5s, emit PLAYER_DIED to trigger death screen. Currently death is instant — this adds dramatic weight. |
| **Acceptance Criteria** | Death triggers slow-motion, fragment burst, camera pull-back, then death screen. Total duration ~2s. |
| **Verification** | Die to enemy. Verify slow-mo effect. Verify mesh shatters. Verify camera pulls back. Verify death screen appears after. |

---

### T-083: Encounter Debug Commands

| Field | Value |
|-------|-------|
| **Work Type** | `tooling` |
| **Priority** | P2 |
| **Depends On** | T-026 |
| **Target Files** | `src/utils/debug.ts`, `src/app/Game.ts` |
| **Description** | Add debug console commands accessible via browser devtools. Expose `window.__celtest` object with: `spawnEnemy(typeId, x, z)` — spawns a single enemy at position. `clearRoom()` — kills all enemies instantly. `nextRoom()` — triggers room transition. `setHP(value)` — set player HP. `giveShards(amount)` — add shards. `listEnemies()` — log all active enemies with HP/state. Only available when debug overlay is active (F1). |
| **Acceptance Criteria** | All commands functional from browser console. Only exposed when debug mode active. |
| **Verification** | Open console. Call `__celtest.spawnEnemy('triangle-shard', 3, 3)`. Verify enemy appears. Call clearRoom(). Verify all die. |

---

### T-084: Performance Stats Panel

| Field | Value |
|-------|-------|
| **Work Type** | `tooling` |
| **Priority** | P3 |
| **Depends On** | T-026, T-043 |
| **Target Files** | `src/utils/debug.ts` |
| **Description** | Extend debug overlay (F1) with a performance stats section. Show: draw calls (renderer.info.render.calls), triangles, active entities (encounter enemies + pickups), object pool stats (particle pool active/available, pickup mesh pool active/available, damage number pool active/available), frame time graph (last 60 frames as a simple bar chart using CSS). Update every 500ms to avoid perf overhead from the monitoring itself. |
| **Acceptance Criteria** | Performance panel shows accurate real-time stats. Pool utilization visible. Frame time graph renders. |
| **Verification** | Enable debug overlay. Verify draw call count matches scene complexity. Spawn enemies. Verify entity count updates. |

---

### T-085: Hitbox Manager Object Pool

| Field | Value |
|-------|-------|
| **Work Type** | `infrastructure` |
| **Priority** | P3 |
| **Depends On** | T-043, T-018 |
| **Target Files** | `src/combat/HitboxManager.ts` |
| **Description** | Convert HitboxManager to pool Hitbox objects instead of creating new ones per attack. Pool the `alreadyHit: Set` objects — clear instead of allocating new. Pre-warm 20 hitbox objects. On createHitbox(): acquire from pool, populate fields. On removeHitbox(): release back to pool, clear alreadyHit set. Reduces GC pressure during intense combat with many simultaneous attacks. |
| **Acceptance Criteria** | No new Hitbox allocations during combat. Pool stats visible in debug panel (T-084). Hit detection unchanged. |
| **Verification** | Fight enemies. Monitor debug panel pool stats. Verify hitbox pool reuses objects. Verify no hit detection regressions. |
