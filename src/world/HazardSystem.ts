import * as THREE from 'three';
import { createCelMaterial } from '../rendering/CelShadingPipeline';
import { EventBus } from '../app/EventBus';
import { PlayerStats } from '../player/PlayerStats';
import { GAME_CONFIG } from '../config/gameConfig';
import type { Vec3Data } from './RoomModule';

// ── Hazard state types ──────────────────────────────────────

type LooseTileState = 'intact' | 'triggered' | 'collapsed' | 'respawning';

interface HazardBase {
  type: string;
  mesh: THREE.Mesh;
  position: THREE.Vector3;
}

interface StaticDischargeHazard extends HazardBase {
  type: 'static-discharge';
  radius: number;
  damagePerTick: number;
  tickInterval: number;
  lastDamageTime: number;
  elapsedTime: number;
}

interface LooseTileHazard extends HazardBase {
  type: 'loose-tile';
  size: number;
  state: LooseTileState;
  stateAge: number;
  collapseDelay: number;
  respawnDelay: number;
  collapseDepth: number;
  originalY: number;
  damagedThisCycle: boolean;
}

type Hazard = StaticDischargeHazard | LooseTileHazard;

// ── Colors ──────────────────────────────────────────────────

const DISCHARGE_COLOR = new THREE.Color(0x4499ff);
const LOOSE_TILE_COLOR = new THREE.Color(0x555555);

// ── HazardSystem ────────────────────────────────────────────

export class HazardSystem {
  private scene: THREE.Scene;
  private eventBus: EventBus;
  private playerStats: PlayerStats;
  private hazards: Hazard[] = [];

  constructor(scene: THREE.Scene, eventBus: EventBus, playerStats: PlayerStats) {
    this.scene = scene;
    this.eventBus = eventBus;
    this.playerStats = playerStats;
  }

  /**
   * Spawn a hazard from room JSON data.
   */
  spawn(type: string, position: Vec3Data, params: Record<string, number>): void {
    switch (type) {
      case 'static-discharge':
        this.spawnStaticDischarge(position, params);
        break;
      case 'loose-tile':
        this.spawnLooseTile(position, params);
        break;
      default:
        console.warn(`[HazardSystem] Unknown hazard type: "${type}"`);
    }
  }

  /**
   * Update all hazards. Called once per frame.
   */
  update(dt: number, playerPos: THREE.Vector3): void {
    for (const hazard of this.hazards) {
      switch (hazard.type) {
        case 'static-discharge':
          this.updateStaticDischarge(hazard, dt, playerPos);
          break;
        case 'loose-tile':
          this.updateLooseTile(hazard, dt, playerPos);
          break;
      }
    }
  }

  /**
   * Remove all hazards from scene and dispose resources.
   */
  clear(): void {
    for (const hazard of this.hazards) {
      this.scene.remove(hazard.mesh);
      hazard.mesh.geometry.dispose();
      if (hazard.mesh.material instanceof THREE.Material) {
        hazard.mesh.material.dispose();
      }
    }
    this.hazards.length = 0;
  }

  dispose(): void {
    this.clear();
  }

  // ── Static Discharge ────────────────────────────────────

  private spawnStaticDischarge(position: Vec3Data, params: Record<string, number>): void {
    const cfg = GAME_CONFIG.hazards.staticDischarge;
    const radius = params.radius ?? cfg.defaultRadius;
    const damagePerTick = params.damagePerTick ?? cfg.defaultDamage;
    const tickInterval = params.tickInterval ?? cfg.defaultInterval;

    const geometry = new THREE.SphereGeometry(radius, 12, 8);
    const material = createCelMaterial(DISCHARGE_COLOR);
    material.transparent = true;
    material.opacity = 0.35;

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y + radius * 0.5, position.z);
    this.scene.add(mesh);

    const hazard: StaticDischargeHazard = {
      type: 'static-discharge',
      mesh,
      position: new THREE.Vector3(position.x, position.y, position.z),
      radius,
      damagePerTick,
      tickInterval: tickInterval / 1000, // convert ms → seconds
      lastDamageTime: 0,
      elapsedTime: 0,
    };
    this.hazards.push(hazard);
  }

  private updateStaticDischarge(
    hazard: StaticDischargeHazard,
    dt: number,
    playerPos: THREE.Vector3,
  ): void {
    hazard.elapsedTime += dt;

    // Pulsing visual — scale oscillation
    const pulseSpeed = GAME_CONFIG.hazards.staticDischarge.pulseSpeed;
    const pulse = 0.85 + 0.15 * Math.sin(hazard.elapsedTime * pulseSpeed * Math.PI * 2);
    hazard.mesh.scale.setScalar(pulse);

    // Pulsing opacity
    const mat = hazard.mesh.material as THREE.ShaderMaterial;
    if (mat.uniforms && mat.uniforms['uOpacity']) {
      mat.uniforms['uOpacity'].value = 0.25 + 0.15 * Math.sin(hazard.elapsedTime * pulseSpeed * Math.PI * 2);
    } else {
      mat.opacity = 0.25 + 0.15 * Math.sin(hazard.elapsedTime * pulseSpeed * Math.PI * 2);
    }

    // Distance check (XZ plane — ignore Y for ground-level hazards)
    const dx = playerPos.x - hazard.position.x;
    const dz = playerPos.z - hazard.position.z;
    const distSq = dx * dx + dz * dz;
    const radiusSq = hazard.radius * hazard.radius;

    if (distSq < radiusSq) {
      // Player is inside hazard zone — apply periodic damage
      const timeSinceLast = hazard.elapsedTime - hazard.lastDamageTime;
      if (timeSinceLast >= hazard.tickInterval) {
        hazard.lastDamageTime = hazard.elapsedTime;
        if (!this.playerStats.isDead) {
          const remaining = this.playerStats.takeDamage(hazard.damagePerTick);
          this.eventBus.emit('PLAYER_DAMAGED', {
            amount: hazard.damagePerTick,
            currentHP: remaining,
            sourceId: 'hazard-static-discharge',
          });
        }
      }
    }
  }

  // ── Loose Tile ──────────────────────────────────────────

  private spawnLooseTile(position: Vec3Data, params: Record<string, number>): void {
    const cfg = GAME_CONFIG.hazards.looseTile;
    const size = params.size ?? cfg.defaultSize;
    const collapseDelay = (params.collapseDelay ?? cfg.collapseDelay) / 1000;
    const respawnDelay = (params.respawnDelay ?? cfg.respawnDelay) / 1000;

    const geometry = new THREE.BoxGeometry(size, 0.1, size);
    const material = createCelMaterial(LOOSE_TILE_COLOR);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y + 0.05, position.z);
    this.scene.add(mesh);

    const hazard: LooseTileHazard = {
      type: 'loose-tile',
      mesh,
      position: new THREE.Vector3(position.x, position.y, position.z),
      size,
      state: 'intact',
      stateAge: 0,
      collapseDelay,
      respawnDelay,
      collapseDepth: cfg.collapseDepth,
      originalY: position.y + 0.05,
      damagedThisCycle: false,
    };
    this.hazards.push(hazard);
  }

  private updateLooseTile(
    hazard: LooseTileHazard,
    dt: number,
    playerPos: THREE.Vector3,
  ): void {
    hazard.stateAge += dt;
    const halfSize = hazard.size / 2;

    // AABB check on XZ plane
    const onTile =
      playerPos.x >= hazard.position.x - halfSize &&
      playerPos.x <= hazard.position.x + halfSize &&
      playerPos.z >= hazard.position.z - halfSize &&
      playerPos.z <= hazard.position.z + halfSize;

    switch (hazard.state) {
      case 'intact':
        if (onTile) {
          // Player stepped on — begin collapse countdown
          hazard.state = 'triggered';
          hazard.stateAge = 0;
          hazard.damagedThisCycle = false;
        }
        break;

      case 'triggered':
        // Visual warning — slight wobble
        hazard.mesh.rotation.z = Math.sin(hazard.stateAge * 20) * 0.05;

        if (hazard.stateAge >= hazard.collapseDelay) {
          hazard.state = 'collapsed';
          hazard.stateAge = 0;
          hazard.mesh.rotation.z = 0;

          // Damage player if still on tile when it collapses
          if (onTile && !hazard.damagedThisCycle && !this.playerStats.isDead) {
            hazard.damagedThisCycle = true;
            const remaining = this.playerStats.takeDamage(10);
            this.eventBus.emit('PLAYER_DAMAGED', {
              amount: 10,
              currentHP: remaining,
              sourceId: 'hazard-loose-tile',
            });
          }
        }
        break;

      case 'collapsed': {
        // Lerp mesh downward
        const collapseT = Math.min(hazard.stateAge / 0.3, 1);
        hazard.mesh.position.y = hazard.originalY - collapseT * hazard.collapseDepth;

        if (hazard.stateAge >= hazard.respawnDelay) {
          hazard.state = 'respawning';
          hazard.stateAge = 0;
        }
        break;
      }

      case 'respawning': {
        // Lerp mesh back up
        const respawnT = Math.min(hazard.stateAge / 0.3, 1);
        const targetY = hazard.originalY;
        const fromY = hazard.originalY - hazard.collapseDepth;
        hazard.mesh.position.y = fromY + respawnT * (targetY - fromY);

        if (respawnT >= 1) {
          hazard.state = 'intact';
          hazard.stateAge = 0;
          hazard.mesh.position.y = hazard.originalY;
        }
        break;
      }
    }
  }
}
