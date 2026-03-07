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
