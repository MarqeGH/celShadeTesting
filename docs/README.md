# CELTEST

## Premise

Humanity has undergone ontological collapse. People no longer exist as persons — they have degraded into abstract geometric shapes: triangles, cubes, spirals, lattices, masks, prisms. This is not physical mutation. It is *reduction*. Identity flattened into shape. Role compressed into behavior. Memory dissolved into pattern.

You are something that remembers being more.

## Tone

- **Eerie**: silence where there should be voices
- **Melancholic**: beauty in simplified forms that once were complex
- **Hostile**: shapes attack not from malice but from compulsion — they are what they do
- **Legible**: visual clarity despite abstraction; every shape communicates its threat

## Player Fantasy

You are the last unstable form — a shape that hasn't fully collapsed. You flicker between states. You remember fragments. You push through zones of collapsed humanity, fighting what people became, scavenging what they left behind, trying to reach something at the center that might reverse the reduction — or complete it.

## Gameplay Loop (Single Run)

1. **Enter** a procedurally assembled zone of 5–8 rooms
2. **Fight** through encounters with geometric enemies
3. **Collect** shards (currency), fragments (upgrades), and echoes (lore)
4. **Choose** between branching paths with risk/reward trade-offs
5. **Face** a zone boss — a complex composite shape
6. **Die or advance** — death returns to hub, advancement unlocks deeper zones
7. **Spend** meta-currency on permanent unlocks between runs

## Technical Stack

| Component | Choice |
|-----------|--------|
| Engine | Three.js (r160+) |
| Language | TypeScript (strict mode) |
| Build | Vite |
| Physics | Custom AABB/sphere collisions (no physics engine) |
| State | Finite state machines + event bus |
| Data | JSON data files loaded at runtime |
| UI | HTML/CSS overlay (not canvas-rendered) |
| Audio | Web Audio API via Howler.js |
| Testing | Vitest |

## Core Pillars

1. **Readable Combat** — every attack is telegraphed; every shape communicates its threat through geometry and motion
2. **Ontological Horror Through Design** — the world doesn't explain itself; meaning emerges from shape, repetition, and absence
3. **Modular Ecosystem** — enemies, rooms, encounters, and upgrades are all data-driven and composable
4. **Stamina-Pressure Gameplay** — resource management under threat; every action has cost
5. **Roguelike Tension** — permadeath per run with meaningful meta-progression

## Design Constraints

- No dialogue system. Lore is environmental and implicit.
- No inventory management. Equipment is equipped-or-not.
- Maximum 3 weapon slots per run.
- No procedural geometry at runtime — all shapes are authored meshes or parametric primitives.
- Target 60fps on mid-range hardware. Keep draw calls under 200 per frame.
- All enemy behavior must be expressible as finite state machines loaded from data.
- Rooms are prefab modules assembled at runtime, not fully procedural.

## Visual Direction

- **Cel-shaded** with hard shadow edges and limited color palettes per zone
- **Flat planes** of color, thick outlines on geometry
- **Emissive accents** on attack telegraphs and interactive elements
- **Minimal textures** — color comes from material properties, not image maps
- **Post-processing**: outline pass, color grading per zone, subtle chromatic aberration on damage
- **Particle systems**: geometric (triangles, squares, lines) — no soft/organic particles

## Why Three.js

- Native web deployment — zero install friction for players
- Shader customization via GLSL for cel-shading pipeline
- Sufficient 3D capability for stylized low-poly action games
- Large ecosystem for tooling (loaders, post-processing, debug)
- TypeScript support is mature
- Keeps scope constrained vs. full engines — forces design discipline
- Allows HTML/CSS UI overlay without framework bridging
- Community examples exist for every needed subsystem (shadow mapping, skeletal animation, instanced rendering)
