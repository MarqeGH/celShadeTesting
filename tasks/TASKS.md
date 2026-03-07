# Task Registry

> Each task is designed to be completable by an autonomous agent in one focused session.
> Tasks are ordered by recommended implementation sequence.
> Dependencies must be completed before a task can begin.

---

## Work Type System

Every task is assigned a **Work Type** that categorizes the domain of work involved. This helps autonomous agents stay within their area of expertise and avoid unintended cross-system side effects.

### Categories

| Work Type | Scope |
|-----------|-------|
| `infrastructure` | Engine setup, bootstrap, config, event systems, asset loading, collision primitives, object pooling |
| `gameplay` | Player mechanics, combat, AI behavior, enemy implementations, interaction systems |
| `rendering` | Shaders, lighting, post-processing, materials, visual mesh creation |
| `data` | JSON schemas, content files, registries, factory/loader patterns |
| `world` | Levels, rooms, zone generation, encounter spawning, doors, hazards |
| `UI` | HUD, menus, overlays — HTML/CSS layer |
| `tooling` | Debug tools, dev utilities, visualization aids |
| `polish` | Particles, camera shake, VFX, damage numbers, cosmetic feedback |
| `meta` | Save system, progression, run state, unlock tracking |

### Agent Boundary Rules

- **Gameplay agents** should not modify rendering pipeline files (`src/rendering/`, `src/shaders/`)
- **Rendering agents** should not modify combat logic (`src/combat/`, `src/player/PlayerStateMachine.ts`)
- **Data agents** should not modify engine internals (`src/engine/`, `src/app/`)
- **Polish agents** should not change gameplay balance values (`src/config/gameConfig.ts` tuning numbers)
- **UI agents** should not modify game state logic (`src/progression/`, `src/combat/`)
- **World agents** should not modify enemy behavior (`src/enemies/`, `src/ai/states/`)
- **Tooling agents** should only read from game systems, never write gameplay state

When a task spans two domains (e.g., gameplay + rendering), the Work Type reflects the **primary** domain. The agent should take extra care with files outside their Work Type.

---

## [DONE] T-001: Project Bootstrap

| Field | Value |
|-------|-------|
| **Category** | Bootstrap |
| **Work Type** | `infrastructure` |
| **Priority** | P0 |
| **Depends On** | None |
| **Target Files** | `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `public/index.html`, `src/main.ts` |
| **Description** | Initialize the project with Vite + TypeScript + Three.js. Create package.json with dependencies (three, @types/three, howler, @types/howler). Set up tsconfig with strict mode. Configure Vite for dev server and build. Create minimal index.html with a canvas container div. Create main.ts that logs "Celtest initialized" to console. |
| **Acceptance Criteria** | `npm install` succeeds. `npm run dev` starts a dev server. Browser shows blank page with console message. TypeScript compiles without errors. |
| **Verification** | Run `npm run dev`, open browser, check console output. |

---

## [DONE] T-002: Basic Three.js Scene

| Field | Value |
|-------|-------|
| **Category** | Rendering |
| **Work Type** | `rendering` |
| **Priority** | P0 |
| **Depends On** | T-001 |
| **Target Files** | `src/app/Game.ts`, `src/rendering/Renderer.ts`, `src/main.ts` |
| **Description** | Create Game class that initializes a Three.js WebGLRenderer, Scene, and PerspectiveCamera. Render a static colored cube at origin. Set up window resize handling. Background color: dark grey (#1a1a1a). Camera at (0, 5, 10) looking at origin. |
| **Acceptance Criteria** | Browser shows a 3D cube rendered on dark background. Window resize adjusts viewport correctly. No console errors. |
| **Verification** | Visual inspection in browser. Resize window and confirm no distortion. |

**Implementation Notes:**
- Created `src/rendering/Renderer.ts` — wraps `THREE.WebGLRenderer` with resize support, clear color set to `#1a1a1a`
- Created `src/app/Game.ts` — composition root that creates Scene, PerspectiveCamera (at 0,5,10), Renderer, and a test cube (`BoxGeometry` + `MeshBasicMaterial` in desaturated cyan)
- Updated `src/main.ts` — instantiates `Game` with the `#game-container` element
- Window resize handler updates camera aspect ratio, projection matrix, and renderer size
- TypeScript compiles clean, Vite build succeeds
- **Files changed:** `src/rendering/Renderer.ts` (new), `src/app/Game.ts` (new), `src/main.ts` (modified)

---

## [DONE] T-003: Game Loop with Fixed Timestep

| Field | Value |
|-------|-------|
| **Category** | Engine |
| **Work Type** | `infrastructure` |
| **Priority** | P0 |
| **Depends On** | T-002 |
| **Target Files** | `src/app/GameLoop.ts`, `src/engine/Clock.ts`, `src/app/Game.ts` |
| **Description** | Implement a fixed-timestep game loop (60Hz update, variable render). Clock class provides deltaTime and fixedStep. GameLoop uses requestAnimationFrame with accumulator pattern. Game.update(dt) called at fixed rate. Game.render(alpha) called every frame with interpolation alpha. Rotate the test cube in update() to verify loop works. |
| **Acceptance Criteria** | Cube rotates at consistent speed regardless of frame rate. update() runs at 60Hz. render() runs at display refresh rate. |
| **Verification** | Visual: cube rotates smoothly. Log update count per second — should be ~60. |

**Implementation Notes:**
- Created `src/engine/Clock.ts` — provides `deltaTime`, `elapsed`, and `fixedStep` (1/60). Uses rAF timestamp, converts ms→s, caps deltaTime at 250ms to prevent spiral of death after tab-away.
- Created `src/app/GameLoop.ts` — accumulator-pattern loop: fixed 60Hz `update(dt)` calls + variable-rate `render(alpha)` with interpolation alpha. Uses `requestAnimationFrame`.
- Updated `src/app/Game.ts` — integrates GameLoop, rotates test cube in `update()` (Y: 1.5 rad/s, X: 0.8 rad/s). Removed single-frame render call. Added `dispose()` cleanup for loop stop.
- TypeScript compiles clean, Vite build succeeds, dev server starts.
- **Files changed:** `src/engine/Clock.ts` (new), `src/app/GameLoop.ts` (new), `src/app/Game.ts` (modified)

---

## [DONE] T-004: Event Bus

| Field | Value |
|-------|-------|
| **Category** | Engine |
| **Work Type** | `infrastructure` |
| **Priority** | P0 |
| **Depends On** | T-001 |
| **Target Files** | `src/app/EventBus.ts` |
| **Description** | Implement a typed event bus with `on(event, callback)`, `off(event, callback)`, `emit(event, data)`. Events should be typed via a central GameEvents interface. Include events: `PLAYER_DAMAGED`, `ENEMY_DAMAGED`, `ENEMY_DIED`, `ROOM_CLEARED`, `PLAYER_DIED`, `RUN_STARTED`, `RUN_ENDED`. |
| **Acceptance Criteria** | Subscribing to an event and emitting it calls the callback with correct typed data. `off` removes subscription. No memory leaks from forgotten subscriptions. |
| **Verification** | Unit test: subscribe, emit, verify callback. Test off() prevents callback. |

**Implementation Notes:**
- Created `src/app/EventBus.ts` — typed event bus using `Map<GameEventName, Set<Callback>>` for O(1) subscribe/unsubscribe with no duplicate listener risk
- `GameEvents` interface defines typed payloads for all 7 events: `PLAYER_DAMAGED`, `ENEMY_DAMAGED`, `ENEMY_DIED`, `ROOM_CLEARED`, `PLAYER_DIED`, `RUN_STARTED`, `RUN_ENDED`
- Generic `on<E>()`, `off<E>()`, `emit<E>()` methods enforce type safety — callbacks receive correctly typed data
- `off()` removes from Set and cleans up empty entries to prevent memory leaks
- `clear()` method for full teardown/dispose
- TypeScript compiles clean, Vite build succeeds
- **Files changed:** `src/app/EventBus.ts` (new)

---

## [DONE] T-005: Input Manager

| Field | Value |
|-------|-------|
| **Category** | Input |
| **Work Type** | `infrastructure` |
| **Priority** | P0 |
| **Depends On** | T-001 |
| **Target Files** | `src/app/InputManager.ts` |
| **Description** | Create InputManager that maps keyboard + mouse input to game actions. Support actions: `moveForward`, `moveBack`, `moveLeft`, `moveRight`, `sprint`, `dodge`, `lightAttack`, `heavyAttack`, `parry`, `heal`, `lockOn`, `swapWeapon`, `pause`. Provide `isPressed(action)`, `justPressed(action)`, `justReleased(action)`. Poll-based (update once per frame). Include 150ms input buffer for attack queuing. |
| **Acceptance Criteria** | WASD maps to movement. Mouse buttons map to attacks. Shift = sprint. Space = dodge. `justPressed` fires only on the frame the key goes down. Input buffer stores recent actions for 150ms. |
| **Verification** | Manual test: log actions to console on key press. Verify justPressed only fires once. |

**Implementation Notes:**
- Created `src/app/InputManager.ts` — poll-based input system with event queuing
- `GameAction` type defines all 13 actions; `DEFAULT_BINDINGS` maps them to keyboard codes / mouse buttons
- WASD → movement, Shift → sprint, Space → dodge, LMB → light attack, RMB → heavy attack, Q → parry, R → heal, Tab/MMB → lock-on, F → swap weapon, Escape → pause
- Edge detection via queue-then-process pattern: `keyDownQueue`/`keyUpQueue` filled by event handlers, consumed in `update()` to populate `keysJustDown`/`keysJustUp` sets
- `isPressed(action)` — held state; `justPressed(action)` — single-frame down edge; `justReleased(action)` — single-frame up edge
- 150ms input buffer: `justPressed` actions are buffered; `consumeBuffer(action)` / `hasBuffered(action)` for attack queuing
- Mouse delta tracking (`mouseDeltaX`/`mouseDeltaY`) for future camera orbit
- Context menu suppressed to allow RMB for heavy attack
- `dispose()` removes all listeners; custom bindings via constructor override
- TypeScript compiles clean, Vite build succeeds
- **Files changed:** `src/app/InputManager.ts` (new)

---

## [DONE] T-006: Player Model and Scene Placement

| Field | Value |
|-------|-------|
| **Category** | Player |
| **Work Type** | `rendering` |
| **Priority** | P0 |
| **Depends On** | T-002 |
| **Target Files** | `src/player/PlayerModel.ts` |
| **Description** | Create a placeholder player mesh: an icosahedron (Three.js IcosahedronGeometry) with a custom material. Color: desaturated cyan (#607080). Add subtle vertex displacement noise that updates per frame (flickering effect — the player is unstable). Place at world origin. |
| **Acceptance Criteria** | An icosahedron is visible at origin. Vertices subtly shift each frame, creating a "flickering" instability effect. Material is flat-colored (no texture). |
| **Verification** | Visual inspection. The shape should visibly shimmer/flicker. |

**Implementation Notes:**
- Created `src/player/PlayerModel.ts` — icosahedron (radius 0.8, detail 1) with `MeshBasicMaterial` color `#607080`
- Per-frame vertex displacement along normals using multi-frequency sin/cos pseudo-noise (speed 8, strength 0.04) creates a subtle flickering/shimmer effect
- Base positions stored at construction time; each `update(dt)` displaces from base to avoid drift
- Mesh positioned at Y=0.8 to sit on future ground plane
- Integrated into `Game.ts`: added to scene, updated in game loop, disposed on cleanup
- TypeScript compiles clean, Vite build succeeds
- **Files changed:** `src/player/PlayerModel.ts` (new), `src/app/Game.ts` (modified)

---

## [DONE] T-007: Third-Person Camera Controller

| Field | Value |
|-------|-------|
| **Category** | Camera |
| **Work Type** | `gameplay` |
| **Priority** | P0 |
| **Depends On** | T-003, T-005 |
| **Target Files** | `src/camera/CameraController.ts` |
| **Description** | Implement a third-person camera that follows the player position. Orbit via mouse movement (right mouse button held or always-on). Camera distance: 8m. Camera height offset: 3m. Smooth follow using lerp (smoothing factor: 0.1). Clamp vertical rotation to -10° to 60°. Mouse sensitivity configurable. |
| **Acceptance Criteria** | Camera follows player position smoothly. Mouse orbit rotates camera around player. Vertical rotation is clamped. Camera distance and height are correct. |
| **Verification** | Move player (once movement is in), verify camera follows. Orbit with mouse, verify smooth rotation and clamp. |

**Implementation Notes:**
- Created `src/camera/CameraController.ts` — third-person orbit camera with spherical coordinate orbit (yaw/pitch)
- Mouse movement always controls orbit (no button hold required). Sensitivity: 0.003 rad/px for both axes
- Distance: 8m, height offset: 3m above target. Pitch clamped to [-10°, 60°]
- Smooth follow via `Vector3.lerp` with factor 0.1 per update step. First frame snaps to target to avoid lerping from origin
- Exposes `getYaw()`, `getForward()`, `getRight()` for camera-relative movement (used by future PlayerController)
- Integrated into `Game.ts`: constructed with camera + input refs, updated each tick with player mesh position
- Removed static camera positioning from Game constructor (CameraController now owns camera transform)
- TypeScript compiles clean, Vite build succeeds
- **Files changed:** `src/camera/CameraController.ts` (new), `src/app/Game.ts` (modified)

---

## [DONE] T-008: Player Movement Controller

| Field | Value |
|-------|-------|
| **Category** | Player |
| **Work Type** | `gameplay` |
| **Priority** | P0 |
| **Depends On** | T-005, T-006, T-007 |
| **Target Files** | `src/player/PlayerController.ts` |
| **Description** | Implement camera-relative movement. WASD input maps to movement relative to camera facing direction. Walk speed: 5 m/s. Sprint speed: 8 m/s (hold shift). Player mesh rotates to face movement direction (smooth rotation via lerp). Apply ground-plane movement only (Y stays at 0 for now). |
| **Acceptance Criteria** | WASD moves player relative to camera direction. Sprint increases speed. Player mesh faces movement direction. Movement is smooth and consistent at 60Hz. |
| **Verification** | Move with WASD, orbit camera, confirm movement stays camera-relative. Sprint with shift held. |

**Implementation Notes:**
- Created `src/player/PlayerController.ts` — reads WASD input, computes camera-relative movement direction using `CameraController.getForward()`/`getRight()`
- Walk speed: 5 m/s, sprint speed: 8 m/s (shift held). Ground-plane only (Y unchanged)
- Smooth mesh rotation via exponential decay lerp (`1 - exp(-speed * dt)`) with shortest-arc wrapping to avoid spinning the wrong way
- Reuses pre-allocated `Vector3` instances to avoid per-frame allocation
- Integrated into `Game.ts`: constructed after CameraController + PlayerModel, updated each tick before camera follow
- TypeScript compiles clean, Vite build succeeds
- **Files changed:** `src/player/PlayerController.ts` (new), `src/app/Game.ts` (modified)

---

## [DONE] T-009: Player State Machine

| Field | Value |
|-------|-------|
| **Category** | Player |
| **Work Type** | `gameplay` |
| **Priority** | P0 |
| **Depends On** | T-008 |
| **Target Files** | `src/player/PlayerStateMachine.ts`, `src/ai/StateMachine.ts`, `src/ai/AIState.ts` |
| **Description** | Implement generic StateMachine class with states that have `enter()`, `update(dt)`, `exit()` methods. Create PlayerStateMachine with states: `idle`, `run`, `dodge`, `light_attack`, `heavy_attack`, `stagger`, `heal`, `dead`. Implement transition logic per ARCHITECTURE.md state transition rules. Only `idle` and `run` need full behavior for this task — others can be stubs that return to idle after a timer. |
| **Acceptance Criteria** | Player transitions between idle and run based on input. State machine logs transitions to console. Stub states (dodge, attack, etc.) activate and return to idle after set duration. No state can be entered while already in it (no re-entry). |
| **Verification** | Console log state transitions. Press dodge key → see "dodge" state → returns to idle after 300ms. |

**Implementation Notes:**
- Created `src/ai/AIState.ts` — generic `AIState<TContext>` interface with `name`, `enter()`, `update(dt)` → `string | null`, `exit()` lifecycle methods
- Created `src/ai/StateMachine.ts` — generic `StateMachine<TContext>` class. States registered by name, `update()` delegates to current state, state returns next state name (or null to stay). No re-entry guard. Logs all transitions to console.
- Created `src/player/PlayerStateMachine.ts` — `PlayerContext` bundles input/controller/model/camera. `IdleState` checks movement→run and action inputs→dodge/attack/heal. `RunState` delegates movement to `PlayerController.update(dt)` and checks for idle/action transitions. Stub states (`dodge` 300ms, `light_attack` 450ms, `heavy_attack` 600ms, `stagger` 500ms, `heal` 800ms) use `TimedStubState` that returns to idle after duration. `DeadState` is terminal.
- Updated `src/app/Game.ts` — replaced direct `playerController.update(dt)` with `playerStateMachine.update(dt)`. Removed temporary input logging. Movement is now gated by FSM state (only active in `run` state).
- **Files changed:** `src/ai/AIState.ts` (new), `src/ai/StateMachine.ts` (new), `src/player/PlayerStateMachine.ts` (new), `src/app/Game.ts` (modified)

---

## [DONE] T-010: Stamina System

| Field | Value |
|-------|-------|
| **Category** | Player |
| **Work Type** | `gameplay` |
| **Priority** | P1 |
| **Depends On** | T-009 |
| **Target Files** | `src/player/PlayerStats.ts` |
| **Description** | Implement PlayerStats class with HP (100), Stamina (100), heal charges (3). Stamina drains on actions (dodge: 20, light attack: 12, heavy attack: 25, sprint: 3/s). Stamina regens at 25/s after 400ms pause. Exhaustion state at 0 stamina: walk speed drops to 3 m/s, cannot dodge/attack/sprint until stamina reaches 20. Expose current values and events for UI. |
| **Acceptance Criteria** | Stamina decreases on actions. Regen starts after 400ms delay. Exhaustion state triggers at 0. Exhaustion clears at 20. HP and heal charges track correctly. |
| **Verification** | Unit test: drain stamina to 0, verify exhaustion flag. Wait 400ms, verify regen begins. |

**Implementation Notes:**
- Created `src/player/PlayerStats.ts` — tracks HP (100), Stamina (100), heal charges (3) with getters for all values
- Stamina costs: dodge (20), light_attack (12), heavy_attack (25), sprint (3/s continuous)
- `canPerformAction(action)` gates discrete actions; `canSprint()` gates sprinting
- `drainStamina(action)` for discrete costs, `drainStaminaContinuous(rate, dt)` for sprint
- Regen: 25/s after 400ms delay (`_regenTimer` resets on any drain). `update(dt)` handles regen tick
- Exhaustion: triggers at stamina ≤ 0, clears at ≥ 20. When exhausted: walk speed forced to 3 m/s, dodge/attack/sprint blocked
- Healing: 40 HP per charge, blocked at full HP or 0 charges
- Integrated into `PlayerStateMachine` — `checkActionTransitions()` now gates on `stats.canPerformAction()` and drains stamina on transition
- Integrated into `PlayerController.update(dt, stats?)` — sprint drains stamina continuously, exhaustion overrides speed
- Wired into `Game.ts` — `PlayerStats` instance created and passed to state machine; `stats.update(dt)` called each frame
- **Files changed:** `src/player/PlayerStats.ts` (new), `src/player/PlayerStateMachine.ts` (modified), `src/player/PlayerController.ts` (modified), `src/app/Game.ts` (modified)

---

## [DONE] T-011: Cel-Shading Pipeline

| Field | Value |
|-------|-------|
| **Category** | Rendering |
| **Work Type** | `rendering` |
| **Priority** | P1 |
| **Depends On** | T-002 |
| **Target Files** | `src/rendering/CelShadingPipeline.ts`, `src/shaders/celVertex.ts`, `src/shaders/celFragment.ts` |
| **Description** | Create a custom ShaderMaterial that implements cel-shading. Use a 4-step toon ramp (shadow, mid, light, highlight). Pass in a single directional light direction. Output flat color bands with hard edges. Create a material factory function: `createCelMaterial(baseColor: Color)`. Apply to player mesh and test cube. |
| **Acceptance Criteria** | Objects render with visible cel-shading bands. Shadow edges are hard (not smooth gradients). Material factory produces consistent results for any input color. Works with Three.js scene lighting. |
| **Verification** | Visual inspection: objects should look like they have cartoon-style shading with distinct light/dark bands. |

**Implementation Notes:**
- Created `src/shaders/celVertex.ts` — passes world-space normal and position to fragment shader via varyings
- Created `src/shaders/celFragment.ts` — 4-step toon ramp based on NdotL: highlight (>0.6, 1.1x), light (>0.2, 0.85x), mid (>-0.1, 0.6x), shadow (0.35x). Hard `if` thresholds produce flat color bands with no gradient blending
- Created `src/rendering/CelShadingPipeline.ts` — `createCelMaterial(baseColor, lightDirection?)` factory returns a `ShaderMaterial` with uniforms for base color, light direction (default top-right-front), and ambient color
- Applied cel materials to test cube in `Game.ts` and player icosahedron in `PlayerModel.ts`, replacing `MeshBasicMaterial`
- TypeScript compiles clean, no console errors
- **Files changed:** `src/shaders/celVertex.ts` (new), `src/shaders/celFragment.ts` (new), `src/rendering/CelShadingPipeline.ts` (new), `src/app/Game.ts` (modified), `src/player/PlayerModel.ts` (modified)

---

## [DONE] T-012: Outline Post-Processing

| Field | Value |
|-------|-------|
| **Category** | Rendering |
| **Work Type** | `rendering` |
| **Priority** | P1 |
| **Depends On** | T-011 |
| **Target Files** | `src/rendering/PostProcessing.ts`, `src/shaders/outlineVertex.ts`, `src/shaders/outlineFragment.ts` |
| **Description** | Add an outline pass using Three.js EffectComposer. Use edge detection on depth/normal buffer to draw black outlines on all geometry. Outline width: 2px (configurable). Set up EffectComposer pipeline: render pass → outline pass → output. |
| **Acceptance Criteria** | All objects have visible black outlines. Outlines follow object silhouettes. Outline width is consistent regardless of distance (screen-space). Performance impact < 2ms per frame. |
| **Verification** | Visual inspection. Toggle outline pass on/off via debug key to confirm it's working. |

**Implementation Notes:**
- Created `src/shaders/outlineVertex.ts` — fullscreen quad vertex shader passing UVs
- Created `src/shaders/outlineFragment.ts` — Sobel-like edge detection on depth (linearized, normalized by center depth for distance-independence) and normals (dot-product difference). Thresholds: depth 0.15, normal 0.5. Hard `step()` produces clean black outlines
- Created `src/rendering/PostProcessing.ts` — EffectComposer pipeline: RenderPass → custom ShaderPass (outline) → OutputPass. Renders depth and normals to separate `WebGLRenderTarget`s each frame using `scene.overrideMaterial` with `MeshDepthMaterial` and `MeshNormalMaterial`. Texture refs set after ShaderPass construction to avoid Three.js uniform clone issues with render target textures
- Outline width: 2px (configurable via `setOutlineWidth()`). Screen-space consistent regardless of object distance
- Toggle with 'O' key: logs state to console, falls back to direct `renderer.render()` when disabled
- Integrated into `Game.ts`: PostProcessing created after all scene objects, `render()` delegates to PostProcessing, resize updates PostProcessing, dispose cleans up
- TypeScript compiles clean, no console errors
- **Files changed:** `src/shaders/outlineVertex.ts` (new), `src/shaders/outlineFragment.ts` (new), `src/rendering/PostProcessing.ts` (new), `src/app/Game.ts` (modified)

---

## [DONE] T-013: Ground Plane and Test Arena

| Field | Value |
|-------|-------|
| **Category** | World |
| **Work Type** | `world` |
| **Priority** | P0 |
| **Depends On** | T-002, T-011 |
| **Target Files** | `src/world/RoomModule.ts` |
| **Description** | Create a simple test arena: flat ground plane (20m x 20m), 4 walls (box geometry, 3m tall), grey floor with subtle grid pattern. This is the development test room — not a final game room. Apply cel-shading materials. Add a directional light and ambient light for the cel-shading to work with. |
| **Acceptance Criteria** | A flat enclosed arena is visible. Player can move around in it. Walls are solid visual barriers. Cel-shading looks correct on floor and walls. |
| **Verification** | Visual inspection. Walk around the arena. |

**Implementation Notes:**
- Created `src/world/RoomModule.ts` — `TestArena` class builds a 20x20m arena with `PlaneGeometry` floor and 4 `BoxGeometry` walls (3m tall, 0.4m thick)
- All geometry uses `createCelMaterial()` — floor in dark grey (#3a3a3a), walls in slightly lighter blue-grey (#4a4a50). Cel-shading bands visible on all surfaces
- Walls include pre-computed AABB colliders (`WallCollider` interface with min/max `Vector3`) exported for future T-015 collision use
- Added `DirectionalLight` (position 5,10,3) and `AmbientLight` (0x404050, 0.4) to `Game.ts` for cel-shading to work with
- Integrated into `Game.ts`: arena added to scene, disposed on cleanup
- TypeScript compiles clean, Vite build succeeds, no console errors
- **Files changed:** `src/world/RoomModule.ts` (new), `src/app/Game.ts` (modified)

---

## [DONE] T-014: Collision System (AABB)

| Field | Value |
|-------|-------|
| **Category** | Engine |
| **Work Type** | `infrastructure` |
| **Priority** | P0 |
| **Depends On** | T-003 |
| **Target Files** | `src/engine/CollisionSystem.ts` |
| **Description** | Implement AABB (axis-aligned bounding box) and sphere collision detection. Functions: `testAABBvsAABB(a, b)`, `testSphereVsSphere(a, b)`, `testSphereVsAABB(sphere, aabb)`. Return collision data: `{ hit: boolean, overlap: Vec3, normal: Vec3 }`. Also implement `resolveCollision(entity, collision)` that pushes the entity out of overlap. |
| **Acceptance Criteria** | AABB vs AABB detects overlaps correctly. Sphere vs AABB detects overlaps correctly. Resolution pushes entities apart along the minimum overlap axis. |
| **Verification** | Unit tests with known overlapping and non-overlapping shapes. |

**Implementation Notes:**
- Created `src/engine/CollisionSystem.ts` with interfaces `AABB`, `SphereCollider`, and `CollisionResult`
- `testAABBvsAABB(a, b)` — computes overlap on all 3 axes, returns minimum overlap axis as push-out direction with correct sign based on center-to-center direction
- `testSphereVsSphere(a, b)` — distance check against radius sum, normal points from B to A, handles coincident center edge case
- `testSphereVsAABB(sphere, aabb)` — finds closest point on AABB to sphere center, handles both external contact and sphere-center-inside-AABB cases with minimum-axis push-out
- `resolveCollision(entityPosition, collision)` — adds overlap vector to entity position to push it out
- All functions use pre-allocated scratch vectors (`_overlap`, `_normal`, `_closest`, `_diff`) and clone only for results to avoid per-call allocation in hot path
- TypeScript compiles clean, Vite build succeeds
- **Files changed:** `src/engine/CollisionSystem.ts` (new)

---

## T-015: Player-Wall Collision

| Field | Value |
|-------|-------|
| **Category** | Player |
| **Work Type** | `gameplay` |
| **Priority** | P0 |
| **Depends On** | T-008, T-013, T-014 |
| **Target Files** | `src/player/PlayerController.ts`, `src/engine/CollisionSystem.ts` |
| **Description** | Add collision between player and arena walls. Player has a sphere collider (radius 0.5m). Walls have AABB colliders. Each frame after movement, test player sphere vs wall AABBs and resolve overlaps. Player should slide along walls, not stop dead. |
| **Acceptance Criteria** | Player cannot walk through walls. Player slides along walls when moving at an angle. No jittering at wall boundaries. |
| **Verification** | Walk into walls from various angles. Confirm slide behavior and no pass-through. |

---

## T-016: Dodge Implementation

| Field | Value |
|-------|-------|
| **Category** | Player |
| **Work Type** | `gameplay` |
| **Priority** | P1 |
| **Depends On** | T-009, T-010 |
| **Target Files** | `src/player/PlayerStateMachine.ts` |
| **Description** | Implement the dodge state fully. On dodge input (if stamina ≥ 20): enter dodge state, move player 4m over 300ms in input direction (or backward if no direction). I-frames active from 50ms to 250ms. After dodge, 100ms recovery before next action. Consume 20 stamina on dodge start. Player mesh flashes translucent during i-frames. |
| **Acceptance Criteria** | Dodge moves player 4m in input direction. Stamina is consumed. I-frame window exists (testable via flag). Visual feedback during dodge (translucency). Cannot dodge without sufficient stamina. |
| **Verification** | Dodge in different directions, verify distance. Drain stamina, verify dodge is blocked. |

---

## T-017: Light Attack Implementation

| Field | Value |
|-------|-------|
| **Category** | Combat |
| **Work Type** | `gameplay` |
| **Priority** | P1 |
| **Depends On** | T-009, T-010 |
| **Target Files** | `src/player/PlayerStateMachine.ts`, `src/combat/WeaponSystem.ts` |
| **Description** | Implement light attack state. On attack input: enter light_attack state. Play attack animation (for now: scale player mesh X axis briefly to simulate swing). Attack has phases: telegraph (100ms), active (150ms), recovery (200ms). During active phase, create a hitbox (arc: 2.5m radius, 120° angle, in front of player). Consume 12 stamina. Support 2-hit combo: pressing attack during recovery window (last 100ms of recovery) queues second hit. |
| **Acceptance Criteria** | Attack state activates on input. Hitbox appears during active window only. Combo chains on timed input. Stamina consumed per attack. Attack has visible feedback (mesh deformation or other). |
| **Verification** | Attack, verify hitbox timing via debug visualization. Combo by pressing attack during window. |

---

## T-018: Hitbox/Hurtbox System

| Field | Value |
|-------|-------|
| **Category** | Combat |
| **Work Type** | `gameplay` |
| **Priority** | P1 |
| **Depends On** | T-014 |
| **Target Files** | `src/combat/HitboxManager.ts` |
| **Description** | Implement HitboxManager. Hitboxes are temporary collision volumes with: owner ID, attack data, attack instance ID, shape (sphere or AABB), active flag. Hurtboxes are persistent collision volumes on damageable entities. Each frame: iterate active hitboxes against all hurtboxes. On overlap: register hit (once per attack instance per target). Emit hit event with attacker, defender, attack data. |
| **Acceptance Criteria** | Hitboxes can be created and activated/deactivated. Overlap detection works. Hits register once per attack instance per target (no double-hits). Hit events fire with correct data. |
| **Verification** | Unit test: create hitbox overlapping hurtbox, verify single hit event. Create non-overlapping, verify no hit. |

---

## T-019: Damage Calculator

| Field | Value |
|-------|-------|
| **Category** | Combat |
| **Work Type** | `gameplay` |
| **Priority** | P1 |
| **Depends On** | T-018 |
| **Target Files** | `src/combat/DamageCalculator.ts`, `src/combat/CombatSystem.ts` |
| **Description** | Implement DamageCalculator with function: `calculate(attackData, attackerStats, defenderStats) → { damage: number, staggerDamage: number, isCritical: boolean }`. Base formula: `damage = attackData.damage * weaponMultiplier`. No defense reduction for now (add later). CombatSystem ties it together: on hit event → calculate damage → apply to defender HP → check death → emit damage/death events. |
| **Acceptance Criteria** | Damage is calculated correctly from attack data. HP is reduced on the defender. Death triggers at HP ≤ 0. Events emitted for damage and death. |
| **Verification** | Unit test: known attack data → expected damage output. Integration: hit enemy → HP decreases → at 0 death event fires. |

---

## T-020: Base Enemy Class

| Field | Value |
|-------|-------|
| **Category** | Enemy |
| **Work Type** | `gameplay` |
| **Priority** | P1 |
| **Depends On** | T-009, T-014, T-018 |
| **Target Files** | `src/enemies/BaseEnemy.ts` |
| **Description** | Create abstract BaseEnemy class. Owns: Three.js mesh, FSM instance, stats (HP, speed, poise), hurtbox, current position/rotation. Methods: `update(dt)`, `takeDamage(amount)`, `die()`, `getPosition()`. On takeDamage: reduce HP, check poise for stagger, flash mesh red briefly. On die: emit ENEMY_DIED event, play death effect (mesh shatters into particles), remove from scene after delay. |
| **Acceptance Criteria** | BaseEnemy can be instantiated (via subclass). Has working HP and damage reception. Death triggers cleanup. Stagger check against poise works. Visual feedback on hit (red flash). |
| **Verification** | Spawn a test enemy, hit it, verify HP decreases. Kill it, verify cleanup and event. |

---

## T-021: Enemy Factory and Registry

| Field | Value |
|-------|-------|
| **Category** | Enemy |
| **Work Type** | `data` |
| **Priority** | P1 |
| **Depends On** | T-020 |
| **Target Files** | `src/enemies/EnemyFactory.ts`, `src/enemies/EnemyRegistry.ts` |
| **Description** | EnemyRegistry maps string type IDs to enemy class constructors. EnemyFactory takes an enemy type ID + spawn position, loads the corresponding JSON data from `data/enemies/`, creates an instance of the correct class, initializes it with data, and returns it. Support lazy loading of enemy data. |
| **Acceptance Criteria** | `EnemyFactory.create("triangle-shard", position)` returns a fully initialized Triangle Shard enemy at the given position. Registry correctly resolves type IDs to classes. Missing type ID throws descriptive error. |
| **Verification** | Call factory with known type ID, verify returned enemy has correct stats from JSON data. |

---

## T-022: Triangle Shard Enemy

| Field | Value |
|-------|-------|
| **Category** | Enemy |
| **Work Type** | `gameplay` |
| **Priority** | P1 |
| **Depends On** | T-020, T-021, T-009 |
| **Target Files** | `src/enemies/TriangleShard.ts`, `data/enemies/triangle-shard.json` |
| **Description** | Implement the Triangle Shard enemy per ENEMY_BIBLE.md. Mesh: flat triangle (ConeGeometry with 3 segments, flattened). FSM states: idle (wait), chase (move toward player), attack (lunge or slash), staggered. Lunge: telegraph 400ms (glow red), dash forward 4m, recovery 600ms. Slash: telegraph 300ms, 90° sweep, recovery 400ms. 30 HP. Move speed 6 m/s. |
| **Acceptance Criteria** | Triangle Shard spawns with correct mesh. Aggros on player proximity. Chases player. Attacks when in range with correct telegraphs and timing. Takes damage and dies. Drops shards on death. |
| **Verification** | Spawn in test arena, walk near it, observe chase → attack → telegraph → hit detection cycle. Kill it, verify death effect and shard drop. |

---

## T-023: Cube Sentinel Enemy

| Field | Value |
|-------|-------|
| **Category** | Enemy |
| **Work Type** | `gameplay` |
| **Priority** | P2 |
| **Depends On** | T-020, T-021, T-009 |
| **Target Files** | `src/enemies/CubeSentinel.ts`, `data/enemies/cube-sentinel.json`, `src/engine/ObjectPool.ts` |
| **Description** | Implement the Cube Sentinel per ENEMY_BIBLE.md. Mesh: BoxGeometry 1.2m. Rotates slowly on Y-axis. FSM: idle, alert (face player), attack (fire projectile), retreat (if player too close). Shard Bolt: 500ms telegraph, fires cube projectile at 10m/s. Scatter Shot: 700ms telegraph, fires 3 bolts in spread. Projectiles use ObjectPool. 25 HP. Retreats if player < 4m. |
| **Acceptance Criteria** | Cube Sentinel spawns, maintains distance, fires projectiles at player. Retreats when player closes in. Projectiles travel in correct direction at correct speed. Projectiles despawn after lifetime. |
| **Verification** | Spawn in test arena. Approach and observe retreat. Stand at range and observe projectile attacks. |

---

## T-024: Data Loader

| Field | Value |
|-------|-------|
| **Category** | Engine |
| **Work Type** | `infrastructure` |
| **Priority** | P0 |
| **Depends On** | T-001 |
| **Target Files** | `src/engine/AssetLoader.ts` |
| **Description** | Create AssetLoader class with methods: `loadJSON<T>(path): Promise<T>`, `loadGLTF(path): Promise<Group>`, `loadTexture(path): Promise<Texture>`, `loadAudio(path): Promise<AudioBuffer>`. Include loading progress tracking. Cache loaded assets to avoid double-loading. Handle errors gracefully with descriptive messages. |
| **Acceptance Criteria** | JSON files load and parse correctly with type safety. GLTF models load into Three.js Groups. Texture loading works. Caching prevents duplicate loads. Errors produce clear messages. |
| **Verification** | Load `data/enemies/triangle-shard.json`, verify parsed data matches file. Load same file twice, verify cache hit. |

---

## T-025: HUD (Health, Stamina, Shards)

| Field | Value |
|-------|-------|
| **Category** | UI |
| **Work Type** | `UI` |
| **Priority** | P1 |
| **Depends On** | T-004, T-010 |
| **Target Files** | `src/ui/HUD.ts`, `src/ui/UIManager.ts` |
| **Description** | Create HTML/CSS overlay HUD. Elements: HP bar (red, top-left), Stamina bar (green, below HP), Shard count (number, top-right), Heal charges (icons, below HP bar). Bars animate smoothly on value change (CSS transitions). Subscribe to EventBus for updates. UIManager controls HUD visibility (show during gameplay, hide in menus). |
| **Acceptance Criteria** | HP bar reflects current HP with smooth animation. Stamina bar reflects current stamina. Shard count updates on collection. Heal charges display correctly. HUD can be shown/hidden. |
| **Verification** | Take damage, verify HP bar decreases smoothly. Use stamina, verify bar changes. Collect shard, verify count updates. |

---

## T-026: Debug Overlay

| Field | Value |
|-------|-------|
| **Category** | Debug |
| **Work Type** | `tooling` |
| **Priority** | P1 |
| **Depends On** | T-003 |
| **Target Files** | `src/utils/debug.ts` |
| **Description** | Create debug overlay toggled by F1. Display: FPS counter, player state name, player position, active enemy count, draw call count (renderer.info.render.calls). Add hitbox/hurtbox wireframe visualization (colored wireframe boxes/spheres shown when debug is active). God mode toggle (F2): invincibility. Instant kill toggle (F3): one-shot enemies. |
| **Acceptance Criteria** | F1 toggles debug overlay. FPS is accurate. Player state and position update in real-time. Hitbox wireframes visible during attacks. God mode and instant kill toggles work. |
| **Verification** | Toggle F1, verify info displays. Attack, verify hitbox wireframes appear during active window. Toggle god mode, verify no damage taken. |

---

## T-027: Room Assembler (Basic)

| Field | Value |
|-------|-------|
| **Category** | World |
| **Work Type** | `world` |
| **Priority** | P1 |
| **Depends On** | T-013, T-024 |
| **Target Files** | `src/world/RoomAssembler.ts`, `src/world/RoomModule.ts` |
| **Description** | Implement RoomAssembler that reads a RoomModuleData JSON and constructs a Three.js scene graph from it. Create floor plane, walls, place spawn point markers (debug spheres), place exit door markers. Doors are initially locked (visual: red glow). RoomModule class holds reference to scene objects and provides `getSpawnPoints()`, `getExits()`, `unlockExits()`. |
| **Acceptance Criteria** | Loading `atrium-room-square.json` produces a visible room with correct dimensions. Spawn points are accessible. Exits are visible and start locked. `unlockExits()` changes door visual to green. |
| **Verification** | Load room data, verify room appears in scene with correct geometry. Call unlockExits(), verify visual change. |

---

## T-028: Encounter Manager

| Field | Value |
|-------|-------|
| **Category** | World |
| **Work Type** | `world` |
| **Priority** | P1 |
| **Depends On** | T-021, T-027 |
| **Target Files** | `src/world/EncounterManager.ts` |
| **Description** | Implement EncounterManager. On room entry: load encounter data, spawn wave 0 enemies at specified spawn points via EnemyFactory. Track alive enemy count. When wave is cleared, wait `delay` ms, then spawn next wave. When all waves cleared, emit `ROOM_CLEARED` event. Support encounter data schema from DATA_SCHEMAS.md. |
| **Acceptance Criteria** | Entering a room with encounter data spawns enemies at correct positions. Killing all enemies in a wave triggers next wave after delay. Clearing all waves emits ROOM_CLEARED. |
| **Verification** | Load room + encounter, kill all enemies, verify ROOM_CLEARED event fires and doors unlock. |

---

## T-029: Door System

| Field | Value |
|-------|-------|
| **Category** | World |
| **Work Type** | `world` |
| **Priority** | P2 |
| **Depends On** | T-027, T-028 |
| **Target Files** | `src/world/DoorSystem.ts` |
| **Description** | Implement door transitions between rooms. Doors start locked (red). On ROOM_CLEARED, doors unlock (green). Player approaching unlocked door + interact input triggers room transition. Transition: fade to black (500ms), unload current room, load next room, place player at entry, fade in (500ms). |
| **Acceptance Criteria** | Doors lock/unlock based on encounter state. Player can interact with unlocked doors. Room transition loads new room and repositions player. Fade transition is smooth. |
| **Verification** | Clear room, approach door, interact, verify new room loads with player at entry position. |

---

## T-030: Zone Generator (Linear)

| Field | Value |
|-------|-------|
| **Category** | World |
| **Work Type** | `world` |
| **Priority** | P2 |
| **Depends On** | T-027, T-029 |
| **Target Files** | `src/world/ZoneGenerator.ts`, `src/levels/Zone1Config.ts`, `src/levels/ZoneRegistry.ts` |
| **Description** | Implement ZoneGenerator that creates a linear sequence of 5–6 rooms from a zone's room pool. Zone1Config defines: room pool (IDs), encounter pool (IDs), difficulty curve (array of difficulty values per room index). Generator selects rooms and encounters that match difficulty at each position. Output: ordered list of `{roomId, encounterId}` pairs. |
| **Acceptance Criteria** | ZoneGenerator produces a valid room sequence for Zone 1. Difficulty increases through the sequence. Room and encounter selections are randomized within constraints. |
| **Verification** | Generate multiple zone layouts, verify they differ and respect difficulty curve. |

---

## T-031: Stagger System

| Field | Value |
|-------|-------|
| **Category** | Combat |
| **Work Type** | `gameplay` |
| **Priority** | P1 |
| **Depends On** | T-019, T-020 |
| **Target Files** | `src/combat/StaggerSystem.ts` |
| **Description** | Implement poise-based stagger. Every damageable entity has poise (current/max). Attacks deal stagger damage (separate from HP damage). When poise reaches 0: entity enters staggered state for configured duration. Poise regens after a delay. Player and enemies both use this system. On player stagger: brief inability to act. On enemy stagger: vulnerable window. |
| **Acceptance Criteria** | Hitting an enemy reduces their poise. At 0 poise, enemy enters staggered state. Poise regens after delay. Player poise works identically. Stagger duration matches config. |
| **Verification** | Hit enemy repeatedly, verify stagger triggers at threshold. Verify poise regens after delay. |

---

## T-032: Damage Numbers UI

| Field | Value |
|-------|-------|
| **Category** | UI |
| **Work Type** | `polish` |
| **Priority** | P2 |
| **Depends On** | T-019, T-025 |
| **Target Files** | `src/ui/DamageNumbers.ts` |
| **Description** | On ENEMY_DAMAGED event, display floating damage number at enemy world position projected to screen. Number rises and fades over 800ms. Use CSS animations for float + fade. Color: white for normal, yellow for critical, red for player damage. Pool DOM elements to avoid allocation per hit. |
| **Acceptance Criteria** | Hitting an enemy shows a floating number. Number matches actual damage dealt. Animation is smooth (rise + fade). Numbers are pooled (no new DOM elements created mid-combat). |
| **Verification** | Hit enemy, verify number appears at correct position with correct value. Hit rapidly, verify no performance degradation. |

---

## T-033: Camera Lock-On

| Field | Value |
|-------|-------|
| **Category** | Camera |
| **Work Type** | `gameplay` |
| **Priority** | P1 |
| **Depends On** | T-007 |
| **Target Files** | `src/camera/LockOnSystem.ts`, `src/camera/CameraController.ts` |
| **Description** | Implement lock-on targeting. On lock-on input: find nearest enemy within 15m and forward cone. Camera focuses between player and target. Player movement becomes strafe-relative. Attacks auto-orient toward locked target. Target indicator visible on locked enemy (UI marker). Target switching: flick right stick / directional input while locked. Lock-on drops if target dies or exits 15m range. |
| **Acceptance Criteria** | Lock-on acquires nearest valid target. Camera shifts to player-target midpoint focus. Movement becomes strafe. Target switching works. Lock drops on target death or out of range. |
| **Verification** | Spawn 2 enemies, lock on, verify camera behavior. Switch targets. Kill target, verify lock drops. |

---

## T-034: Camera Shake

| Field | Value |
|-------|-------|
| **Category** | Camera |
| **Work Type** | `polish` |
| **Priority** | P2 |
| **Depends On** | T-007, T-004 |
| **Target Files** | `src/camera/CameraShake.ts` |
| **Description** | On PLAYER_DAMAGED event, apply camera shake. Shake is an additive random offset to camera position that decays over time. Parameters: intensity (pixels), duration (ms), decay rate. Light hit: intensity 3, duration 200ms. Heavy hit: intensity 8, duration 400ms. Use perlin noise or random for offset direction. |
| **Acceptance Criteria** | Camera shakes on player damage. Shake intensity varies by damage amount. Shake decays smoothly. Does not interfere with normal camera operation after decay. |
| **Verification** | Take damage, verify visible shake. Verify shake stops after duration. |

---

## T-035: Pickup System

| Field | Value |
|-------|-------|
| **Category** | Interactions |
| **Work Type** | `gameplay` |
| **Priority** | P2 |
| **Depends On** | T-004, T-020 |
| **Target Files** | `src/interactions/PickupSystem.ts`, `src/interactions/Interactable.ts` |
| **Description** | When enemies die, they drop shard pickups (small glowing geometric shapes). Pickups float and rotate. Player auto-collects pickups within 2m radius. On collection: add shards to RunState, emit event, play collection particle effect. Shard count from enemy data (random between min and max). |
| **Acceptance Criteria** | Killing enemy spawns shard pickup at death position. Pickup is visible and animated. Player auto-collects when within range. RunState shard count increases. Collection has visual/audio feedback. |
| **Verification** | Kill enemy, walk over shard, verify collection and shard count increase on HUD. |

---

## T-036: Run State Manager

| Field | Value |
|-------|-------|
| **Category** | Progression |
| **Work Type** | `meta` |
| **Priority** | P1 |
| **Depends On** | T-004 |
| **Target Files** | `src/progression/RunState.ts` |
| **Description** | Implement RunState singleton that tracks: current zone, current room index, total shards collected, equipped weapon ID, active buffs, heal charges remaining, rooms cleared count, enemies killed count. Provides `startRun()` (reset all), `endRun()` (calculate rewards: 50% shards kept as meta-currency). Emits RUN_STARTED and RUN_ENDED events. |
| **Acceptance Criteria** | RunState correctly tracks all run variables. startRun resets state. endRun calculates rewards. Events fire correctly. |
| **Verification** | Start run, modify state values, end run, verify reward calculation. |

---

## T-037: Death Screen

| Field | Value |
|-------|-------|
| **Category** | UI |
| **Work Type** | `UI` |
| **Priority** | P2 |
| **Depends On** | T-025, T-036 |
| **Target Files** | `src/ui/MenuSystem.ts` |
| **Description** | On PLAYER_DIED event: show death screen overlay. Display: "Collapsed" text, rooms cleared, enemies killed, shards collected, shards kept (50%). "Return to Hub" button that triggers run end and reloads hub state. Fade in over 500ms. |
| **Acceptance Criteria** | Death triggers death screen. Stats are accurate. Return button works. Visual is clean and themed (dark, minimal, geometric). |
| **Verification** | Die in game, verify death screen shows with correct stats. Click return, verify run ends. |

---

## T-038: Particle System (Geometric)

| Field | Value |
|-------|-------|
| **Category** | Rendering |
| **Work Type** | `polish` |
| **Priority** | P2 |
| **Depends On** | T-002 |
| **Target Files** | `src/rendering/ParticleSystem.ts` |
| **Description** | Create a geometric particle emitter. Particles are small triangles/squares/lines (not point sprites). Support: position, velocity, lifetime, size, color, rotation. Object-pooled. Presets: `enemyDeath` (burst of fragments outward), `playerHit` (red sparks), `shardCollect` (upward dissolve). Max 100 particles active. |
| **Acceptance Criteria** | Particles emit at specified position with correct properties. Particles are geometric shapes (not circles). Particles are pooled (no allocation during gameplay). Each preset produces visually distinct effect. |
| **Verification** | Trigger each preset, verify visual effect. Run for 60s with continuous particles, verify no frame drops. |

---

## T-039: Parry System

| Field | Value |
|-------|-------|
| **Category** | Combat |
| **Work Type** | `gameplay` |
| **Priority** | P2 |
| **Depends On** | T-018, T-009, T-010 |
| **Target Files** | `src/player/PlayerStateMachine.ts`, `src/combat/CombatSystem.ts` |
| **Description** | Implement parry mechanic. On parry input: 150ms window where incoming attacks are deflected. Successful parry: attacker staggers 1s, player recovers 10 stamina, next player attack deals 1.5x damage (buff lasts 3s). Failed parry (hit outside window): player takes full damage + 200ms extra stagger. Consume 8 stamina on attempt. Visual: bright flash on successful parry. |
| **Acceptance Criteria** | Parry window is 150ms. Successful parry staggers attacker and grants damage buff. Failed parry penalizes player. Stamina cost applies regardless. Visual feedback is clear. |
| **Verification** | Time parry against Triangle Shard lunge. Verify successful parry staggers enemy. Miss timing, verify extra stagger. |

---

## T-040: Heavy Attack

| Field | Value |
|-------|-------|
| **Category** | Combat |
| **Work Type** | `gameplay` |
| **Priority** | P2 |
| **Depends On** | T-017 |
| **Target Files** | `src/player/PlayerStateMachine.ts`, `src/combat/WeaponSystem.ts` |
| **Description** | Implement heavy attack. Hold attack button to charge (300ms minimum, 800ms max). Release to attack. Damage scales with charge time (1.5x at min charge, 2.0x at max charge). Longer telegraph and recovery than light attack. Hitbox: same as weapon but +50% stagger damage. 25 stamina cost. Player is slowed to 2 m/s while charging. |
| **Acceptance Criteria** | Holding attack button begins charge state. Release fires heavy attack. Damage scales with charge time. Movement is slowed while charging. Hitbox and stagger damage are correct. |
| **Verification** | Charge minimum, verify 1.5x damage. Charge maximum, verify 2.0x. Verify movement slow during charge. |

---

## T-041: Healing Implementation

| Field | Value |
|-------|-------|
| **Category** | Player |
| **Work Type** | `gameplay` |
| **Priority** | P2 |
| **Depends On** | T-009, T-010 |
| **Target Files** | `src/player/PlayerStateMachine.ts`, `src/player/PlayerStats.ts` |
| **Description** | Implement heal action. On heal input (if charges > 0): enter heal state. 800ms animation. Heal 35 HP at animation end. If damaged during animation, heal is cancelled (charge NOT consumed). Consume charge only on successful heal. Visual: brief green glow on player. Cannot heal at full HP. |
| **Acceptance Criteria** | Healing restores 35 HP after 800ms. Interrupting heal preserves charge. Charges decrease on success. Cannot heal at full HP. Visual feedback. |
| **Verification** | Take damage, heal, verify HP restored and charge consumed. Start heal, take hit, verify charge NOT consumed. |

---

## T-042: Save System

| Field | Value |
|-------|-------|
| **Category** | Save |
| **Work Type** | `meta` |
| **Priority** | P2 |
| **Depends On** | T-036 |
| **Target Files** | `src/save/SaveManager.ts`, `src/save/SaveSchema.ts` |
| **Description** | Implement localStorage-based save system. SaveSchema defines shape: `{ version: number, metaCurrency: number, unlocks: string[], settings: {...}, bestRun: {...} }`. SaveManager provides: `save(data)`, `load(): SaveData`, `reset()`. Version field enables future migrations. Auto-save on run end. Load on game start. |
| **Acceptance Criteria** | Data persists across browser sessions. Schema is validated on load. Corrupted data is handled gracefully (reset to defaults). Version migration path exists. |
| **Verification** | Save data, reload page, verify data persists. Corrupt localStorage manually, verify graceful fallback. |

---

## T-043: Object Pool

| Field | Value |
|-------|-------|
| **Category** | Engine |
| **Work Type** | `infrastructure` |
| **Priority** | P1 |
| **Depends On** | T-001 |
| **Target Files** | `src/engine/ObjectPool.ts` |
| **Description** | Implement generic object pool. `ObjectPool<T>` with `get(): T`, `release(item: T)`, `preWarm(count)`. Constructor takes a factory function and reset function. Use for: projectiles, particles, damage numbers, pickups. Pre-warm pools at scene start to avoid runtime allocation. |
| **Acceptance Criteria** | Pool returns existing objects when available. Creates new objects when pool is empty. Released objects are reused. Pre-warm creates specified count upfront. |
| **Verification** | Unit test: get/release cycle. Verify same object is returned after release. Verify pre-warm count. |

---

## T-044: Math Utilities

| Field | Value |
|-------|-------|
| **Category** | Utils |
| **Work Type** | `infrastructure` |
| **Priority** | P0 |
| **Depends On** | None |
| **Target Files** | `src/utils/math.ts`, `src/utils/timer.ts`, `src/utils/constants.ts` |
| **Description** | Create utility functions. math.ts: `lerp(a, b, t)`, `clamp(value, min, max)`, `randomRange(min, max)`, `randomInt(min, max)`, `degToRad(deg)`, `radToDeg(rad)`, `distanceVec3(a, b)`, `lerpVec3(a, b, t)`. timer.ts: `CooldownTimer` class with `start(duration)`, `update(dt)`, `isReady()`, `reset()`. constants.ts: `FIXED_TIMESTEP`, `PLAYER_WALK_SPEED`, `PLAYER_SPRINT_SPEED`, etc. |
| **Acceptance Criteria** | All math functions produce correct results. CooldownTimer counts down and reports ready correctly. Constants are exported and typed. |
| **Verification** | Unit tests for all math functions and CooldownTimer. |

---

## T-045: Game Config

| Field | Value |
|-------|-------|
| **Category** | Config |
| **Work Type** | `infrastructure` |
| **Priority** | P0 |
| **Depends On** | None |
| **Target Files** | `src/config/gameConfig.ts`, `src/config/renderConfig.ts` |
| **Description** | Create centralized configuration files. gameConfig.ts: all gameplay tuning values (player speeds, damage values, stamina costs, timing windows, etc.) as a typed const object. renderConfig.ts: resolution scale, shadow quality, outline width, post-processing toggles. All values referenced by systems instead of hardcoded numbers. |
| **Acceptance Criteria** | All tuning values are in config files. No magic numbers in gameplay code. Config values are typed and documented. Changing a config value changes gameplay behavior without code changes. |
| **Verification** | Change a config value (e.g., walk speed), verify the game reflects the change. |

---

## Task Dependency Graph (Simplified)

```
T-044, T-045 ─────────────────────────────────────┐
T-001 → T-002 → T-003 ─────────────────────────── │
  │       │       │                                │
  │       │       └─── T-007 ─── T-033, T-034      │
  │       │                                        │
  │       └───── T-006 ─── T-008 ── T-015          │
  │       │       │                                │
  │       └───── T-011 ── T-012                    │
  │       │       │                                │
  │       └───── T-013 ─── T-027 ── T-028 ── T-029 ── T-030
  │                                                │
  ├── T-004 ─── T-025, T-034, T-035, T-036        │
  │                                                │
  ├── T-005 ─── T-007, T-008                       │
  │                                                │
  ├── T-024 ─── T-021, T-027                       │
  │                                                │
  └── T-043 ─── T-023 (projectiles)                │
                                                   │
T-009 ── T-010 ── T-016, T-017 ── T-040           │
  │                  │                             │
  │                  └──── T-039                   │
  │                                                │
  └── T-020 ── T-021 ── T-022, T-023              │
        │                                          │
        └── T-031                                  │
                                                   │
T-014 ── T-015, T-018 ── T-019 ── T-031           │
                    │                              │
                    └── T-032                      │
```

---

## Work Type Distribution Summary

| Work Type | Tasks | Count |
|-----------|-------|-------|
| `infrastructure` | T-001, T-003, T-004, T-005, T-014, T-024, T-043, T-044, T-045 | 9 |
| `gameplay` | T-007, T-008, T-009, T-010, T-015, T-016, T-017, T-018, T-019, T-020, T-022, T-023, T-031, T-033, T-035, T-039, T-040, T-041 | 18 |
| `rendering` | T-002, T-006, T-011, T-012 | 4 |
| `data` | T-021 | 1 |
| `world` | T-013, T-027, T-028, T-029, T-030 | 5 |
| `UI` | T-025, T-037 | 2 |
| `tooling` | T-026 | 1 |
| `polish` | T-032, T-034, T-038 | 3 |
| `meta` | T-036, T-042 | 2 |
