import * as THREE from 'three';

/**
 * Player mesh: an icosahedron with per-frame vertex displacement
 * to create a "flickering instability" effect — the player is an unstable form.
 */
export class PlayerModel {
  readonly mesh: THREE.Mesh;

  private basePositions: Float32Array;
  private normals: Float32Array;
  private time = 0;

  /** Max displacement distance per vertex */
  private readonly displacementStrength = 0.04;
  /** Speed of the flickering noise cycle */
  private readonly flickerSpeed = 8;

  constructor() {
    const geometry = new THREE.IcosahedronGeometry(0.8, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x607080 });

    // Store a copy of the original vertex positions to displace from
    const posAttr = geometry.getAttribute('position');
    this.basePositions = new Float32Array(posAttr.array);
    this.normals = new Float32Array(geometry.getAttribute('normal').array);

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(0, 0.8, 0); // Sit on ground plane
  }

  /**
   * Call once per fixed update. Displaces vertices along their normals
   * using a simple per-vertex pseudo-noise based on vertex index + time.
   */
  update(dt: number): void {
    this.time += dt * this.flickerSpeed;

    const posAttr = this.mesh.geometry.getAttribute('position');
    const positions = posAttr.array as Float32Array;
    const count = posAttr.count;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // Simple pseudo-noise: sin/cos at different frequencies per vertex
      const noise =
        Math.sin(this.time + i * 1.37) * 0.5 +
        Math.cos(this.time * 1.7 + i * 2.63) * 0.3 +
        Math.sin(this.time * 0.8 + i * 4.19) * 0.2;

      const offset = noise * this.displacementStrength;

      positions[i3]     = this.basePositions[i3]     + this.normals[i3]     * offset;
      positions[i3 + 1] = this.basePositions[i3 + 1] + this.normals[i3 + 1] * offset;
      positions[i3 + 2] = this.basePositions[i3 + 2] + this.normals[i3 + 2] * offset;
    }

    posAttr.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
