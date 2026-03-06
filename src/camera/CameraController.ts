import * as THREE from 'three';
import { InputManager } from '../app/InputManager';

/**
 * Third-person camera that orbits around and follows a target position.
 *
 * Mouse movement rotates the orbit. The camera smoothly follows the
 * target using lerp-based interpolation. Vertical rotation is clamped.
 */
export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private input: InputManager;

  /** Horizontal orbit angle in radians (around Y axis) */
  private yaw = 0;
  /** Vertical orbit angle in radians */
  private pitch = 0.3; // slight downward look by default

  /** Distance from target to camera */
  private readonly distance = 8;
  /** Vertical offset above target for orbit pivot */
  private readonly heightOffset = 3;

  /** Lerp factor per fixed update — 0 = no follow, 1 = instant snap */
  private readonly followSmoothing = 0.1;

  /** Mouse sensitivity (radians per pixel of mouse movement) */
  private readonly sensitivityX = 0.003;
  private readonly sensitivityY = 0.003;

  /** Vertical angle limits (radians) */
  private readonly minPitch = THREE.MathUtils.degToRad(-10);
  private readonly maxPitch = THREE.MathUtils.degToRad(60);

  /** Current smoothed follow position (lerps toward target) */
  private followPosition = new THREE.Vector3();

  /** Whether the controller has received its first target position */
  private initialized = false;

  constructor(camera: THREE.PerspectiveCamera, input: InputManager) {
    this.camera = camera;
    this.input = input;
  }

  /**
   * Call once per fixed update. Reads mouse deltas, updates orbit angles,
   * lerps follow position toward target, and positions the camera.
   */
  update(_dt: number, targetPosition: THREE.Vector3): void {
    // Snap on first frame to avoid lerping from origin
    if (!this.initialized) {
      this.followPosition.copy(targetPosition);
      this.initialized = true;
    }

    // Read mouse deltas and update orbit angles
    this.yaw -= this.input.mouseDeltaX * this.sensitivityX;
    this.pitch += this.input.mouseDeltaY * this.sensitivityY;
    this.pitch = THREE.MathUtils.clamp(this.pitch, this.minPitch, this.maxPitch);

    // Smooth follow toward target
    this.followPosition.lerp(targetPosition, this.followSmoothing);

    // Compute orbit pivot (target + height offset)
    const pivotY = this.followPosition.y + this.heightOffset;

    // Compute camera position on the orbit sphere
    const camX = this.followPosition.x + this.distance * Math.sin(this.yaw) * Math.cos(this.pitch);
    const camY = pivotY + this.distance * Math.sin(this.pitch);
    const camZ = this.followPosition.z + this.distance * Math.cos(this.yaw) * Math.cos(this.pitch);

    this.camera.position.set(camX, camY, camZ);

    // Look at the pivot point (target + height offset)
    this.camera.lookAt(this.followPosition.x, pivotY, this.followPosition.z);
  }

  /** Current horizontal orbit angle — used by PlayerController for camera-relative movement */
  getYaw(): number {
    return this.yaw;
  }

  /** Forward direction on the XZ plane based on current yaw */
  getForward(out?: THREE.Vector3): THREE.Vector3 {
    const v = out ?? new THREE.Vector3();
    v.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    return v;
  }

  /** Right direction on the XZ plane based on current yaw */
  getRight(out?: THREE.Vector3): THREE.Vector3 {
    const v = out ?? new THREE.Vector3();
    v.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    return v;
  }
}
