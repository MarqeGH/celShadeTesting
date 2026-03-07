import * as THREE from 'three';
import { AIState } from '../../ai/AIState';
import { PlayerContext } from './PlayerContext';

const HEAL_DURATION = 0.8;
const HEAL_GLOW_COLOR = new THREE.Color(0.3, 1.5, 0.4);

export class HealState implements AIState<PlayerContext> {
  readonly name = 'heal';

  private timer = 0;
  private healed = false;
  private _originalColor: THREE.Color | null = null;

  enter(ctx: PlayerContext): void {
    this.timer = 0;
    this.healed = false;
    this._originalColor = null;

    // Visual: green glow on player during heal animation
    const material = ctx.model.mesh.material as THREE.ShaderMaterial;
    if (material.uniforms && material.uniforms['uBaseColor']) {
      this._originalColor = (material.uniforms['uBaseColor'].value as THREE.Color).clone();
      (material.uniforms['uBaseColor'].value as THREE.Color).copy(HEAL_GLOW_COLOR);
    }
  }

  update(dt: number, ctx: PlayerContext): string | null {
    this.timer += dt;

    if (this.timer >= HEAL_DURATION && !this.healed) {
      // Heal completes — consume charge and restore HP
      ctx.stats.heal();
      this.healed = true;
      return 'idle';
    }

    return null;
  }

  exit(ctx: PlayerContext): void {
    // Restore original color (whether completed or interrupted)
    this.restoreColor(ctx);
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
