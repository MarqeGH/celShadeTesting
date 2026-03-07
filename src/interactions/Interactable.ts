import * as THREE from 'three';

/**
 * Base interface for any world object the player can interact with.
 * Pickups auto-collect on proximity; future interactables may require a button press.
 */
export interface Interactable {
  /** Unique identifier for this interactable instance. */
  readonly id: string;

  /** World position of the interactable. */
  getPosition(): THREE.Vector3;

  /** Whether this interactable is still active (not yet collected/used). */
  isActive(): boolean;

  /** Per-frame update (animation, timers, etc.). */
  update(dt: number): void;

  /** Clean up Three.js objects and DOM elements. */
  dispose(): void;
}
