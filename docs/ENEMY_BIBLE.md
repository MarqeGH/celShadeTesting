# Enemy Bible

## Design Principles

- Every enemy is a **collapsed human** performing a residual function
- Shape communicates role: sharp = aggressive, smooth = evasive, angular = defensive
- Each enemy must be learnable within 2–3 encounters
- All attacks have visible telegraphs (minimum 300ms wind-up)
- Mechanical identity first, visual polish second

---

## Enemy 1: Triangle Shard

| Field | Value |
|-------|-------|
| **Shape Identity** | Sharp isosceles triangle — a blade fragment |
| **Visual Silhouette** | Flat triangle, point-forward, ~1m tall, thin profile. Glows red along edges before attack. |
| **Movement Style** | Direct, linear. Turns to face player, then commits to straight-line charges. No strafing. |
| **Combat Role** | Basic melee fodder. Teaches attack reading and dodge timing. |
| **Implementation Complexity** | **Low** |

### Behavior Summary
Idles until player enters perception range (10m). Turns to face player. Pauses (telegraph). Charges forward in a straight line. If it misses, slides to a stop and resets. Repeats.

### Attacks

| Attack | Telegraph | Active | Recovery | Damage | Range |
|--------|-----------|--------|----------|--------|-------|
| **Lunge** | 400ms — edges glow red, leans back | 200ms — dashes forward 4m | 600ms — stuck in ground | 15 | 4m line |
| **Slash** | 300ms — rotates 90° | 150ms — sweeps in 90° arc | 400ms | 10 | 2m arc |

### Files Needed
- `data/enemies/triangle-shard.json` — stats, attack data, FSM config
- `src/enemies/TriangleShard.ts` — behavior class
- `assets/models/enemies/triangle-shard.glb` — mesh (or generated parametric)

---

## Enemy 2: Cube Sentinel

| Field | Value |
|-------|-------|
| **Shape Identity** | Solid cube — a watchful block |
| **Visual Silhouette** | 1.2m cube, rotates slowly on Y-axis. Face nearest player glows orange before firing. |
| **Movement Style** | Slow, deliberate. Maintains distance. Backs away if player closes in. |
| **Combat Role** | Ranged pressure. Forces player to close distance or use cover. |
| **Implementation Complexity** | **Medium** |

### Behavior Summary
Patrols slowly or holds position. When player enters range (15m), stops and begins aiming. Fires projectiles at intervals. If player gets within 4m, attempts to retreat to 10m distance. Low HP — rewards aggressive closing.

### Attacks

| Attack | Telegraph | Active | Recovery | Damage | Range |
|--------|-----------|--------|----------|--------|-------|
| **Shard Bolt** | 500ms — face glows, vibrates | Instant — fires projectile (10m/s) | 800ms before next shot | 12 | 15m |
| **Scatter Shot** | 700ms — all faces glow | Instant — fires 3 bolts in spread | 1200ms | 8 each | 12m |

### Projectile Data
- Shape: small glowing cube (0.2m)
- Speed: 10m/s
- Lifetime: 2s
- Pooled (reuse instances)

### Files Needed
- `data/enemies/cube-sentinel.json`
- `src/enemies/CubeSentinel.ts`
- Projectile system addition to `src/engine/ObjectPool.ts`

---

## Enemy 3: Spiral Dancer

| Field | Value |
|-------|-------|
| **Shape Identity** | Helix / spiral spring — coiled motion |
| **Visual Silhouette** | Elongated spiral ~1.5m tall, constantly rotating. Leaves faint motion trails. |
| **Movement Style** | Fast, erratic. Orbits player. Changes direction unpredictably. |
| **Combat Role** | Skirmisher. Punishes passive play. Teaches tracking and timing. |
| **Implementation Complexity** | **Medium** |

### Behavior Summary
Orbits player at 5–7m distance. Periodically dashes in for a quick hit, then retreats. Difficult to pin down. Low HP but hard to hit. Attacks from unexpected angles.

### Attacks

| Attack | Telegraph | Active | Recovery | Damage | Range |
|--------|-----------|--------|----------|--------|-------|
| **Dart Strike** | 350ms — stops orbiting, coils tightly | 150ms — dashes through player position | 500ms — slides past, decelerating | 12 | 6m dash |
| **Whip Lash** | 300ms — extends spiral outward | 200ms — snaps back, sweeping arc | 300ms | 8 | 3m arc |

### Files Needed
- `data/enemies/spiral-dancer.json`
- `src/enemies/SpiralDancer.ts`

---

## Enemy 4: Monolith Brute

| Field | Value |
|-------|-------|
| **Shape Identity** | Tall rectangular monolith — a standing stone |
| **Visual Silhouette** | 2.5m tall, 0.8m wide rectangular slab. Dark stone color. Cracks glow before attacks. |
| **Movement Style** | Very slow. Walks toward player with heavy, shaking steps. Doesn't chase far. |
| **Combat Role** | Heavy bruiser. High HP, high damage, slow. Punishes greed. Teaches patience. |
| **Implementation Complexity** | **Medium** |

### Behavior Summary
Slowly advances on player. Attacks have large hitboxes and high damage but long telegraphs and recovery. Can be staggered with sustained damage. When staggered, temporarily exposes a weak point (glowing crack).

### Attacks

| Attack | Telegraph | Active | Recovery | Damage | Range |
|--------|-----------|--------|----------|--------|-------|
| **Slam** | 800ms — rises up, tilts forward | 300ms — crashes down, shockwave | 1000ms — stuck in ground | 30 | 3m radius |
| **Sweep** | 600ms — rotates 45° back | 400ms — sweeps 180° arc | 700ms | 20 | 3.5m arc |
| **Stomp** | 500ms — lifts, pause | 200ms — ground pound | 600ms | 15 | 2m radius |

### Special: Stagger Mechanic
- Poise: 100 (high)
- When poise breaks: stumbles, glowing crack exposed for 2s (1.5x damage taken)
- Poise resets after recovery

### Files Needed
- `data/enemies/monolith-brute.json`
- `src/enemies/MonolithBrute.ts`

---

## Enemy 5: Lattice Weaver

| Field | Value |
|-------|-------|
| **Shape Identity** | Open wireframe lattice — a grid that traps |
| **Visual Silhouette** | 1m floating wireframe cube/sphere. Semi-transparent. Pulsing nodes at vertices. |
| **Movement Style** | Floats slowly. Doesn't directly engage. Positions itself strategically. |
| **Combat Role** | Area denial / support. Creates hazard zones. Dangerous when combined with other enemies. |
| **Implementation Complexity** | **High** |

### Behavior Summary
Positions itself between player and other enemies or at choke points. Deploys persistent damage zones (wire grids on the ground). When alone, becomes aggressive and speeds up. Low HP — dies quickly if you reach it.

### Attacks

| Attack | Telegraph | Active | Recovery | Damage | Range |
|--------|-----------|--------|----------|--------|-------|
| **Web Deploy** | 600ms — vertices pulse outward | Instant — places damage zone on ground | 1500ms cooldown | 5/s in zone | 4m radius zone |
| **Node Burst** | 400ms — all vertices glow bright | 200ms — releases ring of small projectiles | 1000ms | 8 each | 6m ring |
| **Tether** | 500ms — extends a line toward player | Instant — if line connects, slows player 50% for 2s | 2000ms cooldown | 0 | 10m |

### Hazard Zone Data
- Shape: flat circle on ground
- Visual: glowing grid lines
- Duration: 8s
- Max 2 active zones per Weaver
- Pooled

### Files Needed
- `data/enemies/lattice-weaver.json`
- `src/enemies/LatticeWeaver.ts`
- `src/world/EnvironmentHazard.ts` (for damage zones)

---

## Enemy 6: Prism Elite

| Field | Value |
|-------|-------|
| **Shape Identity** | Multi-faceted prism — a being of many angles and states |
| **Visual Silhouette** | 2m tall hexagonal prism. Each face is a different color. Rotates to show different faces during phase shifts. |
| **Movement Style** | Moderate speed. Alternates between aggressive and defensive positioning based on current phase. |
| **Combat Role** | Mini-boss / elite. Tests mastery of all combat skills. Appears once per zone as optional challenge. |
| **Implementation Complexity** | **High** |

### Behavior Summary
Has 3 phases, indicated by which face is forward. **Red face**: aggressive melee attacks. **Blue face**: ranged barrage. **White face**: defensive, regenerates. Rotates between faces every 15s or when staggered. Each phase has distinct attack patterns. The player must adapt to shifting behavior.

### Phase: Red (Melee)

| Attack | Telegraph | Active | Recovery | Damage |
|--------|-----------|--------|----------|--------|
| **Prism Slash** | 400ms | 200ms — 3-hit combo | 500ms after combo | 15 per hit |
| **Fracture Dive** | 600ms — leaps up | 300ms — ground slam | 800ms | 25 |

### Phase: Blue (Ranged)

| Attack | Telegraph | Active | Recovery | Damage |
|--------|-----------|--------|----------|--------|
| **Refraction Beam** | 500ms — face brightens | 400ms — sweeping laser | 600ms | 20 |
| **Shard Storm** | 700ms — fragments orbit | 300ms — fires 5 homing shards | 1000ms | 8 each |

### Phase: White (Defensive)

| Behavior | Detail |
|----------|--------|
| **Regen** | Heals 2% max HP/s during white phase |
| **Deflect** | 50% chance to deflect attacks (visual spark, no damage) |
| **Phase ends** | After 10s or when hit 5 times |

### Files Needed
- `data/enemies/prism-elite.json`
- `src/enemies/PrismElite.ts`
- Extended FSM with phase sub-states

---

## Enemy Comparison Table

| Enemy | HP | Speed | Damage | Range | Role | Complexity |
|-------|----|----|--------|-------|------|------------|
| Triangle Shard | 30 | Fast | Low | Melee | Fodder | Low |
| Cube Sentinel | 25 | Slow | Med | Ranged | Pressure | Medium |
| Spiral Dancer | 20 | V.Fast | Low | Melee | Skirmish | Medium |
| Monolith Brute | 120 | V.Slow | High | Melee | Tank | Medium |
| Lattice Weaver | 35 | Slow | Low | Area | Control | High |
| Prism Elite | 200 | Med | High | Mixed | Mini-boss | High |
