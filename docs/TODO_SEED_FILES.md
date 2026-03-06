# TODO Seed Files

> Starter TODO outlines for key implementation files. Each section defines purpose, responsibilities, and a concrete checklist for the implementing agent.

---

## docs/README.md

**Purpose**: Public-facing project overview for contributors and agents.

**Responsibilities**: Communicate project vision, technical stack, and design constraints.

**TODO Checklist**:
- [x] Write project premise and tone
- [x] Define player fantasy
- [x] Document gameplay loop
- [x] List technical stack
- [x] Define core pillars
- [x] State design constraints
- [x] Describe visual direction
- [x] Explain Three.js choice
- [ ] Add "Getting Started" section once T-001 is complete (npm install, npm run dev)
- [ ] Add build/deploy instructions once Vite config is finalized

**Notes**: Keep concise. This is a reference doc, not a pitch deck.

---

## docs/ARCHITECTURE.md

**Purpose**: Technical system decomposition for implementation agents.

**Responsibilities**: Define every major system, its boundaries, dependencies, and file locations.

**TODO Checklist**:
- [x] Define all 19 systems with responsibility/dependency/file tables
- [x] System diagram (ASCII)
- [x] Event bus event list
- [x] Player state transition rules
- [ ] Update file paths as implementation progresses (if files are renamed or split)
- [ ] Add sequence diagrams for complex flows (hit detection → damage → death) once combat is stable
- [ ] Document any new systems added during implementation

**Notes**: This is the source of truth for system boundaries. If implementation deviates, update this doc.

---

## docs/LORE_BASIS.md

**Purpose**: Compact lore reference for content creators (enemy designers, level builders).

**Responsibilities**: Establish what shapes mean, why the world looks this way, and what motifs to use.

**TODO Checklist**:
- [x] World premise
- [x] Shape-as-reduction concept
- [x] Player identity
- [x] Enemy ontology
- [x] Environment rationale
- [x] Central conflict
- [x] Symbolic motifs table
- [x] Boss themes
- [ ] Add lore notes per zone as zones are built (what this place "was")
- [ ] Add lore notes per enemy as enemies are finalized (who this shape "was")

**Notes**: Lore is a design constraint, not narrative content. Keep it short and usable.

---

## tasks/TASKS.md

**Purpose**: Master task registry for autonomous agents.

**Responsibilities**: Track all implementation tasks with dependencies, acceptance criteria, and status.

**TODO Checklist**:
- [x] 45 tasks defined with full metadata
- [x] Dependency graph
- [ ] Mark tasks as [DONE] as they are completed
- [ ] Add [BLOCKED] annotations if blockers are discovered
- [ ] Add new tasks as implementation reveals needs (prefix T-046+)
- [ ] Add bug tasks as T-BUG-{number}
- [ ] Track actual files modified per completed task

**Notes**: This is a living document. Agents should update it as they work.

---

## src/player/PlayerController.ts

**Purpose**: Central player character controller — routes input to actions, owns state machine, manages position and physics.

**Responsibilities**:
- Read input from InputManager and map to player actions
- Own and update PlayerStateMachine
- Apply movement (camera-relative)
- Handle collision response
- Expose player position, rotation, and state for other systems

**TODO Checklist**:
- [ ] Create class `PlayerController`
- [ ] Constructor: accept references to InputManager, CameraController, CollisionSystem
- [ ] Store player position as `THREE.Vector3`
- [ ] `update(dt: number)` method:
  - [ ] Read input actions
  - [ ] Calculate camera-relative movement direction
  - [ ] Apply speed (walk/sprint based on input and stamina)
  - [ ] Update position
  - [ ] Run collision checks and resolve overlaps
  - [ ] Update mesh position and rotation
  - [ ] Update state machine
- [ ] `getPosition(): THREE.Vector3`
- [ ] `getForward(): THREE.Vector3`
- [ ] `getState(): string` (current FSM state name)
- [ ] Player rotation: smooth lerp toward movement direction
- [ ] Lock-on mode: movement becomes strafe-relative, rotation faces locked target
- [ ] Integrate with PlayerStats for stamina checks before actions

**Notes**:
- Movement is 2D on the XZ plane (Y = 0)
- Do NOT put attack/dodge logic here — that belongs in state machine states
- This class is the "glue" — it should delegate, not implement

---

## src/combat/CombatSystem.ts

**Purpose**: Central combat resolution pipeline — connects hitbox detection to damage application.

**Responsibilities**:
- Each frame: check active hitboxes against hurtboxes via HitboxManager
- On hit: invoke DamageCalculator, apply damage to target, check death, emit events
- Handle parry interactions (if parry frame active on defender)
- Prevent duplicate hits (same attack instance can only hit same target once)

**TODO Checklist**:
- [ ] Create class `CombatSystem`
- [ ] Constructor: accept references to HitboxManager, DamageCalculator, StaggerSystem, EventBus
- [ ] `update(dt: number)` method:
  - [ ] Get all active hitboxes from HitboxManager
  - [ ] For each hitbox, test against all hurtboxes
  - [ ] Filter out already-hit pairs (attack instance ID + target ID)
  - [ ] For valid hits:
    - [ ] Check if defender is in parry window → handle parry
    - [ ] Check if defender is in i-frame → skip
    - [ ] Calculate damage via DamageCalculator
    - [ ] Apply damage to defender
    - [ ] Apply stagger damage via StaggerSystem
    - [ ] Emit ENEMY_DAMAGED or PLAYER_DAMAGED event
    - [ ] Check death condition → emit ENEMY_DIED or PLAYER_DIED
  - [ ] Record hit pair to prevent duplicates
- [ ] `reset()` method: clear hit record (call on new attack instance)
- [ ] Hit record cleanup: remove records for expired attack instances

**Notes**:
- CombatSystem does NOT create hitboxes — weapon/enemy attack states do
- CombatSystem does NOT know about specific weapons or enemies — it works with generic interfaces
- Keep this system thin — it's a pipeline, not a feature dump

---

## src/enemies/BaseEnemy.ts

**Purpose**: Abstract base class for all enemies — provides common functionality that specific enemy types extend.

**Responsibilities**:
- Own Three.js mesh, position, rotation
- Own FSM instance (initialized by subclass with per-type states)
- Own stats (HP, speed, poise) loaded from data
- Own hurtbox
- Provide takeDamage(), die(), update() methods
- Visual feedback: red flash on hit, death particle effect

**TODO Checklist**:
- [ ] Create abstract class `BaseEnemy`
- [ ] Properties:
  - [ ] `mesh: THREE.Mesh`
  - [ ] `fsm: StateMachine`
  - [ ] `stats: { hp: number, maxHp: number, moveSpeed: number, poise: number, maxPoise: number }`
  - [ ] `hurtbox: Hurtbox`
  - [ ] `position: THREE.Vector3`
  - [ ] `rotation: number` (Y-axis rotation)
  - [ ] `isAlive: boolean`
  - [ ] `data: EnemyData` (loaded from JSON)
- [ ] Constructor: accept EnemyData, spawn position
  - [ ] Initialize stats from data
  - [ ] Create hurtbox at position
  - [ ] Call abstract `createMesh()` — subclass provides geometry
  - [ ] Call abstract `initFSM()` — subclass configures states
- [ ] `update(dt: number)`:
  - [ ] Update FSM
  - [ ] Update mesh position/rotation from internal state
  - [ ] Update hurtbox position
- [ ] `takeDamage(amount: number, staggerDamage: number)`:
  - [ ] Reduce HP
  - [ ] Flash mesh red (restore after 100ms)
  - [ ] Apply stagger damage to poise
  - [ ] If poise ≤ 0: enter staggered state
  - [ ] If HP ≤ 0: call die()
- [ ] `die()`:
  - [ ] Set isAlive = false
  - [ ] Remove hurtbox
  - [ ] Play death effect (particle burst)
  - [ ] Emit ENEMY_DIED event with drop data
  - [ ] Remove mesh from scene after 500ms delay
- [ ] Abstract `createMesh(): THREE.Mesh`
- [ ] Abstract `initFSM(): void`

**Notes**:
- Subclasses (TriangleShard, CubeSentinel, etc.) override createMesh and initFSM
- Do NOT put type-specific behavior in BaseEnemy
- Red flash: set emissive color to red, reset after timer
- Death particles should match enemy color/shape

---

## src/world/RoomAssembler.ts

**Purpose**: Constructs Three.js scene geometry from room module data files.

**Responsibilities**:
- Read RoomModuleData JSON
- Create floor, walls, and prop geometry
- Place spawn point markers (debug) and exit door objects
- Apply cel-shading materials
- Expose room interface for EncounterManager and DoorSystem

**TODO Checklist**:
- [ ] Create class `RoomAssembler`
- [ ] `assemble(data: RoomModuleData): RoomModule` method:
  - [ ] Create floor plane from data.size (x, z)
  - [ ] Create walls from data.size (4 walls, height from data.size.y)
  - [ ] Apply cel-shading material to all geometry
  - [ ] Place exit door objects at data.exits positions
  - [ ] Place hazard zones at data.hazards positions (if any)
  - [ ] Place props at data.props positions
  - [ ] Create debug markers at data.spawnPoints (visible only in debug mode)
  - [ ] Return RoomModule instance
- [ ] Wall creation: BoxGeometry, positioned at room edges
- [ ] Door creation: placeholder geometry (flat rectangle in wall), colored red (locked) or green (unlocked)
- [ ] Apply lighting: ensure directional + ambient lights exist in room
- [ ] Room should be a THREE.Group that can be added/removed from scene as a unit
- [ ] `teardown(room: RoomModule)`: remove all scene objects, dispose geometry/materials

**Notes**:
- Rooms are not procedurally generated geometry — they are data-driven assemblies of primitives
- For now, all rooms use simple box/plane geometry. GLTF models for rooms come later.
- Keep materials shared (don't create new material per wall — reuse from a material cache)
- RoomModule.ts is a separate file that holds the assembled room's interface (getSpawnPoints, getExits, etc.)

---

## data/enemies/basic-shape.json

> Note: this is `triangle-shard.json` — the first and simplest enemy data file.

**Purpose**: Data definition for the Triangle Shard enemy — loaded at runtime by EnemyFactory.

**Responsibilities**: Define all Triangle Shard stats, attacks, perception, drops, and FSM configuration.

**TODO Checklist**:
- [x] Define in DATA_SCHEMAS.md (schema is finalized)
- [ ] Create `data/enemies/triangle-shard.json` with:
  - [ ] id: "triangle-shard"
  - [ ] stats: HP 30, speed 6, poise 20
  - [ ] perception: aggro 10m, attack 4m, no retreat
  - [ ] attacks: lunge (400ms telegraph, 200ms active, 600ms recovery, 15 dmg, 4m line) and slash (300ms/150ms/400ms, 10 dmg, 2m arc)
  - [ ] drops: shards 3–7, fragment chance 5%
  - [ ] fsm: idle → chase → attack → staggered, with correct transitions
- [ ] Validate JSON against schema
- [ ] Test loading via AssetLoader

**Notes**:
- This is the reference enemy data file. Other enemies follow this exact format.
- Damage values should feel significant: 15 damage on a 100 HP player = ~7 hits to kill = fair but punishing.
- FSM config must use condition strings that the AI system recognizes (see DATA_SCHEMAS.md condition table).
- Keep attack timings generous for a basic enemy — this is the "tutorial" enemy.
