import * as THREE from 'three';
import { EventBus } from '../app/EventBus';
import { ObjectPool } from '../engine/ObjectPool';
import { EnemyFactory } from '../enemies/EnemyFactory';
import { createCelMaterial } from '../rendering/CelShadingPipeline';
import type { Interactable } from './Interactable';

// ── Constants ────────────────────────────────────────────────────

const COLLECTION_RADIUS = 2;
const COLLECTION_RADIUS_SQ = COLLECTION_RADIUS * COLLECTION_RADIUS;
const FLOAT_AMPLITUDE = 0.3;
const FLOAT_SPEED = 2.5;
const ROTATE_SPEED = 3;
const PICKUP_SCALE = 0.25;
const SHARD_COLOR = new THREE.Color(0xe0d060);
const SPAWN_SPREAD = 1.2;
const LIFETIME = 30; // seconds before pickup despawns
const MAGNET_RADIUS = 3;
const MAGNET_RADIUS_SQ = MAGNET_RADIUS * MAGNET_RADIUS;
const MAGNET_SPEED = 8;
const MESH_POOL_SIZE = 30;

// ── Shard pickup ─────────────────────────────────────────────────

interface ShardPickup extends Interactable {
  mesh: THREE.Mesh;
  baseY: number;
  age: number;
  shardValue: number;
  collected: boolean;
}

// ── PickupSystem ─────────────────────────────────────────────────

/**
 * Spawns shard pickups when enemies die. Pickups float and rotate.
 * Player auto-collects pickups within range.
 */
export class PickupSystem {
  private scene: THREE.Scene;
  private eventBus: EventBus;
  private pickups: ShardPickup[] = [];
  private totalShards = 0;
  private sharedGeometry: THREE.OctahedronGeometry;
  private sharedMaterial: THREE.ShaderMaterial;
  private meshPool: ObjectPool<THREE.Mesh>;

  private onEnemyDied: (data: { enemyId: string; position: { x: number; y: number; z: number } }) => void;

  constructor(scene: THREE.Scene, eventBus: EventBus) {
    this.scene = scene;
    this.eventBus = eventBus;

    // Shared geometry/material for all shard pickups
    this.sharedGeometry = new THREE.OctahedronGeometry(PICKUP_SCALE, 0);
    this.sharedMaterial = createCelMaterial(SHARD_COLOR);

    // Mesh pool: pre-warm to avoid runtime allocation during combat
    this.meshPool = new ObjectPool<THREE.Mesh>(
      () => new THREE.Mesh(this.sharedGeometry, this.sharedMaterial),
      (mesh) => {
        mesh.position.set(0, 0, 0);
        mesh.rotation.set(0, 0, 0);
        mesh.visible = false;
      },
      MESH_POOL_SIZE,
    );

    // Listen for enemy deaths
    this.onEnemyDied = (data) => this.spawnShards(data.enemyId, data.position);
    this.eventBus.on('ENEMY_DIED', this.onEnemyDied);
  }

  /** Get total shards collected this run. */
  getShardCount(): number {
    return this.totalShards;
  }

  /** Reset shard count (e.g. on new run). */
  resetShards(): void {
    this.totalShards = 0;
  }

  /**
   * Per-frame update: animate pickups and check collection.
   */
  update(dt: number, playerPosition: THREE.Vector3): void {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i];

      if (pickup.collected) {
        this.removePickup(i);
        continue;
      }

      pickup.age += dt;

      // Despawn after lifetime
      if (pickup.age >= LIFETIME) {
        this.removePickup(i);
        continue;
      }

      // Float and rotate animation
      pickup.mesh.position.y = pickup.baseY + Math.sin(pickup.age * FLOAT_SPEED) * FLOAT_AMPLITUDE;
      pickup.mesh.rotation.y += ROTATE_SPEED * dt;

      // Check collection distance
      const dx = playerPosition.x - pickup.mesh.position.x;
      const dz = playerPosition.z - pickup.mesh.position.z;
      const distSq = dx * dx + dz * dz;

      if (distSq <= COLLECTION_RADIUS_SQ) {
        this.collectPickup(pickup);
        this.removePickup(i);
        continue;
      }

      // Magnet: pull toward player when within magnet radius
      if (distSq <= MAGNET_RADIUS_SQ) {
        const dist = Math.sqrt(distSq);
        const pullStrength = (1 - dist / MAGNET_RADIUS) * MAGNET_SPEED * dt;
        pickup.mesh.position.x += (dx / dist) * pullStrength;
        pickup.mesh.position.z += (dz / dist) * pullStrength;
      }
    }
  }

  /** Remove all active pickups and unsubscribe. */
  dispose(): void {
    this.eventBus.off('ENEMY_DIED', this.onEnemyDied);

    for (const pickup of this.pickups) {
      this.scene.remove(pickup.mesh);
    }
    this.meshPool.releaseAll();
    this.pickups.length = 0;

    this.sharedGeometry.dispose();
    this.sharedMaterial.dispose();
  }

  // ── Internal ────────────────────────────────────────────────────

  private spawnShards(
    enemyStringId: string,
    position: { x: number; y: number; z: number },
  ): void {
    // Extract type ID from stringId (format: "{typeId}_{entityId}")
    const lastUnderscore = enemyStringId.lastIndexOf('_');
    const typeId = lastUnderscore > 0 ? enemyStringId.substring(0, lastUnderscore) : enemyStringId;

    // Look up drop data from cached enemy data
    const enemyData = EnemyFactory.getCachedData(typeId);
    let min = 2;
    let max = 5;
    if (enemyData?.drops?.shards) {
      min = enemyData.drops.shards.min;
      max = enemyData.drops.shards.max;
    }

    const count = min + Math.floor(Math.random() * (max - min + 1));

    for (let i = 0; i < count; i++) {
      this.spawnSingleShard(position, 1);
    }
  }

  private spawnSingleShard(
    position: { x: number; y: number; z: number },
    value: number,
  ): void {
    const mesh = this.meshPool.acquire();

    // Scatter slightly around the death position
    mesh.position.set(
      position.x + (Math.random() - 0.5) * SPAWN_SPREAD,
      position.y + 0.5,
      position.z + (Math.random() - 0.5) * SPAWN_SPREAD,
    );

    // Randomize initial rotation
    mesh.rotation.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
    );

    mesh.visible = true;
    this.scene.add(mesh);

    const pickup: ShardPickup = {
      id: `shard_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      mesh,
      baseY: mesh.position.y,
      age: 0,
      shardValue: value,
      collected: false,
      getPosition: () => mesh.position,
      isActive: () => !pickup.collected,
      update: () => {},
      dispose: () => {
        this.scene.remove(mesh);
        this.meshPool.release(mesh);
      },
    };

    this.pickups.push(pickup);
  }

  private collectPickup(pickup: ShardPickup): void {
    pickup.collected = true;
    this.totalShards += pickup.shardValue;

    this.eventBus.emit('SHARD_COLLECTED', {
      amount: pickup.shardValue,
      totalShards: this.totalShards,
      position: {
        x: pickup.mesh.position.x,
        y: pickup.mesh.position.y,
        z: pickup.mesh.position.z,
      },
    });
  }

  private removePickup(index: number): void {
    const pickup = this.pickups[index];
    this.scene.remove(pickup.mesh);
    this.meshPool.release(pickup.mesh);
    this.pickups.splice(index, 1);
  }
}
