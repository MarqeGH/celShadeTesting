import * as THREE from 'three';
import { BaseEnemy } from '../BaseEnemy';
import { SphereShape, HitboxManager } from '../../combat/HitboxManager';
import { EnemyData, AttackDataSchema } from '../EnemyFactory';
import { EnemyRegistry } from '../EnemyRegistry';
import { EventBus } from '../../app/EventBus';
import { createCelMaterial } from '../../rendering/CelShadingPipeline';
import {
  DancerIdleState,
  DancerOrbitState,
  DancerDartStrikeState,
  DancerWhipLashState,
  DancerCooldownState,
  DancerStaggeredState,
} from './states';

// ── Constants ────────────────────────────────────────────────────

const DANCER_COLOR = new THREE.Color(0x9944cc);
const TELEGRAPH_RED = new THREE.Color(1.0, 0.15, 0.05);

// ── Helix curve for TubeGeometry ────────────────────────────────

class HelixCurve extends THREE.Curve<THREE.Vector3> {
  private turns: number;
  private height: number;
  private radius: number;

  constructor(turns: number, height: number, radius: number) {
    super();
    this.turns = turns;
    this.height = height;
    this.radius = radius;
  }

  getPoint(t: number, optionalTarget?: THREE.Vector3): THREE.Vector3 {
    const point = optionalTarget ?? new THREE.Vector3();
    const angle = t * Math.PI * 2 * this.turns;
    point.set(
      Math.cos(angle) * this.radius,
      t * this.height - this.height * 0.5,
      Math.sin(angle) * this.radius,
    );
    return point;
  }
}

// ── SpiralDancer class ──────────────────────────────────────────

export class SpiralDancer extends BaseEnemy {
  readonly attackRange: number;
  private _hitboxMgr: HitboxManager;
  private _attacks: AttackDataSchema[];
  private baseColor: THREE.Color;

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
        defense: data.stats.defense ?? 0,
        poise: data.stats.poise,
        maxPoise: data.stats.poise,
        poiseRegenDelay: data.stats.poiseRegenDelay / 1000,
        poiseRegenRate: data.stats.poiseRegenRate,
      },
      eventBus,
      hitboxManager,
    );

    this.attackRange = data.perception.attackRange;
    this._hitboxMgr = hitboxManager;
    this._attacks = data.attacks;
    this.baseColor = DANCER_COLOR.clone();

    this.group.position.copy(position);
    this.group.position.y = 0;

    this.initialize();
  }

  // ── Mesh creation ─────────────────────────────────────────────

  protected createMesh(): THREE.Mesh {
    // Helix: 3 turns, 1.5m tall, 0.25m radius
    const curve = new HelixCurve(3, 1.5, 0.25);
    const geometry = new THREE.TubeGeometry(curve, 48, 0.08, 6, false);
    const material = createCelMaterial(this.baseColor);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.75; // center at half-height
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
    const aggroRange = 12;
    const orbitRadius = 6;
    const orbitSpeed = 8;
    const attackCooldown = 1500;
    const staggerDuration = 1200;
    const cooldownDuration = 800;

    this.fsm
      .addState(new DancerIdleState(aggroRange))
      .addState(new DancerOrbitState(this, aggroRange, orbitRadius, orbitSpeed, attackCooldown))
      .addState(new DancerDartStrikeState(this, this._hitboxMgr, this._attacks))
      .addState(new DancerWhipLashState(this, this._hitboxMgr, this._attacks))
      .addState(new DancerCooldownState(this, cooldownDuration))
      .addState(new DancerStaggeredState(staggerDuration));

    this.fsm.setState('idle');
  }

  // ── Public wrappers for protected BaseEnemy helpers ────────────

  moveTowardPublic(target: THREE.Vector3, dt: number): void {
    this.moveToward(target, dt);
  }

  faceDirectionPublic(dir: THREE.Vector3, dt: number): void {
    this.faceDirection(dir, dt);
  }

  /** Move the group position directly (for orbit and dash movement). */
  moveByOffset(offset: THREE.Vector3): void {
    this.group.position.add(offset);
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
}

// ── Register in EnemyRegistry ───────────────────────────────────

EnemyRegistry.register('spiral-dancer', SpiralDancer);
