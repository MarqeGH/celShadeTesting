import * as THREE from 'three';
import { EventBus } from '../app/EventBus';

/** Shake intensity thresholds based on damage amount */
const LIGHT_HIT_THRESHOLD = 15;
/** Light hit: low intensity, short duration */
const LIGHT_INTENSITY = 0.15;
const LIGHT_DURATION = 0.2;
/** Heavy hit: high intensity, longer duration */
const HEAVY_INTENSITY = 0.4;
const HEAVY_DURATION = 0.4;

/**
 * Camera shake system. On PLAYER_DAMAGED events, applies a decaying
 * random offset to the camera position. Intensity and duration scale
 * with damage amount. Uses sine-based pseudo-random offsets for
 * smooth directional variety.
 */
export class CameraShake {
  private camera: THREE.PerspectiveCamera;

  /** Current shake intensity (decays toward 0) */
  private intensity = 0;
  /** Total duration of the current shake */
  private duration = 0;
  /** Elapsed time since shake started */
  private elapsed = 0;

  /** Accumulated offset applied to camera — subtracted on next update */
  private readonly offset = new THREE.Vector3();

  /** Bound handler for cleanup */
  private onPlayerDamaged: (data: { amount: number; currentHP: number }) => void;

  constructor(camera: THREE.PerspectiveCamera, eventBus: EventBus) {
    this.camera = camera;

    this.onPlayerDamaged = (data) => {
      const isHeavy = data.amount >= LIGHT_HIT_THRESHOLD;
      this.trigger(
        isHeavy ? HEAVY_INTENSITY : LIGHT_INTENSITY,
        isHeavy ? HEAVY_DURATION : LIGHT_DURATION,
      );
    };

    eventBus.on('PLAYER_DAMAGED', this.onPlayerDamaged);
  }

  /**
   * Start a shake. If a shake is already active, the stronger one wins.
   */
  trigger(intensity: number, duration: number): void {
    if (intensity > this.intensity) {
      this.intensity = intensity;
      this.duration = duration;
      this.elapsed = 0;
    }
  }

  /**
   * Call once per frame AFTER CameraController.update() has positioned the camera.
   * Adds a decaying random offset, then removes the previous frame's offset
   * so the base position stays clean.
   */
  update(dt: number): void {
    // Remove previous frame's offset
    this.camera.position.sub(this.offset);
    this.offset.set(0, 0, 0);

    if (this.intensity <= 0) return;

    this.elapsed += dt;

    if (this.elapsed >= this.duration) {
      this.intensity = 0;
      return;
    }

    // Decay: linear falloff from full intensity to 0 over duration
    const t = this.elapsed / this.duration;
    const currentIntensity = this.intensity * (1 - t);

    // Use time-based sin/cos for pseudo-random directional offsets
    // Different frequencies on each axis prevent repetitive patterns
    const time = this.elapsed * 37; // scale time for faster oscillation
    this.offset.x = Math.sin(time * 7.3) * currentIntensity;
    this.offset.y = Math.cos(time * 11.7) * currentIntensity;
    this.offset.z = Math.sin(time * 5.1 + 2.0) * currentIntensity * 0.5;

    this.camera.position.add(this.offset);
  }

  dispose(): void {
    // Remove remaining offset so camera returns to clean state
    this.camera.position.sub(this.offset);
    this.offset.set(0, 0, 0);
    this.intensity = 0;
  }
}
