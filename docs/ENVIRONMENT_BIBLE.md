# Environment Bible

## Design Principles

- Environments are **collapsed places** — they retain spatial logic but lose specificity
- Each zone has a distinct **color palette**, **geometry language**, and **gameplay purpose**
- Rooms are **modular assemblies**, not unique handcrafted levels
- Hazards are zone-specific and reinforce the zone's mechanical theme
- Traversal variety prevents combat fatigue: arenas, corridors, platforms, vistas

---

## Zone 1: The Shattered Atrium

| Field | Value |
|-------|-------|
| **Visual Identity** | Broken indoor space — fractured tile floors, walls at wrong angles, doorframes leading nowhere. Pale grey and muted teal. Faint fluorescent glow from ceiling fragments. |
| **Geometry Language** | Rectangular. Right angles. Flat planes. A building that forgot its purpose. |
| **Traversal Purpose** | Introduction zone. Teaches room navigation, combat basics, and door mechanics. Linear layout with simple branching. |
| **Color Palette** | Grey (#8a8a8a), Teal (#5a8a8a), White (#d0d0d0), Accent: Pale Orange (#d4a574) |
| **Ambient Audio** | Distant hum of dead fluorescent lights. Occasional sharp crack of settling geometry. |

### Hazards
| Hazard | Effect | Visual |
|--------|--------|--------|
| **Loose Tiles** | Collapse after 1s when stepped on, 2s respawn | Tiles that tilt slightly when player approaches |
| **Static Discharge** | Periodic damage pulse in small radius | Flickering blue sparks at broken conduit points |

### Suitable Enemies
- Triangle Shard (primary)
- Cube Sentinel (introduced mid-zone)
- Spiral Dancer (rare, in optional rooms)

### Reusable Room Modules
| Module | Size | Description |
|--------|------|-------------|
| `atrium-hall-straight` | 20m x 8m | Straight corridor with columns. 2 spawn points. |
| `atrium-room-square` | 12m x 12m | Square combat arena. 4 spawn points. Central pillar. |
| `atrium-junction-T` | 12m x 16m | T-intersection. Branch left or right. |
| `atrium-balcony` | 16m x 10m | Two-level room. Enemies on upper balcony, ramp access. |
| `atrium-boss-arena` | 20m x 20m | Open square. No cover. 4 corner pillars. Boss room. |

### Level Assembly Notes
- 5–6 rooms per run through this zone
- Always starts with `atrium-hall-straight` as tutorial corridor
- Boss room always last
- One branch point offers risk/reward (harder room = better loot)

---

## Zone 2: The Resonance Grid

| Field | Value |
|-------|-------|
| **Visual Identity** | Outdoor grid of towering vertical lines — a city collapsed into its wireframe. Dark blue-black sky. Ground is a flat plane with glowing grid lines. Structures are hollow frames. |
| **Geometry Language** | Vertical lines. Grid patterns. Wireframe boxes that suggest buildings. |
| **Traversal Purpose** | Open spaces with long sight lines. Introduces ranged enemy pressure. Player must use cover (wireframe structures) and manage distance. |
| **Color Palette** | Dark Blue (#1a1a3a), Black (#0a0a0a), Grid White (#e0e0e0), Accent: Orange (#e07030) |
| **Ambient Audio** | Low resonant drone. Wind through hollow frames. Rhythmic pulsing from grid lines. |

### Hazards
| Hazard | Effect | Visual |
|--------|--------|--------|
| **Grid Pulse** | Damage line sweeps across floor at intervals | Bright line that travels along grid, announced by grid brightening |
| **Collapsing Frame** | Structure falls when approached, blocking path / dealing damage | Wireframe structure that shudders, then topples |

### Suitable Enemies
- Cube Sentinel (primary — ranged dominance fits open space)
- Triangle Shard (in close-quarter frame interiors)
- Lattice Weaver (creates area denial in open spaces)

### Reusable Room Modules
| Module | Size | Description |
|--------|------|-------------|
| `grid-plaza-open` | 24m x 24m | Large open grid with 3 wireframe structures for cover. |
| `grid-corridor-narrow` | 6m x 20m | Narrow passage between tall wireframe walls. Ambush point. |
| `grid-platform-elevated` | 16m x 16m | Raised platforms connected by narrow bridges. Vertical play. |
| `grid-intersection` | 20m x 20m | Four-way cross. Enemies approach from multiple directions. |
| `grid-boss-arena` | 28m x 28m | Vast open grid. Grid pulse hazard active. Boss room. |

---

## Zone 3: The Folded Archive

| Field | Value |
|-------|-------|
| **Visual Identity** | Interior space of floating rectangular slabs — a library where pages became walls. Slabs drift slowly. Warm amber light from unknown source. Depth is ambiguous. |
| **Geometry Language** | Flat rectangles at all angles. Overlapping planes. No consistent floor — platforms are floating slabs. |
| **Traversal Purpose** | Vertical traversal. Platforming between floating slabs. Tight combat spaces on small platforms. Risk of falling. |
| **Color Palette** | Amber (#c09050), Warm Grey (#a09080), Dark Brown (#3a2a1a), Accent: White (#f0e0d0) |
| **Ambient Audio** | Soft paper-like rustling. Deep, slow breathing sound. Occasional thud of a slab shifting. |

### Hazards
| Hazard | Effect | Visual |
|--------|--------|--------|
| **Drifting Slab** | Platform moves on a path — player must ride or time jumps | Slab with faintly different shade, visibly in motion |
| **Falling Edge** | Slab edge crumbles when player stands on it | Edge particles flake off before collapse |
| **Void Fall** | Falling off platform deals 30% HP damage + resets to last safe platform | Dark void below |

### Suitable Enemies
- Spiral Dancer (uses platforming space to evade)
- Triangle Shard (charges on narrow platforms — dangerous)
- Prism Elite (optional challenge room)

### Reusable Room Modules
| Module | Size | Description |
|--------|------|-------------|
| `archive-slab-cluster` | 16m x 16m x 8m (3D) | Cluster of floating slabs at varying heights. 3 spawn points. |
| `archive-bridge-narrow` | 4m x 16m | Single slab bridge. Linear. Enemies block the path. |
| `archive-descent` | 12m x 12m x 12m | Downward sequence of slabs. Fall hazard. |
| `archive-reading-room` | 10m x 10m | Single large slab with walls on 3 sides. Arena-style. |
| `archive-boss-arena` | 20m x 20m | Large slab with smaller orbiting platforms. |

---

## Zone 4: The Signal Corridor

| Field | Value |
|-------|-------|
| **Visual Identity** | Long tubes of light — a communication system collapsed into its infrastructure. Pulsing neon lines along walls. Everything is cylindrical. |
| **Geometry Language** | Cylinders, tubes, rings. Curved walls. No flat surfaces. |
| **Traversal Purpose** | Linear but intense. Narrow spaces force close combat. Environmental hazards punish standing still. Speed zone — keep moving. |
| **Color Palette** | Black (#0a0a0a), Neon Cyan (#00e0e0), Neon Magenta (#e000e0), Accent: White (#ffffff) |
| **Ambient Audio** | High-pitched signal interference. Static bursts. Data-like clicking patterns. |

### Hazards
| Hazard | Effect | Visual |
|--------|--------|--------|
| **Signal Burst** | Periodic damage pulse along corridor segment | Neon ring pulse traveling down tube |
| **Static Field** | Zone that scrambles player UI (HUD flickers, no lock-on) | Visible static-like particle cloud |
| **Constriction** | Walls close in temporarily, reducing combat space | Tube diameter visibly shrinks |

### Suitable Enemies
- Monolith Brute (blocks narrow corridors — must be fought, can't go around)
- Triangle Shard (dangerous in tight spaces)
- Lattice Weaver (area denial in narrow spaces is brutal)

### Reusable Room Modules
| Module | Size | Description |
|--------|------|-------------|
| `signal-tube-straight` | 6m dia x 20m | Straight tube corridor. Signal Burst hazard. |
| `signal-junction-ring` | 12m dia | Circular junction room. Multiple exits. |
| `signal-chamber-wide` | 10m dia x 10m | Wider tube section. Arena combat. |
| `signal-spiral-descent` | 8m dia x 15m | Downward spiral path. Moving while fighting. |
| `signal-boss-arena` | 16m dia | Large cylindrical arena. Static Field zones. |

---

## Zone 5: The Convergence Threshold

| Field | Value |
|-------|-------|
| **Visual Identity** | All geometry pulls inward. Perspective is warped. Lines converge toward a central point that may or may not exist. Colors from all previous zones bleed in. Ground is unstable. |
| **Geometry Language** | Mixed — fragments of all previous zones' geometry. Rectangles, grids, slabs, tubes — all distorted, overlapping, pointing inward. |
| **Traversal Purpose** | Final zone. Maximum difficulty. Combines all traversal types. Unpredictable room composition. Tests everything the player has learned. |
| **Color Palette** | All previous zone colors desaturated and shifting. Accent: Bright White (#ffffff) at convergence center. |
| **Ambient Audio** | All previous ambient layers mixed and distorted. Growing low-frequency rumble. |

### Hazards
- All previous zone hazards can appear
- **Convergence Pull**: constant slow pull toward room center, resisted by movement
- **Geometry Shift**: room geometry rotates 90° at intervals, reorienting combat space

### Suitable Enemies
- All enemy types appear
- Mixed compositions — ranged + melee + area denial in same encounters
- Prism Elite appears as standard encounter (not optional)

### Reusable Room Modules
| Module | Size | Description |
|--------|------|-------------|
| `convergence-mixed-arena` | 18m x 18m | Fragments of previous zone geometry. All hazard types possible. |
| `convergence-gauntlet` | 8m x 30m | Long corridor with waves of mixed enemies. |
| `convergence-platform-chaos` | 20m x 20m x 10m | Floating slabs + grid lines + tube fragments. |
| `convergence-final-arena` | 24m x 24m | Circular. Convergence Pull active. Final boss room. |

### Level Assembly Notes
- 6–8 rooms
- No tutorial rooms — assumes player mastery
- Room modules are randomly drawn from ALL zone pools + convergence-specific modules
- Boss is always The Aggregate, The Frame, or The Mirror (selected per run)
