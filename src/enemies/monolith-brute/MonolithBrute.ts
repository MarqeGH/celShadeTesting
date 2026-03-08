import * as THREE from 'three';
import { BaseEnemy } from '../BaseEnemy';
import { SphereShape, HitboxManager } from '../../combat/HitboxManager';
import { EnemyData, AttackDataSchema } from '../EnemyFactory';
import { EnemyRegistry } from '../EnemyRegistry';
import { EventBus } from '../../app/EventBus';
import { createCelMaterial } from '../../rendering/CelShadingPipeline';
import {
  BruteIdleState,
  BruteChaseState,
  BruteSlamState,
  BruteSweepState,
  BruteStompState,
  BruteCooldownState,
  BruteStaggeredState,
} from './states';

// ── Constants ───────────────────────────────────────────────────

const MONOLITH_COLOR = new THREE.Color(0x555566);
const TELEGRAPH_RED = new THREE.Color(1.0, 0.15, 0.05);
const CRACK_GLOW_COLOR = new THREE.Color(1.0, 0.6, 0.2);

// ── MonolithBrute class ─────────────────────────────────────────

export class MonolithBrute extends BaseEnemy {
  private _hitboxMgr: HitboxManager;
  private _attacks: AttackDataSchema[];
  private baseColor: THREE.Color;

  /** Damage multiplier — set to 1.5 during stagger vulnerability. */
  damageMultiplier = 1.0;

  constructor(
    data: EnemyData,
    position: THREE.Vector3,
    eventBus: EventBus,
    hitboxManager: HitboxManager,
  ) {
    super(
      data.id,
      {
        maxHp: data.stats.maxHP,
        moveSpeed: data.stats.moveSpeed,
        turnSpeed: data.stats.turnSpeed,
        poise: data.stats.poise,
        maxPoise: data.stats.poise,
        poiseRegenDelay: data.stats.poiseRegenDelay / 1000,
        poiseRegenRate: data.stats.poiseRegenRate,
      },
      eventBus,
      hitboxManager,
    );

    this._hitboxMgr = hitboxManager;
    this._attacks = data.attacks;
    this.baseColor = MONOLITH_COLOR.clone();

    this.group.position.copy(position);
    this.group.position.y = 0;

    this.initialize();
  }

  // ── Mesh creation ─────────────────────────────────────────────

  protected createMesh(): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(0.8, 2.5, 0.8);
    const material = createCelMaterial(this.baseColor);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 1.25; // center tall slab above ground
    return mesh;
  }

  // ── Hurtbox ───────────────────────────────────────────────────

  protected getHurtboxShape(): SphereShape {
    return {
      type: 'sphere',
      center: this.group.position,
      radius: 0.6,
    };
  }

  // ── FSM ───────────────────────────────────────────────────────

  protected initFSM(): void {
    const aggroRange = 15;
    const attackRange = 3.5;
    const cooldownDuration = 500;
    const staggerDuration = 2000;

    this.fsm
      .addState(new BruteIdleState(aggroRange))
      .addState(new BruteChaseState(this, aggroRange, attackRange))
      .addState(new BruteSlamState(this, this._hitboxMgr, this._attacks))
      .addState(new BruteSweepState(this, this._hitboxMgr, this._attacks))
      .addState(new BruteStompState(this, this._hitboxMgr, this._attacks))
      .addState(new BruteCooldownState(this, cooldownDuration))
      .addState(new BruteStaggeredState(this, staggerDuration));

    this.fsm.setState('idle');
  }

  // ── Damage override (vulnerability multiplier) ────────────────

  takeDamage(amount: number): number {
    return super.takeDamage(amount * this.damageMultiplier);
  }

  // ── Public wrappers for protected BaseEnemy helpers ────────────

  moveTowardPublic(target: THREE.Vector3, dt: number): void {
    this.moveToward(target, dt);
  }

  faceDirectionPublic(dir: THREE.Vector3, dt: number): void {
    this.faceDirection(dir, dt);
  }

  // ── Telegraph glow ────────────────────────────────────────────

  setTelegraphGlow(active: boolean): void {
    const mesh = this.group.children[0] as THREE.Mesh | undefined;
    if (!mesh) return;

    const mat = mesh.material;
    if (mat instanceof THREE.ShaderMaterial && mat.uniforms['uBaseColor']) {
      if (active) {
        mat.uniforms['uBaseColor'].value.copy(TELEGRAPH_RED);
      } else {
        mat.uniforms['uBaseColor'].value.copy(this.baseColor);
      }
    }
  }

  // ── Crack glow (stagger vulnerability) ────────────────────────

  setCrackGlow(active: boolean): void {
    const mesh = this.group.children[0] as THREE.Mesh | undefined;
    if (!mesh) return;

    const mat = mesh.material;
    if (mat instanceof THREE.ShaderMaterial && mat.uniforms['uBaseColor']) {
      if (active) {
        mat.uniforms['uBaseColor'].value.copy(CRACK_GLOW_COLOR);
      } else {
        mat.uniforms['uBaseColor'].value.copy(this.baseColor);
      }
    }
  }
}

// ── Register in EnemyRegistry ───────────────────────────────────

EnemyRegistry.register('monolith-brute', MonolithBrute);
