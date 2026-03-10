import * as THREE from 'three';

/**
 * TelegraphVFX — per-enemy telegraph animation state.
 *
 * Drives two visual effects during an enemy's telegraph window:
 *   1. Color pulse — uBaseColor oscillates between the original color
 *      and the telegraph color with increasing intensity.
 *   2. Scale pulse — mesh group scales 1.0 → 1.15 → 1.0 over the duration.
 *
 * Color codes (per combat spec):
 *   - Red    (1.0, 0.15, 0.05) = melee attacks
 *   - Orange (1.0, 0.55, 0.1)  = ranged attacks
 *   - White  (1.0, 1.0, 1.0)   = unblockable attacks
 */

// ── Pre-defined telegraph colors ─────────────────────────────
export const TELEGRAPH_MELEE  = new THREE.Color(1.0, 0.15, 0.05);
export const TELEGRAPH_RANGED = new THREE.Color(1.0, 0.55, 0.1);
export const TELEGRAPH_UNBLOCKABLE = new THREE.Color(1.0, 1.0, 1.0);

/** Pulse frequency in Hz (oscillations per second) */
const PULSE_FREQ = 4.0;
/** Maximum scale increase during pulse */
const SCALE_AMPLITUDE = 0.15;

// ── Scratch color for lerp ───────────────────────────────────
const _lerpColor = new THREE.Color();

export class TelegraphVFX {
  private active = false;
  private timer = 0;
  private duration = 0;
  private telegraphColor = new THREE.Color();
  private originalColor = new THREE.Color();
  private mesh: THREE.Mesh | null = null;
  private group: THREE.Group | null = null;

  /** True while a telegraph animation is playing. */
  get isActive(): boolean {
    return this.active;
  }

  /**
   * Start a telegraph animation.
   * @param group — the enemy group (for scale pulse)
   * @param mesh — the enemy mesh (must use ShaderMaterial with uBaseColor)
   * @param color — telegraph color (use TELEGRAPH_MELEE/RANGED/UNBLOCKABLE)
   * @param duration — telegraph duration in seconds
   */
  start(group: THREE.Group, mesh: THREE.Mesh, color: THREE.Color, duration: number): void {
    this.group = group;
    this.mesh = mesh;
    this.telegraphColor.copy(color);
    this.duration = duration;
    this.timer = 0;
    this.active = true;

    // Store original color
    const mat = mesh.material;
    if (mat instanceof THREE.ShaderMaterial && mat.uniforms['uBaseColor']) {
      this.originalColor.copy(mat.uniforms['uBaseColor'].value);
    }
  }

  /**
   * Per-frame update. Advances pulse animation.
   * Call in the enemy's update() loop.
   */
  update(dt: number): void {
    if (!this.active || !this.mesh || !this.group) return;

    this.timer += dt;

    // ── Progress (0→1) over telegraph duration ──────────────
    const t = Math.min(this.timer / this.duration, 1.0);

    // ── Color pulse: oscillate with increasing intensity ─────
    // Intensity ramps from 0.3 to 1.0 over the duration
    const baseIntensity = 0.3 + 0.7 * t;
    // Add sine pulse that gets faster as we approach the active frame
    const pulseFreq = PULSE_FREQ * (1 + t);
    const pulse = 0.5 + 0.5 * Math.sin(this.timer * pulseFreq * Math.PI * 2);
    const colorMix = baseIntensity * (0.5 + 0.5 * pulse);

    const mat = this.mesh.material;
    if (mat instanceof THREE.ShaderMaterial && mat.uniforms['uBaseColor']) {
      _lerpColor.copy(this.originalColor).lerp(this.telegraphColor, colorMix);
      mat.uniforms['uBaseColor'].value.copy(_lerpColor);
    }

    // ── Scale pulse: 1.0 → 1.15 → 1.0 ─────────────────────
    // Sine wave over the full duration, peaks at midpoint
    const scalePulse = Math.sin(t * Math.PI) * SCALE_AMPLITUDE;
    const scale = 1.0 + scalePulse;
    this.group.scale.setScalar(scale);
  }

  /**
   * End the telegraph animation. Restores original color and scale.
   */
  end(): void {
    if (!this.active) return;

    // Restore original color
    if (this.mesh) {
      const mat = this.mesh.material;
      if (mat instanceof THREE.ShaderMaterial && mat.uniforms['uBaseColor']) {
        mat.uniforms['uBaseColor'].value.copy(this.originalColor);
      }
    }

    // Restore scale
    if (this.group) {
      this.group.scale.setScalar(1.0);
    }

    this.active = false;
    this.mesh = null;
    this.group = null;
  }
}
