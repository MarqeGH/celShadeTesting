# Completed: World, Progression & Interactions

> Arena, room assembly, encounters, doors, zones, pickups, run state, death screen.

---

## T-013: Ground Plane and Test Arena
- `TestArena`: 20x20m arena with floor + 4 walls (3m tall, 0.4m thick), cel-shaded
- Walls export `WallCollider` AABBs for collision. DirectionalLight + AmbientLight for cel-shading
- **Files:** `src/world/RoomModule.ts`

## T-027: Room Assembler (Basic)
- `RoomAssembler.assemble(data)` builds floor, walls (with AABB colliders), spawn point debug markers, exit doors
- `RoomModule` class: `getSpawnPoints()`, `getPlayerEntry()`, `getExits()`, `unlockExits()`, `dispose()`
- Doors start red (locked), turn green on unlock via shader color swap
- **Files:** `src/world/RoomAssembler.ts`, `src/world/RoomModule.ts`

## T-028: Encounter Manager
- Wave-based enemy spawning. `startEncounter(encounter, roomId, spawnPoints, playerPosition)`
- Spawn strategies: `random` (distributed with offset), `nearest`, `farthest`, numeric index
- CubeSentinel auto-gets `setScene()`. Emits `ROOM_CLEARED` when all waves cleared
- Dead-enemy cleanup: unregisters from CombatSystem, StaggerSystem
- **Files:** `src/world/EncounterManager.ts`

## T-029: Door System
- Listens for `ROOM_CLEARED` → unlocks exits. Proximity check (2.5m) shows "Press E to enter" prompt
- Transition: fade out 500ms → async callback → reposition player → fade in 500ms
- `Game.handleRoomTransition(exit)`: dispose encounter, unload room, load next via AssetLoader + RoomAssembler, start new encounter
- **Files:** `src/world/DoorSystem.ts`

## T-030: Zone Generator (Linear)
- `ZoneGenerator.generate(zoneId)` produces ordered `{roomId, encounterId, difficulty}` pairs
- Weighted random room/encounter selection within difficulty tolerance. Back-to-back repeat avoidance
- Zone1: "The Shattered Atrium" — 5 rooms, 5 encounters, difficulty curve [1,2,3,5,6,7]
- **Files:** `src/world/ZoneGenerator.ts`, `src/levels/Zone1Config.ts`, `src/levels/ZoneRegistry.ts`

## T-035: Pickup System
- `ENEMY_DIED` → spawns octahedron shard pickups (gold #e0d060) at death position
- Float + rotate animation. Auto-collect at 2m, magnetic pull at 3m. 30s despawn
- Emits `SHARD_COLLECTED` with amount. Drop counts from enemy JSON data
- **Files:** `src/interactions/PickupSystem.ts`, `src/interactions/Interactable.ts`

## T-036: Run State Manager
- Tracks: zone, room index, shards, weapon, buffs, heal charges, rooms cleared, enemies killed
- `startRun()` resets all. `endRun()` calculates rewards (50% shards kept)
- Auto-subscribes to `ENEMY_DIED`, `ROOM_CLEARED`, `SHARD_COLLECTED` during active run
- **Files:** `src/progression/RunState.ts`

## T-037: Death Screen
- `MenuSystem`: "Collapsed" overlay on `PLAYER_DIED`. Shows run stats from `RunState.endRun(false)`
- "Return to Hub" resets player, clears encounter, restarts fresh run
- 500ms fade-in. Gold highlight on "Shards Kept" row
- **Files:** `src/ui/MenuSystem.ts`
