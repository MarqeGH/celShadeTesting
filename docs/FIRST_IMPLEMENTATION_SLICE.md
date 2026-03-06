# First Implementation Slice

> The smallest playable vertical slice that proves the core loop works.

---

## Goal

**One room. One enemy type. One weapon. Fight, kill, die, retry.**

The player spawns in a single enclosed arena, fights 3 Triangle Shards, can die and restart. No room transitions, no progression, no meta-loop. Just the combat core.

---

## Exact Systems Included

| System | Scope |
|--------|-------|
| **Bootstrap** | Vite + Three.js + TypeScript running |
| **Render pipeline** | Cel-shading materials on all objects. No outline pass yet. |
| **Game loop** | Fixed 60Hz update, variable render |
| **Input** | WASD + mouse + dodge/attack/heal keys |
| **Player model** | Flickering icosahedron |
| **Player movement** | Camera-relative WASD, sprint |
| **Player state machine** | idle, run, dodge, light_attack, stagger, dead |
| **Stamina** | Drains on actions, regens after delay, exhaustion state |
| **Camera** | Third-person follow + orbit. No lock-on in slice 1. |
| **Collision** | Player-wall AABB. Player sphere vs enemy spheres. |
| **Combat** | Light attack only. Hitbox/hurtbox detection. Damage calculator. |
| **Stagger** | Poise system on enemies (not player for slice 1) |
| **Base enemy** | HP, FSM, takeDamage, die |
| **Triangle Shard** | Chase, lunge, slash — full behavior |
| **HUD** | HP bar, stamina bar |
| **Debug** | FPS, player state, hitbox visualization (F1) |
| **Test arena** | 20m x 20m enclosed room with walls |

## Excluded from Slice 1

- Lock-on system
- Heavy attack, parry, healing
- Ranged enemies / projectiles
- Room transitions / doors
- Zone generation
- Pickups / shards
- Save system
- Meta-progression
- Outline post-processing
- Particle effects (use simple mesh hide/show for death)
- Damage numbers
- Audio
- Death screen UI (just restart immediately)

---

## Exact Enemy

**Triangle Shard** x3, spawned at fixed positions in the test arena.

| Property | Value |
|----------|-------|
| HP | 30 |
| Move speed | 6 m/s |
| Aggro range | 10m |
| Attack: Lunge | 400ms telegraph → 4m dash → 600ms recovery → 15 damage |
| Attack: Slash | 300ms telegraph → 90° arc → 400ms recovery → 10 damage |

Spawn positions:
- (4, 0, 4)
- (-4, 0, 4)
- (0, 0, -4)

---

## Exact Room / Environment

**Test Arena**:
- 20m x 20m flat ground plane
- 4 walls (3m height)
- Grey floor (#4a4a4a)
- Darker walls (#3a3a3a)
- Directional light from above-right for cel-shading
- Ambient light (low intensity) for fill

No props, no hazards, no decoration.

---

## Exact Win / Fail Loop

### Win
1. All 3 Triangle Shards are dead
2. Console message: "ENCOUNTER CLEARED"
3. Wait 2 seconds
4. Respawn 3 new Triangle Shards at same positions
5. Reset player HP and stamina to full

### Fail
1. Player HP reaches 0
2. Player mesh disappears
3. Console message: "PLAYER DIED"
4. Wait 1.5 seconds
5. Reset: player respawns at (0, 0, 0), full HP/stamina
6. Respawn 3 Triangle Shards at original positions

This is a minimal loop for testing combat feel. No UI screens, no transitions — just instant reset.

---

## Exact Files That Matter First

### Must-Create (in order)

| Priority | File | Purpose |
|----------|------|---------|
| 1 | `package.json` | Dependencies |
| 1 | `tsconfig.json` | TypeScript config |
| 1 | `vite.config.ts` | Build config |
| 1 | `public/index.html` | HTML shell |
| 2 | `src/main.ts` | Entry point |
| 2 | `src/utils/math.ts` | Math helpers |
| 2 | `src/utils/timer.ts` | Cooldown timer |
| 2 | `src/utils/constants.ts` | Game constants |
| 2 | `src/config/gameConfig.ts` | Tuning values |
| 3 | `src/app/EventBus.ts` | Event system |
| 3 | `src/app/Game.ts` | Main game class |
| 3 | `src/app/GameLoop.ts` | Fixed timestep loop |
| 3 | `src/engine/Clock.ts` | Time management |
| 4 | `src/rendering/Renderer.ts` | Three.js renderer |
| 4 | `src/rendering/CelShadingPipeline.ts` | Cel-shade materials |
| 5 | `src/app/InputManager.ts` | Input abstraction |
| 6 | `src/player/PlayerModel.ts` | Player mesh |
| 6 | `src/player/PlayerStats.ts` | HP, stamina |
| 7 | `src/camera/CameraController.ts` | Third-person camera |
| 8 | `src/ai/StateMachine.ts` | Generic FSM |
| 8 | `src/ai/AIState.ts` | State interface |
| 9 | `src/player/PlayerController.ts` | Movement + state owner |
| 9 | `src/player/PlayerStateMachine.ts` | Player states |
| 10 | `src/engine/CollisionSystem.ts` | AABB/sphere collision |
| 11 | `src/world/RoomModule.ts` | Test arena |
| 12 | `src/combat/HitboxManager.ts` | Hitbox/hurtbox |
| 12 | `src/combat/DamageCalculator.ts` | Damage math |
| 12 | `src/combat/CombatSystem.ts` | Hit resolution |
| 12 | `src/combat/WeaponSystem.ts` | Weapon data |
| 12 | `src/combat/StaggerSystem.ts` | Poise/stagger |
| 13 | `src/enemies/BaseEnemy.ts` | Enemy base class |
| 13 | `src/enemies/EnemyFactory.ts` | Enemy creation |
| 13 | `src/enemies/EnemyRegistry.ts` | Type registry |
| 14 | `src/ai/states/IdleState.ts` | AI idle |
| 14 | `src/ai/states/ChaseState.ts` | AI chase |
| 14 | `src/ai/states/AttackState.ts` | AI attack |
| 14 | `src/ai/states/StaggeredState.ts` | AI stagger |
| 14 | `src/ai/Perception.ts` | Distance/LOS checks |
| 15 | `src/enemies/TriangleShard.ts` | First enemy |
| 15 | `data/enemies/triangle-shard.json` | Enemy data |
| 16 | `src/ui/HUD.ts` | HP/stamina bars |
| 16 | `src/ui/UIManager.ts` | UI visibility |
| 17 | `src/utils/debug.ts` | Debug overlay |

### Total: ~40 files for the minimum playable slice.

---

## Definition of Done for Slice 1

- [ ] `npm run dev` launches game in browser
- [ ] Player visible as flickering icosahedron in cel-shaded arena
- [ ] WASD moves player camera-relative
- [ ] Sprint with shift
- [ ] Dodge with spacebar (i-frames work, stamina consumed)
- [ ] Light attack with left mouse (2-hit combo)
- [ ] Stamina drains and regens correctly
- [ ] Exhaustion state triggers at 0 stamina
- [ ] 3 Triangle Shards spawn and idle until player approaches
- [ ] Triangle Shards chase player, attack with lunge and slash
- [ ] Attack telegraphs are visible (red glow on enemy)
- [ ] Player attacks damage enemies (HP decreases)
- [ ] Enemy attacks damage player (HP decreases)
- [ ] Enemies die when HP reaches 0 (removed from scene)
- [ ] Player dies when HP reaches 0 (reset loop triggers)
- [ ] HUD shows HP and stamina bars that update in real time
- [ ] Debug overlay (F1) shows FPS, player state, hitbox wireframes
- [ ] Encounter resets on clear or death
- [ ] No console errors during normal gameplay
- [ ] Stable 60fps on mid-range hardware

**This is the foundation everything else builds on.** Get this right and the rest is content expansion.
