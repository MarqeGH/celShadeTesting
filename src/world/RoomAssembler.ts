import * as THREE from 'three';
import { createCelMaterial } from '../rendering/CelShadingPipeline';
import {
  RoomModule,
  DOOR_WIDTH,
  DOOR_HEIGHT,
  DOOR_DEPTH,
  LOCKED_COLOR,
  UNLOCKED_COLOR,
  SPAWN_MARKER_COLOR,
  SPAWN_MARKER_RADIUS,
  type RoomModuleData,
  type ExitDoor,
} from './RoomModule';

const WALL_THICKNESS = 0.4;
const FLOOR_COLOR = new THREE.Color(0x3a3a3a);
const WALL_COLOR = new THREE.Color(0x4a4a50);

/**
 * RoomAssembler reads a RoomModuleData JSON object and constructs
 * a Three.js scene graph from it: floor, walls, spawn point markers,
 * and exit door markers.
 */
export class RoomAssembler {
  /**
   * Build a RoomModule from data. Creates floor, walls, spawn markers, and doors.
   */
  assemble(data: RoomModuleData): RoomModule {
    const room = new RoomModule(data);

    this.buildFloor(room, data);
    this.buildWalls(room, data);
    this.buildSpawnMarkers(room, data);
    this.buildExitDoors(room, data);

    return room;
  }

  private buildFloor(room: RoomModule, data: RoomModuleData): void {
    const geometry = new THREE.PlaneGeometry(data.size.x, data.size.z);
    const material = createCelMaterial(FLOOR_COLOR);
    const floor = new THREE.Mesh(geometry, material);
    floor.rotation.x = -Math.PI / 2;
    room.group.add(floor);
  }

  private buildWalls(room: RoomModule, data: RoomModuleData): void {
    const halfX = data.size.x / 2;
    const halfZ = data.size.z / 2;
    const wallHeight = data.size.y;
    const halfHeight = wallHeight / 2;
    const halfThick = WALL_THICKNESS / 2;

    // Wall definitions: [posX, posZ, sizeX, sizeZ, direction]
    // direction is used to check if a door occupies part of this wall
    const wallDefs: {
      px: number; pz: number; sx: number; sz: number;
      dir: 'north' | 'south' | 'east' | 'west';
    }[] = [
      { px: 0, pz: -halfZ - halfThick, sx: data.size.x + WALL_THICKNESS * 2, sz: WALL_THICKNESS, dir: 'south' },
      { px: 0, pz: halfZ + halfThick, sx: data.size.x + WALL_THICKNESS * 2, sz: WALL_THICKNESS, dir: 'north' },
      { px: -halfX - halfThick, pz: 0, sx: WALL_THICKNESS, sz: data.size.z, dir: 'west' },
      { px: halfX + halfThick, pz: 0, sx: WALL_THICKNESS, sz: data.size.z, dir: 'east' },
    ];

    const wallGeometry = new THREE.BoxGeometry(1, wallHeight, 1);
    const wallMaterial = createCelMaterial(WALL_COLOR);

    for (const def of wallDefs) {
      const wall = new THREE.Mesh(wallGeometry, wallMaterial);
      wall.position.set(def.px, halfHeight, def.pz);
      wall.scale.set(def.sx, 1, def.sz);
      room.group.add(wall);

      room.wallColliders.push({
        min: new THREE.Vector3(def.px - def.sx / 2, 0, def.pz - def.sz / 2),
        max: new THREE.Vector3(def.px + def.sx / 2, wallHeight, def.pz + def.sz / 2),
      });
    }
  }

  private buildSpawnMarkers(room: RoomModule, data: RoomModuleData): void {
    const markerGeometry = new THREE.SphereGeometry(SPAWN_MARKER_RADIUS, 8, 6);
    const markerMaterial = createCelMaterial(SPAWN_MARKER_COLOR);

    for (const sp of data.spawnPoints) {
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.set(sp.x, sp.y + SPAWN_MARKER_RADIUS, sp.z);
      room.group.add(marker);
      room.addSpawnMarker(marker);
    }
  }

  private buildExitDoors(room: RoomModule, data: RoomModuleData): void {
    const doorGeometry = new THREE.BoxGeometry(DOOR_WIDTH, DOOR_HEIGHT, DOOR_DEPTH);

    for (const exitData of data.exits) {
      const color = exitData.locked ? LOCKED_COLOR : UNLOCKED_COLOR;
      const doorMaterial = createCelMaterial(color.clone());

      const doorMesh = new THREE.Mesh(doorGeometry, doorMaterial);
      doorMesh.position.set(
        exitData.position.x,
        exitData.position.y + DOOR_HEIGHT / 2,
        exitData.position.z,
      );

      // Rotate door based on direction so it faces outward
      if (exitData.direction === 'east' || exitData.direction === 'west') {
        doorMesh.rotation.y = Math.PI / 2;
      }

      room.group.add(doorMesh);

      const exit: ExitDoor = {
        position: new THREE.Vector3(exitData.position.x, exitData.position.y, exitData.position.z),
        direction: exitData.direction,
        locked: exitData.locked,
        mesh: doorMesh,
      };
      room.addExit(exit);
    }
  }
}
