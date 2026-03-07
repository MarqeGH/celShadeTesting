import * as THREE from 'three';
import { InputManager } from '../app/InputManager';
import { CameraController } from '../camera/CameraController';
import { PlayerModel } from './PlayerModel';
import { PlayerStats, SPRINT_STAMINA_PER_SEC } from './PlayerStats';
import { SphereCollider, AABB, testSphereVsAABB, resolveCollision } from '../engine/CollisionSystem';

/** Player collision sphere radius in meters */
const PLAYER_RADIUS = 0.5;

/**
 * Handles camera-relative player movement and mesh rotation.
 * Reads WASD + sprint input, computes movement in camera space,
 * and smoothly rotates the player mesh to face the movement direction.
 */
export class PlayerController {
  private input: InputManager;
  private cameraController: CameraController;
  private playerModel: PlayerModel;

  /** Walk speed in m/s */
  private readonly walkSpeed = 5;
  /** Sprint speed in m/s */
  private readonly sprintSpeed = 8;
  /** Rotation lerp factor per second — higher = snappier turning */
  private readonly rotationSpeed = 15;

  // Reusable vectors to avoid per-frame allocation
  private readonly moveDir = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();

  /** Sphere collider centered on the player, updated each collision check */
  private readonly sphereCollider: SphereCollider = {
    center: new THREE.Vector3(),
    radius: PLAYER_RADIUS,
  };

  constructor(
    input: InputManager,
    cameraController: CameraController,
    playerModel: PlayerModel,
  ) {
    this.input = input;
    this.cameraController = cameraController;
    this.playerModel = playerModel;
  }

  /**
   * Call once per fixed update. Reads input, moves the player mesh
   * in camera-relative space, and rotates to face the movement direction.
   * When stats are provided, sprint drains stamina and exhaustion reduces speed.
   */
  update(dt: number, stats?: PlayerStats): void {
    // Build input direction from WASD
    let inputX = 0;
    let inputZ = 0;

    if (this.input.isPressed('moveForward')) inputZ += 1;
    if (this.input.isPressed('moveBack'))    inputZ -= 1;
    if (this.input.isPressed('moveLeft'))     inputX -= 1;
    if (this.input.isPressed('moveRight'))    inputX += 1;

    // No movement input — nothing to do
    if (inputX === 0 && inputZ === 0) return;

    // Get camera-relative directions on XZ plane
    this.cameraController.getForward(this.forward);
    this.cameraController.getRight(this.right);

    // Combine into world-space movement direction
    this.moveDir
      .set(0, 0, 0)
      .addScaledVector(this.forward, inputZ)
      .addScaledVector(this.right, inputX);
    this.moveDir.y = 0;
    this.moveDir.normalize();

    // Pick speed — exhaustion overrides, sprint drains stamina
    const wantsSprint = this.input.isPressed('sprint');
    let speed: number;

    if (stats && stats.exhausted) {
      speed = stats.exhaustedWalkSpeed;
    } else if (wantsSprint && (!stats || stats.canSprint())) {
      speed = this.sprintSpeed;
      if (stats) {
        stats.drainStaminaContinuous(SPRINT_STAMINA_PER_SEC, dt);
      }
    } else {
      speed = this.walkSpeed;
    }

    // Move the player mesh
    const mesh = this.playerModel.mesh;
    mesh.position.addScaledVector(this.moveDir, speed * dt);

    // Smoothly rotate mesh to face movement direction
    const targetAngle = Math.atan2(this.moveDir.x, this.moveDir.z);
    const currentAngle = mesh.rotation.y;

    // Shortest-arc interpolation
    let angleDiff = targetAngle - currentAngle;
    // Wrap to [-PI, PI]
    angleDiff = ((angleDiff + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const lerpFactor = 1 - Math.exp(-this.rotationSpeed * dt);
    mesh.rotation.y = currentAngle + angleDiff * lerpFactor;
  }

  /**
   * Test player sphere against all wall AABBs and resolve overlaps.
   * Call once per frame after all movement has been applied.
   * Resolving each wall independently produces natural wall-sliding.
   */
  resolveWallCollisions(walls: AABB[]): void {
    const pos = this.playerModel.mesh.position;

    // Sync sphere collider center to current player position
    this.sphereCollider.center.set(pos.x, pos.y, pos.z);

    for (const wall of walls) {
      const result = testSphereVsAABB(this.sphereCollider, wall);
      if (result.hit) {
        resolveCollision(pos, result);
        // Re-sync collider for subsequent wall checks
        this.sphereCollider.center.set(pos.x, pos.y, pos.z);
      }
    }
  }
}
