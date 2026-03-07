import * as THREE from 'three';
import { ObjectPool } from '../engine/ObjectPool';
import { createCelMaterial } from './CelShadingPipeline';
import { EventBus } from '../app/EventBus';

// ── Constants ────────────────────────────────────────────────────────

const MAX_PARTICLES = 100;
const GRAVITY = -9.8;

// Preset: enemyDeath
const ENEMY_DEATH_COUNT_MIN = 8;
const ENEMY_DEATH_COUNT_MAX = 15;
const ENEMY_DEATH_SPEED_MIN = 5;
const ENEMY_DEATH_SPEED_MAX = 8;
const ENEMY_DEATH_LIFETIME_MIN = 1.0;
const ENEMY_DEATH_LIFETIME_MAX = 2.0;
const ENEMY_DEATH_SIZE = 0.15;

// Preset: playerHit
const PLAYER_HIT_COUNT_MIN = 5;
const PLAYER_HIT_COUNT_MAX = 8;
const PLAYER_HIT_SPEED_MIN = 1;
const PLAYER_HIT_SPEED_MAX = 3;
const PLAYER_HIT_LIFETIME_MIN = 0.6;
const PLAYER_HIT_LIFETIME_MAX = 1.0;
const PLAYER_HIT_SIZE = 0.08;

// Preset: shardCollect
const SHARD_COLLECT_COUNT_MIN = 4;
const SHARD_COLLECT_COUNT_MAX = 6;
const SHARD_COLLECT_SPEED_MIN = 2;
const SHARD_COLLECT_SPEED_MAX = 4;
const SHARD_COLLECT_LIFETIME = 1.2;
const SHARD_COLLECT_SIZE = 0.06;

// ── Particle data ────────────────────────────────────────────────────

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotationSpeed: THREE.Vector3;
  age: number;
  lifetime: number;
  active: boolean;
}

// ── Shared geometry (created once) ───────────────────────────────────

type GeometryType = 'triangle' | 'square' | 'line';

const sharedGeometries = new Map<GeometryType, THREE.BufferGeometry>();

function getSharedGeometry(type: GeometryType): THREE.BufferGeometry {
  let geom = sharedGeometries.get(type);
  if (geom) return geom;

  switch (type) {
    case 'triangle':
      geom = new THREE.TetrahedronGeometry(1, 0);
      break;
    case 'square':
      geom = new THREE.BoxGeometry(1, 1, 1);
      break;
    case 'line':
      geom = new THREE.BoxGeometry(0.2, 1, 0.2);
      break;
  }

  sharedGeometries.set(type, geom);
  return geom;
}

// ── Shared materials (created once per color) ────────────────────────

const sharedMaterials = new Map<number, THREE.ShaderMaterial>();

function getSharedMaterial(colorHex: number): THREE.ShaderMaterial {
  let mat = sharedMaterials.get(colorHex);
  if (mat) return mat;

  mat = createCelMaterial(new THREE.Color(colorHex));
  mat.transparent = true;
  mat.depthWrite = false;
  sharedMaterials.set(colorHex, mat);
  return mat;
}

// ── Helpers ──────────────────────────────────────────────────────────

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(randRange(min, max + 1));
}

// ── ParticleSystem ───────────────────────────────────────────────────

export class ParticleSystem {
  private scene: THREE.Scene;
  private eventBus: EventBus;
  private pool: ObjectPool<Particle>;
  private playerPositionGetter: (() => THREE.Vector3) | null = null;

  constructor(
    scene: THREE.Scene,
    eventBus: EventBus,
    playerPositionGetter?: () => THREE.Vector3,
  ) {
    this.scene = scene;
    this.eventBus = eventBus;
    if (playerPositionGetter) {
      this.playerPositionGetter = playerPositionGetter;
    }

    // Create pool with placeholder mesh (re-configured on emit)
    this.pool = new ObjectPool<Particle>(
      () => this.createParticle(),
      (p) => this.resetParticle(p),
      MAX_PARTICLES,
    );

    // Subscribe to events
    this.eventBus.on('ENEMY_DIED', this.onEnemyDied);
    this.eventBus.on('PLAYER_DAMAGED', this.onPlayerDamaged);
    this.eventBus.on('SHARD_COLLECTED', this.onShardCollected);
  }

  /** Set or update the player position getter (for playerHit preset). */
  setPlayerPositionGetter(getter: () => THREE.Vector3): void {
    this.playerPositionGetter = getter;
  }

  // ── Event handlers ──────────────────────────────────────────────

  private onEnemyDied = (data: { enemyId: string; position: { x: number; y: number; z: number } }): void => {
    const pos = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
    this.emitPreset('enemyDeath', pos);
  };

  private onPlayerDamaged = (_data: { amount: number; currentHP: number; sourceId?: string }): void => {
    if (!this.playerPositionGetter) return;
    const pos = this.playerPositionGetter().clone();
    pos.y += 0.8; // emit near center of player mesh
    this.emitPreset('playerHit', pos);
  };

  private onShardCollected = (data: { amount: number; totalShards: number; position: { x: number; y: number; z: number } }): void => {
    const pos = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
    this.emitPreset('shardCollect', pos);
  };

  // ── Emit presets ────────────────────────────────────────────────

  emitPreset(preset: 'enemyDeath' | 'playerHit' | 'shardCollect', position: THREE.Vector3): void {
    switch (preset) {
      case 'enemyDeath':
        this.emitEnemyDeath(position);
        break;
      case 'playerHit':
        this.emitPlayerHit(position);
        break;
      case 'shardCollect':
        this.emitShardCollect(position);
        break;
    }
  }

  private emitEnemyDeath(pos: THREE.Vector3): void {
    const count = randInt(ENEMY_DEATH_COUNT_MIN, ENEMY_DEATH_COUNT_MAX);
    for (let i = 0; i < count; i++) {
      if (this.pool.activeCount >= MAX_PARTICLES) break;

      const p = this.pool.acquire();
      this.configureParticle(p, 'triangle', 0xcc3333, ENEMY_DEATH_SIZE);

      p.mesh.position.copy(pos);
      p.mesh.position.y += 0.5;
      p.lifetime = randRange(ENEMY_DEATH_LIFETIME_MIN, ENEMY_DEATH_LIFETIME_MAX);

      // Burst radially outward
      const angle = Math.random() * Math.PI * 2;
      const elevation = randRange(-0.3, 0.8);
      const speed = randRange(ENEMY_DEATH_SPEED_MIN, ENEMY_DEATH_SPEED_MAX);
      p.velocity.set(
        Math.cos(angle) * speed,
        elevation * speed,
        Math.sin(angle) * speed,
      );

      // Fast spin
      p.rotationSpeed.set(
        randRange(-10, 10),
        randRange(-10, 10),
        randRange(-10, 10),
      );

      this.scene.add(p.mesh);
    }
  }

  private emitPlayerHit(pos: THREE.Vector3): void {
    const count = randInt(PLAYER_HIT_COUNT_MIN, PLAYER_HIT_COUNT_MAX);
    for (let i = 0; i < count; i++) {
      if (this.pool.activeCount >= MAX_PARTICLES) break;

      const p = this.pool.acquire();
      this.configureParticle(p, 'square', 0xff4444, PLAYER_HIT_SIZE);

      p.mesh.position.copy(pos);
      p.lifetime = randRange(PLAYER_HIT_LIFETIME_MIN, PLAYER_HIT_LIFETIME_MAX);

      // Upward spray with random scatter
      const speed = randRange(PLAYER_HIT_SPEED_MIN, PLAYER_HIT_SPEED_MAX);
      p.velocity.set(
        randRange(-1.5, 1.5),
        speed,
        randRange(-1.5, 1.5),
      );

      // Gentle tumble
      p.rotationSpeed.set(
        randRange(-3, 3),
        randRange(-3, 3),
        randRange(-3, 3),
      );

      this.scene.add(p.mesh);
    }
  }

  private emitShardCollect(pos: THREE.Vector3): void {
    const count = randInt(SHARD_COLLECT_COUNT_MIN, SHARD_COLLECT_COUNT_MAX);
    for (let i = 0; i < count; i++) {
      if (this.pool.activeCount >= MAX_PARTICLES) break;

      const p = this.pool.acquire();
      this.configureParticle(p, 'line', 0xe0d060, SHARD_COLLECT_SIZE);

      p.mesh.position.copy(pos);
      p.lifetime = SHARD_COLLECT_LIFETIME;

      // Rise upward with slight spread
      const speed = randRange(SHARD_COLLECT_SPEED_MIN, SHARD_COLLECT_SPEED_MAX);
      p.velocity.set(
        randRange(-0.5, 0.5),
        speed,
        randRange(-0.5, 0.5),
      );

      // Spiral rotation
      p.rotationSpeed.set(0, randRange(4, 8), 0);

      this.scene.add(p.mesh);
    }
  }

  // ── Per-frame update ────────────────────────────────────────────

  update(dt: number): void {
    const toRelease: Particle[] = [];

    this.pool.forEachActive((p) => {
      p.age += dt;

      if (p.age >= p.lifetime) {
        toRelease.push(p);
        return;
      }

      // Apply velocity
      p.mesh.position.x += p.velocity.x * dt;
      p.mesh.position.y += p.velocity.y * dt;
      p.mesh.position.z += p.velocity.z * dt;

      // Apply gravity
      p.velocity.y += GRAVITY * dt;

      // Apply rotation
      p.mesh.rotation.x += p.rotationSpeed.x * dt;
      p.mesh.rotation.y += p.rotationSpeed.y * dt;
      p.mesh.rotation.z += p.rotationSpeed.z * dt;

      // Fade opacity over lifetime
      const t = p.age / p.lifetime;
      const opacity = 1.0 - t * t; // quadratic fade for smooth falloff
      const mat = p.mesh.material as THREE.ShaderMaterial;
      mat.uniforms['uOpacity'].value = opacity;

      // Shrink toward end
      const scale = 1.0 - t * 0.5;
      p.mesh.scale.setScalar(scale);
    });

    // Release expired particles
    for (const p of toRelease) {
      this.scene.remove(p.mesh);
      p.active = false;
      this.pool.release(p);
    }
  }

  // ── Pool management ─────────────────────────────────────────────

  private createParticle(): Particle {
    const geometry = getSharedGeometry('square');
    const material = getSharedMaterial(0xffffff).clone();
    material.transparent = true;
    material.depthWrite = false;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;

    return {
      mesh,
      velocity: new THREE.Vector3(),
      rotationSpeed: new THREE.Vector3(),
      age: 0,
      lifetime: 1,
      active: false,
    };
  }

  private resetParticle(p: Particle): void {
    p.age = 0;
    p.lifetime = 1;
    p.active = true;
    p.velocity.set(0, 0, 0);
    p.rotationSpeed.set(0, 0, 0);
    p.mesh.position.set(0, 0, 0);
    p.mesh.rotation.set(0, 0, 0);
    p.mesh.scale.setScalar(1);
    p.mesh.visible = true;

    const mat = p.mesh.material as THREE.ShaderMaterial;
    mat.uniforms['uOpacity'].value = 1.0;
  }

  private configureParticle(
    p: Particle,
    geometryType: GeometryType,
    colorHex: number,
    size: number,
  ): void {
    // Swap geometry
    p.mesh.geometry = getSharedGeometry(geometryType);

    // Configure material color
    const mat = p.mesh.material as THREE.ShaderMaterial;
    mat.uniforms['uBaseColor'].value.setHex(colorHex);
    mat.uniforms['uOpacity'].value = 1.0;

    // Set size
    p.mesh.scale.setScalar(size);
  }

  // ── Cleanup ─────────────────────────────────────────────────────

  dispose(): void {
    this.eventBus.off('ENEMY_DIED', this.onEnemyDied);
    this.eventBus.off('PLAYER_DAMAGED', this.onPlayerDamaged);
    this.eventBus.off('SHARD_COLLECTED', this.onShardCollected);

    // Remove all active particles from scene
    this.pool.forEachActive((p) => {
      this.scene.remove(p.mesh);
      (p.mesh.material as THREE.ShaderMaterial).dispose();
    });
    this.pool.releaseAll();
  }
}
