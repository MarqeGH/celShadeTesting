# Completed: Player & Combat Systems

> Player model, camera, movement, state machine, stamina, attacks, parry, heal, hitbox system, damage, stagger.

---

## T-002: Basic Three.js Scene
- `Game.ts` composition root: Scene, PerspectiveCamera, Renderer, test cube, resize handling
- **Files:** `src/rendering/Renderer.ts`, `src/app/Game.ts`

## T-006: Player Model and Scene Placement
- Icosahedron (radius 0.8, detail 1) with per-frame vertex displacement (flickering instability effect)
- Multi-frequency sin/cos pseudo-noise, strength 0.04. Base positions stored to avoid drift
- **Files:** `src/player/PlayerModel.ts`

## T-007: Third-Person Camera Controller
- Spherical orbit camera. Mouse always controls orbit. Pitch clamped [-10°, 60°]. Distance 8m, height offset 3m
- Smooth follow via `Vector3.lerp` (factor 0.1). Exposes `getYaw()`, `getForward()`, `getRight()`
- **Files:** `src/camera/CameraController.ts`

## T-008: Player Movement Controller
- Camera-relative WASD movement. Walk 5 m/s, sprint 8 m/s
- Smooth mesh rotation via `1 - exp(-speed * dt)` with shortest-arc wrapping
- **Files:** `src/player/PlayerController.ts`

## T-009: Player State Machine
- Generic `StateMachine<TContext>` + `AIState<TContext>` interface (shared with enemies)
- Player states: idle, run, dodge, light_attack, heavy_attack, parry, heal, stagger, dead
- States extracted to `src/player/states/` — one file per state
- **Files:** `src/ai/AIState.ts`, `src/ai/StateMachine.ts`, `src/player/PlayerStateMachine.ts`, `src/player/states/*`

## T-010: Stamina System
- HP 100, Stamina 100, heal charges 3
- Costs: dodge 20, light 12, heavy 25, parry 8, sprint 3/s. Regen 25/s after 400ms delay
- Exhaustion at 0 → walk speed 3 m/s, blocks dodge/attack/sprint until stamina ≥ 20
- **Files:** `src/player/PlayerStats.ts`

## T-015: Player-Wall Collision
- Sphere collider (radius 0.5m) vs wall AABBs. Resolves after movement. Sliding via minimum-axis push
- **Files:** `src/player/PlayerController.ts`

## T-016: Dodge Implementation
- 4m over 300ms in camera-relative input direction (or backward). I-frames 50ms–250ms
- Visual: opacity 0.35 via `uOpacity` uniform during i-frame window. 100ms recovery after movement
- **Files:** `src/player/states/DodgeState.ts`

## T-017: Light Attack Implementation
- Telegraph 100ms → Active 150ms → Recovery 200ms. Arc hitbox: 2.5m radius, 120° angle
- 2-hit combo: LMB during last 100ms of recovery chains second hit. Mesh scale deformation as feedback
- **Files:** `src/player/states/LightAttackState.ts`, `src/combat/WeaponSystem.ts`

## T-018: Hitbox/Hurtbox System
- `HitboxManager`: hitboxes (temporary, per-attack-instance) vs hurtboxes (persistent, per-entity)
- Sphere and AABB shapes. One-hit-per-target via `alreadyHit: Set<number>`. Hit callback system
- **Files:** `src/combat/HitboxManager.ts`

## T-019: Damage Calculator & Combat System
- `calculateDamage(attackData, weaponMultiplier)` — base formula, no defense yet
- `CombatSystem` orchestrates: hit detection → damage calc → HP application → event emission
- `CombatEntity` interface: entityId, type, HP getters, takeDamage, isDead, getPosition
- **Files:** `src/combat/DamageCalculator.ts`, `src/combat/CombatSystem.ts`

## T-031: Stagger System
- `StaggerSystem`: centralized poise tracking. `PoiseConfig` per entity. Regen after configurable delay
- Player poise: 60, 1s delay, 20/s regen. Enemy poise from JSON data
- On poise break → callback fires → FSM enters stagger/staggered state
- **Files:** `src/combat/StaggerSystem.ts`

## T-039: Parry System
- 150ms active window + 200ms recovery. Q key, 8 stamina
- Success: attacker force-staggered, player +10 stamina, 1.5x damage buff for 3s, white flash
- Fail (hit in recovery): full damage + forced stagger
- **Files:** `src/player/states/ParryState.ts`, `src/combat/CombatSystem.ts`

## T-040: Heavy Attack
- Hold RMB: charge 300ms–800ms. Release to swing. Cancel before 300ms (refund stamina)
- Damage scales 1.5x (min) → 2.0x (max charge). 25 stamina. Movement 2 m/s while charging
- Telegraph 250ms → Active 200ms → Recovery 300ms. Y-compression during charge, X-stretch during swing
- **Files:** `src/player/states/HeavyAttackState.ts`

## T-041: Healing Implementation
- R key, 800ms animation. Heals 35 HP at completion. Interrupted → charge preserved
- Visual: green glow via `uBaseColor` override. Blocked at full HP or 0 charges
- **Files:** `src/player/states/HealState.ts`, `src/player/PlayerStats.ts`
