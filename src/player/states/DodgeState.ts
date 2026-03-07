import * as THREE from 'three';
import { AIState } from '../../ai/AIState';
import { PlayerContext } from './PlayerContext';

/** Dodge distance in meters */
const DODGE_DISTANCE = 4;
/** Dodge movement phase duration in seconds */
const DODGE_DURATION = 0.3;
/** Recovery phase after dodge (no actions allowed) */
const DODGE_RECOVERY = 0.1;
/** I-frame window start (seconds after dodge begins) */
const IFRAME_START = 0.05;
/** I-frame window end (seconds after dodge begins) */
const IFRAME_END = 0.25;
/** Opacity during i-frames */
const IFRAME_OPACITY = 0.35;

export class DodgeState implements AIState<PlayerContext> {
  readonly name = 'dodge';

  private timer = 0;
  private readonly dodgeDir = new THREE.Vector3();
  private readonly _forward = new THREE.Vector3();
  private readonly _right = new THREE.Vector3();
  private _invulnerable = false;

  get isInvulnerable(): boolean { return this._invulnerable; }

  enter(ctx: PlayerContext): void {
    this.timer = 0;
    this._invulnerable = false;

    // Determine dodge direction from current WASD input
    const input = ctx.input;
    let inputX = 0;
    let inputZ = 0;

    if (input.isPressed('moveForward')) inputZ += 1;
    if (input.isPressed('moveBack'))    inputZ -= 1;
    if (input.isPressed('moveLeft'))    inputX -= 1;
    if (input.isPressed('moveRight'))   inputX += 1;

    ctx.camera.getForward(this._forward);
    ctx.camera.getRight(this._right);

    if (inputX !== 0 || inputZ !== 0) {
      // Dodge in camera-relative input direction
      this.dodgeDir
        .set(0, 0, 0)
        .addScaledVector(this._forward, inputZ)
        .addScaledVector(this._right, inputX);
      this.dodgeDir.y = 0;
      this.dodgeDir.normalize();
    } else {
      // No directional input → dodge backward (opposite player facing)
      const meshY = ctx.model.mesh.rotation.y;
      this.dodgeDir.set(-Math.sin(meshY), 0, -Math.cos(meshY));
    }
  }

  update(dt: number, ctx: PlayerContext): string | null {
    this.timer += dt;

    const totalDuration = DODGE_DURATION + DODGE_RECOVERY;

    // Done → return to idle
    if (this.timer >= totalDuration) {
      return 'idle';
    }

    // Movement phase: translate player along dodge direction
    if (this.timer < DODGE_DURATION) {
      const speed = DODGE_DISTANCE / DODGE_DURATION;
      ctx.model.mesh.position.addScaledVector(this.dodgeDir, speed * dt);
    }

    // I-frame logic
    const wasInvulnerable = this._invulnerable;
    this._invulnerable = this.timer >= IFRAME_START && this.timer <= IFRAME_END;

    // Visual: toggle translucency on i-frame edges
    if (this._invulnerable !== wasInvulnerable) {
      const material = ctx.model.mesh.material as THREE.ShaderMaterial;
      if (this._invulnerable) {
        material.transparent = true;
        material.uniforms.uOpacity.value = IFRAME_OPACITY;
      } else {
        material.uniforms.uOpacity.value = 1.0;
        material.transparent = false;
      }
    }

    return null;
  }

  exit(ctx: PlayerContext): void {
    this._invulnerable = false;

    // Ensure material is restored
    const material = ctx.model.mesh.material as THREE.ShaderMaterial;
    material.uniforms.uOpacity.value = 1.0;
    material.transparent = false;
  }
}
