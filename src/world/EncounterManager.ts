import * as THREE from 'three';
import { BaseEnemy } from '../enemies/BaseEnemy';
import { EnemyFactory } from '../enemies/EnemyFactory';
import { CubeSentinel } from '../enemies/cube-sentinel/CubeSentinel';
import { CombatSystem } from '../combat/CombatSystem';
import { StaggerSystem } from '../combat/StaggerSystem';
import { HitboxManager } from '../combat/HitboxManager';
import { EventBus } from '../app/EventBus';
import { WallCollider } from './RoomModule';

// ── Encounter data interfaces (matches DATA_SCHEMAS.md) ──────

export interface SpawnEntry {
  enemyId: string;
  count: number;
  spawnPoint: 'random' | 'nearest' | 'farthest' | number;
}

export interface EncounterWave {
  delay: number; // ms after previous wave cleared (or room entry for wave 0)
  spawns: SpawnEntry[];
}

export interface EncounterData {
  id: string;
  difficulty: number; // 1–10
  waves: EncounterWave[];
  roomConstraints?: string[];
}

// ── EncounterManager ─────────────────────────────────────────

type EncounterState = 'idle' | 'active' | 'wave_delay' | 'completed';

/**
 * Manages enemy spawning in waves for a room encounter.
 *
 * On room entry: loads encounter data, spawns wave 0 enemies at spawn points.
 * Tracks alive enemies per wave. When wave cleared, waits `delay` ms, then
 * spawns next wave. When all waves cleared, emits ROOM_CLEARED.
 */
export class EncounterManager {
  private eventBus: EventBus;
  private hitboxManager: HitboxManager;
  private combatSystem: CombatSystem;
  private staggerSystem: StaggerSystem;
  private scene: THREE.Scene;

  private state: EncounterState = 'idle';
  private encounter: EncounterData | null = null;
  private roomId = '';
  private currentWaveIndex = 0;
  private waveDelayTimer = 0;
  private waveDelayTarget = 0;

  // All enemies spawned by this manager (across all waves)
  private allEnemies: BaseEnemy[] = [];
  // Enemies alive in the current wave
  private waveEnemies: BaseEnemy[] = [];
  // Spawn points provided by the room
  private spawnPoints: THREE.Vector3[] = [];
  // Player position reference for spawn point strategies
  private playerPosition: THREE.Vector3 = new THREE.Vector3();
  // True while async enemy spawning is in-flight (prevents premature wave-clear)
  private isSpawning = false;
  // Wall colliders from the current room (for enemy wall collision)
  private wallColliders: WallCollider[] = [];

  constructor(
    eventBus: EventBus,
    hitboxManager: HitboxManager,
    combatSystem: CombatSystem,
    staggerSystem: StaggerSystem,
    scene: THREE.Scene,
  ) {
    this.eventBus = eventBus;
    this.hitboxManager = hitboxManager;
    this.combatSystem = combatSystem;
    this.staggerSystem = staggerSystem;
    this.scene = scene;
  }

  // ── Public API ──────────────────────────────────────────────

  /**
   * Start an encounter in a room. Spawns wave 0 after its delay.
   */
  async startEncounter(
    encounter: EncounterData,
    roomId: string,
    spawnPoints: THREE.Vector3[],
    playerPosition: THREE.Vector3,
  ): Promise<void> {
    this.encounter = encounter;
    this.roomId = roomId;
    this.spawnPoints = spawnPoints;
    this.playerPosition.copy(playerPosition);
    this.currentWaveIndex = 0;
    this.allEnemies = [];
    this.waveEnemies = [];

    if (encounter.waves.length === 0) {
      this.state = 'completed';
      this.emitRoomCleared();
      return;
    }

    const firstWave = encounter.waves[0];
    if (firstWave.delay > 0) {
      this.state = 'wave_delay';
      this.waveDelayTimer = 0;
      this.waveDelayTarget = firstWave.delay / 1000; // ms → seconds
    } else {
      this.state = 'active';
      await this.spawnWave(0);
    }
  }

  /**
   * Per-frame update. Handles wave delay timers and alive-enemy tracking.
   */
  update(dt: number, playerPosition: THREE.Vector3): void {
    this.playerPosition.copy(playerPosition);

    if (this.state === 'idle' || this.state === 'completed') return;

    // Update all alive enemies
    for (let i = this.allEnemies.length - 1; i >= 0; i--) {
      const enemy = this.allEnemies[i];
      enemy.update(dt, playerPosition);

      // Resolve wall collisions after movement
      if (!enemy.isDead() && this.wallColliders.length > 0) {
        enemy.resolveWallCollisions(this.wallColliders);
      }

      // Clean up dead enemies that finished their death animation
      if (enemy.isDead() && !enemy.isDying) {
        this.combatSystem.unregisterEntity(enemy.entityId);
        this.staggerSystem.unregister(enemy.entityId);
        this.allEnemies.splice(i, 1);
      }
    }

    if (this.state === 'wave_delay') {
      this.waveDelayTimer += dt;
      if (this.waveDelayTimer >= this.waveDelayTarget) {
        this.state = 'active';
        this.spawnWave(this.currentWaveIndex).catch((err) => {
          console.error('[EncounterManager] Failed to spawn wave:', err);
        });
      }
      return;
    }

    if (this.state === 'active' && !this.isSpawning) {
      // Remove dead enemies from wave tracking
      for (let i = this.waveEnemies.length - 1; i >= 0; i--) {
        if (this.waveEnemies[i].isDead()) {
          this.waveEnemies.splice(i, 1);
        }
      }

      // Check if current wave is cleared
      if (this.waveEnemies.length === 0) {
        this.onWaveCleared();
      }
    }
  }

  /**
   * Get all alive enemies managed by this encounter.
   */
  getEnemies(): BaseEnemy[] {
    return this.allEnemies;
  }

  /**
   * Get the current encounter state.
   */
  getState(): EncounterState {
    return this.state;
  }

  /**
   * Get the number of alive enemies in the current wave.
   */
  getAliveCount(): number {
    return this.waveEnemies.filter((e) => !e.isDead()).length;
  }

  /**
   * Set the wall colliders for enemy collision resolution.
   */
  setWallColliders(walls: WallCollider[]): void {
    this.wallColliders = walls;
  }

  /**
   * Clean up all enemies and reset state.
   */
  dispose(): void {
    for (const enemy of this.allEnemies) {
      this.staggerSystem.unregister(enemy.entityId);
      enemy.dispose();
    }
    this.allEnemies = [];
    this.waveEnemies = [];
    this.encounter = null;
    this.state = 'idle';
  }

  // ── Wave management ─────────────────────────────────────────

  private async spawnWave(waveIndex: number): Promise<void> {
    if (!this.encounter) return;
    if (waveIndex >= this.encounter.waves.length) return;

    this.isSpawning = true;
    const wave = this.encounter.waves[waveIndex];
    this.waveEnemies = [];

    const spawnPromises: Promise<void>[] = [];

    for (const spawn of wave.spawns) {
      for (let i = 0; i < spawn.count; i++) {
        const position = this.resolveSpawnPoint(spawn.spawnPoint, i);
        const promise = EnemyFactory.create(
          spawn.enemyId,
          position,
          this.eventBus,
          this.hitboxManager,
        ).then((enemy) => {
          // CubeSentinel needs a scene reference for projectiles
          if (enemy instanceof CubeSentinel) {
            enemy.setScene(this.scene);
          }

          this.scene.add(enemy.group);
          this.combatSystem.registerEntity(enemy);

          // Register enemy poise with StaggerSystem
          const stats = enemy.stats;
          this.staggerSystem.register(
            enemy.entityId,
            {
              maxPoise: stats.maxPoise,
              regenDelay: stats.poiseRegenDelay,
              regenRate: stats.poiseRegenRate,
            },
            () => enemy.getFSM().setState('staggered'),
          );

          this.allEnemies.push(enemy);
          this.waveEnemies.push(enemy);
        });

        spawnPromises.push(promise);
      }
    }

    await Promise.all(spawnPromises);
    this.isSpawning = false;

    console.log(
      `[EncounterManager] Wave ${waveIndex + 1}/${this.encounter.waves.length} spawned ` +
      `(${this.waveEnemies.length} enemies)`,
    );
  }

  private onWaveCleared(): void {
    if (!this.encounter) return;

    this.currentWaveIndex++;

    if (this.currentWaveIndex >= this.encounter.waves.length) {
      // All waves cleared
      this.state = 'completed';
      this.emitRoomCleared();
      console.log(`[EncounterManager] Encounter "${this.encounter.id}" completed — all waves cleared`);
      return;
    }

    // Start delay for next wave
    const nextWave = this.encounter.waves[this.currentWaveIndex];
    if (nextWave.delay > 0) {
      this.state = 'wave_delay';
      this.waveDelayTimer = 0;
      this.waveDelayTarget = nextWave.delay / 1000; // ms → seconds
    } else {
      // No delay — spawn immediately
      this.spawnWave(this.currentWaveIndex).catch((err) => {
        console.error('[EncounterManager] Failed to spawn wave:', err);
      });
    }
  }

  private emitRoomCleared(): void {
    this.eventBus.emit('ROOM_CLEARED', { roomId: this.roomId });
    console.log(`[EncounterManager] ROOM_CLEARED emitted for "${this.roomId}"`);
  }

  // ── Spawn point resolution ──────────────────────────────────

  private resolveSpawnPoint(
    strategy: 'random' | 'nearest' | 'farthest' | number,
    instanceIndex: number,
  ): THREE.Vector3 {
    if (this.spawnPoints.length === 0) {
      // Fallback: random position in a 10m radius
      console.warn('[EncounterManager] No spawn points available, using random fallback');
      return new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        0,
        (Math.random() - 0.5) * 10,
      );
    }

    if (typeof strategy === 'number') {
      // Specific spawn point by index
      const idx = Math.min(strategy, this.spawnPoints.length - 1);
      return this.spawnPoints[idx].clone();
    }

    switch (strategy) {
      case 'random': {
        // Distribute across spawn points to avoid stacking
        const idx = (instanceIndex) % this.spawnPoints.length;
        const base = this.spawnPoints[idx].clone();
        // Add small random offset to avoid exact overlap
        base.x += (Math.random() - 0.5) * 1.5;
        base.z += (Math.random() - 0.5) * 1.5;
        return base;
      }

      case 'nearest': {
        const sorted = this.getSortedSpawnPoints();
        const idx = Math.min(instanceIndex, sorted.length - 1);
        return sorted[idx].clone();
      }

      case 'farthest': {
        const sorted = this.getSortedSpawnPoints();
        const reverseIdx = sorted.length - 1 - Math.min(instanceIndex, sorted.length - 1);
        return sorted[reverseIdx].clone();
      }

      default:
        return this.spawnPoints[0].clone();
    }
  }

  private getSortedSpawnPoints(): THREE.Vector3[] {
    return [...this.spawnPoints].sort((a, b) => {
      const distA = _distVec.subVectors(a, this.playerPosition).lengthSq();
      const distB = _distVec2.subVectors(b, this.playerPosition).lengthSq();
      return distA - distB;
    });
  }
}

// ── Scratch vectors ──────────────────────────────────────────

const _distVec = new THREE.Vector3();
const _distVec2 = new THREE.Vector3();
