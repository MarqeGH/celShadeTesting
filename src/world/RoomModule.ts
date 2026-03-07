import * as THREE from 'three';
import { createCelMaterial } from '../rendering/CelShadingPipeline';

const ARENA_SIZE = 20;
const WALL_HEIGHT = 3;
const WALL_THICKNESS = 0.4;
const FLOOR_COLOR = new THREE.Color(0x3a3a3a);
const WALL_COLOR = new THREE.Color(0x4a4a50);

export interface WallCollider {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

// --- Data interfaces matching DATA_SCHEMAS.md ---

export interface Vec3Data {
  x: number;
  y: number;
  z: number;
}

export interface ExitPointData {
  position: Vec3Data;
  direction: 'north' | 'south' | 'east' | 'west';
  locked: boolean;
}

export interface HazardPlacementData {
  type: string;
  position: Vec3Data;
  params: Record<string, number>;
}

export interface PropPlacementData {
  type: string;
  position: Vec3Data;
  rotation: Vec3Data;
  scale: number;
}

export interface RoomModuleData {
  id: string;
  zone: string;
  size: { x: number; y: number; z: number };
  geometry: string;
  spawnPoints: Vec3Data[];
  playerEntry: Vec3Data;
  exits: ExitPointData[];
  hazards: HazardPlacementData[];
  props: PropPlacementData[];
}

// --- Exit door runtime object ---

export interface ExitDoor {
  position: THREE.Vector3;
  direction: 'north' | 'south' | 'east' | 'west';
  locked: boolean;
  mesh: THREE.Mesh;
}

// --- RoomModule: runtime representation of an assembled room ---

const DOOR_WIDTH = 2.0;
const DOOR_HEIGHT = 2.5;
const DOOR_DEPTH = 0.3;
const LOCKED_COLOR = new THREE.Color(0xcc2222);
const UNLOCKED_COLOR = new THREE.Color(0x22cc44);
const SPAWN_MARKER_COLOR = new THREE.Color(0xffff00);
const SPAWN_MARKER_RADIUS = 0.2;

export class RoomModule {
  readonly group: THREE.Group;
  readonly wallColliders: WallCollider[] = [];
  readonly data: RoomModuleData;

  private spawnPoints: THREE.Vector3[] = [];
  private exits: ExitDoor[] = [];
  private spawnMarkers: THREE.Mesh[] = [];

  constructor(data: RoomModuleData) {
    this.data = data;
    this.group = new THREE.Group();

    // Store spawn points as Vector3
    for (const sp of data.spawnPoints) {
      this.spawnPoints.push(new THREE.Vector3(sp.x, sp.y, sp.z));
    }
  }

  getSpawnPoints(): THREE.Vector3[] {
    return this.spawnPoints;
  }

  getPlayerEntry(): THREE.Vector3 {
    return new THREE.Vector3(
      this.data.playerEntry.x,
      this.data.playerEntry.y,
      this.data.playerEntry.z,
    );
  }

  getExits(): ExitDoor[] {
    return this.exits;
  }

  addExit(exit: ExitDoor): void {
    this.exits.push(exit);
  }

  addSpawnMarker(marker: THREE.Mesh): void {
    this.spawnMarkers.push(marker);
  }

  unlockExits(): void {
    for (const exit of this.exits) {
      exit.locked = false;
      const mat = exit.mesh.material;
      if (mat instanceof THREE.ShaderMaterial && mat.uniforms['uBaseColor']) {
        mat.uniforms['uBaseColor'].value.copy(UNLOCKED_COLOR);
      }
    }
  }

  dispose(): void {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
  }
}

export { DOOR_WIDTH, DOOR_HEIGHT, DOOR_DEPTH, LOCKED_COLOR, UNLOCKED_COLOR, SPAWN_MARKER_COLOR, SPAWN_MARKER_RADIUS };

// --- TestArena: legacy test arena (kept for backward compatibility) ---

export class TestArena {
  readonly group: THREE.Group;
  readonly wallColliders: WallCollider[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.buildFloor();
    this.buildWalls();
  }

  private buildFloor(): void {
    const geometry = new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE);
    const material = createCelMaterial(FLOOR_COLOR);
    const floor = new THREE.Mesh(geometry, material);
    floor.rotation.x = -Math.PI / 2;
    this.group.add(floor);
  }

  private buildWalls(): void {
    const half = ARENA_SIZE / 2;
    const halfHeight = WALL_HEIGHT / 2;
    const halfThick = WALL_THICKNESS / 2;

    // Wall definitions: [posX, posZ, scaleX, scaleZ]
    const wallDefs: [number, number, number, number][] = [
      [0, -half - halfThick, ARENA_SIZE + WALL_THICKNESS * 2, WALL_THICKNESS],  // south
      [0, half + halfThick, ARENA_SIZE + WALL_THICKNESS * 2, WALL_THICKNESS],   // north
      [-half - halfThick, 0, WALL_THICKNESS, ARENA_SIZE],                        // west
      [half + halfThick, 0, WALL_THICKNESS, ARENA_SIZE],                         // east
    ];

    const wallGeometry = new THREE.BoxGeometry(1, WALL_HEIGHT, 1);
    const wallMaterial = createCelMaterial(WALL_COLOR);

    for (const [px, pz, sx, sz] of wallDefs) {
      const wall = new THREE.Mesh(wallGeometry, wallMaterial);
      wall.position.set(px, halfHeight, pz);
      wall.scale.set(sx, 1, sz);
      this.group.add(wall);

      // Store AABB collider for future collision detection
      this.wallColliders.push({
        min: new THREE.Vector3(px - sx / 2, 0, pz - sz / 2),
        max: new THREE.Vector3(px + sx / 2, WALL_HEIGHT, pz + sz / 2),
      });
    }
  }

  dispose(): void {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
  }
}
