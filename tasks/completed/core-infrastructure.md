# Completed: Core Infrastructure

> Foundation systems — bootstrap, game loop, events, input, collision, asset loading.

---

## T-001: Project Bootstrap
- Initialized Vite + TypeScript + Three.js project with strict mode
- **Files:** `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `index.html`, `src/main.ts`

## T-003: Game Loop with Fixed Timestep
- 60Hz fixed-step update with accumulator pattern, variable render rate
- `Clock` provides deltaTime/elapsed/fixedStep, caps at 250ms to prevent spiral of death
- **Files:** `src/engine/Clock.ts`, `src/app/GameLoop.ts`, `src/app/Game.ts`

## T-004: Event Bus
- Typed event bus using `Map<GameEventName, Set<Callback>>` for O(1) sub/unsub
- Events: `PLAYER_DAMAGED`, `ENEMY_DAMAGED`, `ENEMY_DIED`, `ROOM_CLEARED`, `PLAYER_DIED`, `RUN_STARTED`, `RUN_ENDED`, `SHARD_COLLECTED`
- **Files:** `src/app/EventBus.ts`

## T-005: Input Manager
- Poll-based input with edge detection via queue-then-process pattern
- 13 game actions: WASD movement, Shift sprint, Space dodge, LMB/RMB attacks, Q parry, R heal, Tab lock-on, E interact, Escape pause
- 150ms input buffer for attack queuing (`consumeBuffer`/`hasBuffered`)
- Mouse delta tracking for camera orbit
- **Files:** `src/app/InputManager.ts`

## T-014: Collision System (AABB)
- `testAABBvsAABB`, `testSphereVsSphere`, `testSphereVsAABB` — all return `CollisionResult` with overlap vector and normal
- `resolveCollision` pushes entity out along minimum overlap axis
- Pre-allocated scratch vectors for hot path
- **Files:** `src/engine/CollisionSystem.ts`

## T-024: Data Loader
- `AssetLoader` with `loadJSON<T>`, `loadGLTF`, `loadTexture`, `loadAudio` — all cached
- GLTF returns clones to protect cache. Progress tracking with callback
- **Files:** `src/engine/AssetLoader.ts`
