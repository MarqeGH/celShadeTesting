# Completed: Enemy Systems

> BaseEnemy, factory/registry, Triangle Shard, Cube Sentinel.

---

## T-020: Base Enemy Class
- Abstract `BaseEnemy` implementing `CombatEntity`. Owns: mesh, FSM, stats, hurtbox
- `EnemyStats`: maxHp, hp, moveSpeed, turnSpeed, poise, maxPoise, poiseRegenDelay/Rate
- `takeDamage()` → red hit flash (0.12s). `die()` → unregister, emit event, shatter into 8 tetrahedron pieces with gravity
- Poise regen after configurable delay. Helpers: `moveToward()`, `faceDirection()`, `distanceTo()`
- Auto-incrementing entity IDs from 100 (player is 1)
- **Files:** `src/enemies/BaseEnemy.ts`

## T-021: Enemy Factory and Registry
- `EnemyRegistry`: static map of string type IDs → constructor functions
- `EnemyFactory.create(typeId, position, eventBus, hitboxManager)` — async, loads JSON from `data/enemies/`, caches
- `createSync()` for pre-loaded data. `preload()` for batch loading
- **Files:** `src/enemies/EnemyFactory.ts`, `src/enemies/EnemyRegistry.ts`

## T-022: Triangle Shard Enemy
- Flat triangle mesh (ConeGeometry 3 segments, Z-flattened 0.3). Cel-shaded red (#cc4444)
- FSM: idle (aggro 10m) → chase (6 m/s) → attack (lunge/slash random) → cooldown (800ms) → staggered (1s)
- Lunge: 400ms telegraph, 200ms active, 4m dash at 20 m/s, 15 dmg. Slash: 300ms telegraph, 150ms active, 10 dmg
- Telegraph visual: red glow. Hitbox: sphere in front of enemy along locked dash direction
- States extracted to `src/enemies/triangle-shard/states.ts`
- **Files:** `src/enemies/triangle-shard/TriangleShard.ts`, `src/enemies/triangle-shard/states.ts`, `data/enemies/triangle-shard.json`

## T-023: Cube Sentinel Enemy
- BoxGeometry 1.2m cube. Cel-shaded amber (#cc8833). Slow Y-axis rotation in idle
- FSM: idle (aggro 15m) → alert (face player) → attack (projectile) → cooldown (600ms) → retreat (if < 4m) → staggered (800ms)
- Shard Bolt: 500ms telegraph, single projectile 10m/s. Scatter Shot: 700ms telegraph, 3 bolts ±15° spread
- Projectiles: `ObjectPool<Projectile>` (pool 6), spinning cubes with sphere hitboxes, 2s lifetime
- Telegraph: orange glow (face vs all faces for bolt vs scatter)
- States extracted to `src/enemies/cube-sentinel/states.ts`
- **Files:** `src/enemies/cube-sentinel/CubeSentinel.ts`, `src/enemies/cube-sentinel/states.ts`, `src/engine/ObjectPool.ts`, `data/enemies/cube-sentinel.json`
