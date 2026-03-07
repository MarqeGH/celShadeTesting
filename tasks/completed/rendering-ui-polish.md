# Completed: Rendering, UI & Polish

> Cel-shading, outlines, HUD, debug tools, damage numbers, lock-on, camera shake, particles.

---

## T-011: Cel-Shading Pipeline
- Custom `ShaderMaterial` with 4-step toon ramp: highlight (>0.6, 1.1x), light (>0.2, 0.85x), mid (>-0.1, 0.6x), shadow (0.35x)
- `createCelMaterial(baseColor, lightDirection?)` factory. Uniforms: uBaseColor, uLightDir, uAmbientColor, uOpacity
- **Files:** `src/rendering/CelShadingPipeline.ts`, `src/shaders/celVertex.ts`, `src/shaders/celFragment.ts`

## T-012: Outline Post-Processing
- EffectComposer pipeline: RenderPass → custom outline ShaderPass → OutputPass
- Sobel-like edge detection on depth (linearized, distance-normalized) and normals. Width: 2px configurable
- Toggle with 'O' key
- **Files:** `src/rendering/PostProcessing.ts`, `src/shaders/outlineVertex.ts`, `src/shaders/outlineFragment.ts`

## T-025: HUD (Health, Stamina, Shards)
- HTML/CSS overlay: HP bar (red), Stamina bar (green), heal charge icons (blue), shard counter (yellow)
- CSS transitions (0.25s ease-out). Stamina bar turns brown during exhaustion
- `UIManager` controls visibility: `gameplay`/`menu`/`hidden` states
- **Files:** `src/ui/HUD.ts`, `src/ui/UIManager.ts`

## T-026: Debug Overlay
- F1 toggle: FPS, player state, position, enemy count, draw calls
- Red wireframe `EdgesGeometry` for active hitboxes, green for hurtboxes (depthTest: false)
- F2: god mode (no damage). F3: instant kill (one-shot enemies)
- **Files:** `src/utils/debug.ts`

## T-032: Damage Numbers UI
- Floating numbers on `ENEMY_DAMAGED`/`PLAYER_DAMAGED`. World position → screen projection
- DOM element pool (20). 800ms CSS animation (rise 60px + fade). White = enemy dmg, red = player dmg
- Random horizontal offset to prevent stacking
- **Files:** `src/ui/DamageNumbers.ts`

## T-033: Camera Lock-On
- Tab/MMB to acquire nearest enemy within 15m and 60° forward cone
- Target switching: horizontal mouse flick (>40px) while locked
- Auto-drop on target death or out of range. Diamond UI indicator with pulse animation
- Camera: focus shifts to 40% lerp between player and target, yaw auto-orbits behind player
- **Files:** `src/camera/LockOnSystem.ts`, `src/camera/CameraController.ts`

## T-034: Camera Shake
- On `PLAYER_DAMAGED`: light hits (<15 dmg) = intensity 0.15/200ms, heavy = 0.4/400ms
- Linear decay. Sine-based pseudo-random offsets (different frequencies per axis). Z attenuated 0.5x
- Additive offset subtracted before new frame to keep camera clean
- **Files:** `src/camera/CameraShake.ts`

## T-038: Particle System (Geometric)
- `ObjectPool<Particle>` (max 100). Three shapes: tetrahedron, box, thin box (line)
- Presets wired to EventBus:
  - `enemyDeath` (ENEMY_DIED): 8-15 red tetrahedron fragments burst outward
  - `playerHit` (PLAYER_DAMAGED): 5-8 red squares spray upward
  - `shardCollect` (SHARD_COLLECTED): 4-6 golden lines rise with spiral
- Quadratic opacity fade + scale shrink. Gravity on velocity
- **Files:** `src/rendering/ParticleSystem.ts`
