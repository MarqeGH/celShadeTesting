import * as THREE from 'three';
import { AIState } from '../../ai/AIState';
import { PlayerContext } from './PlayerContext';

/** Parry active window where incoming attacks are deflected */
const PARRY_WINDOW = 0.15;
/** Recovery time after parry window */
const PARRY_RECOVERY = 0.2;
/** Total parry animation duration */
const PARRY_TOTAL = PARRY_WINDOW + PARRY_RECOVERY;
/** Duration of bright flash on successful parry */
const PARRY_FLASH_DURATION = 0.2;
/** Flash color (bright white) */
const PARRY_FLASH_COLOR = new THREE.Color(2.0, 2.0, 2.5);

export class ParryState implements AIState<PlayerContext> {
  readonly name = 'parry';

  private timer = 0;
  private _inWindow = false;
  private _flashTimer = 0;
  private _originalColor: THREE.Color | null = null;

  /** True while in the 150ms active deflection window */
  get isInWindow(): boolean { return this._inWindow; }

  enter(ctx: PlayerContext): void {
    this.timer = 0;
    this._inWindow = true;
    this._flashTimer = 0;
    this._originalColor = null;

    // Visual: compress on Z axis to indicate parry stance
    ctx.model.mesh.scale.z = 0.8;
  }

  update(dt: number, ctx: PlayerContext): string | null {
    this.timer += dt;
    this._inWindow = this.timer < PARRY_WINDOW;

    // Update parry flash visual
    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      if (this._flashTimer <= 0) {
        this.restoreColor(ctx);
      }
    }

    if (this.timer >= PARRY_TOTAL) {
      return 'idle';
    }

    return null;
  }

  exit(ctx: PlayerContext): void {
    this._inWindow = false;
    ctx.model.mesh.scale.z = 1.0;
    this.restoreColor(ctx);
  }

  /** Called when a successful parry deflects an attack */
  triggerSuccessFlash(ctx: PlayerContext): void {
    const material = ctx.model.mesh.material as THREE.ShaderMaterial;
    if (material.uniforms && material.uniforms['uBaseColor']) {
      if (!this._originalColor) {
        this._originalColor = (material.uniforms['uBaseColor'].value as THREE.Color).clone();
      }
      (material.uniforms['uBaseColor'].value as THREE.Color).copy(PARRY_FLASH_COLOR);
      this._flashTimer = PARRY_FLASH_DURATION;
    }
  }

  private restoreColor(ctx: PlayerContext): void {
    if (!this._originalColor) return;
    const material = ctx.model.mesh.material as THREE.ShaderMaterial;
    if (material.uniforms && material.uniforms['uBaseColor']) {
      (material.uniforms['uBaseColor'].value as THREE.Color).copy(this._originalColor);
    }
    this._originalColor = null;
  }
}
