import * as THREE from 'three';
import { BaseEnemy } from '../BaseEnemy';
import { SphereShape, HitboxManager } from '../../combat/HitboxManager';
import { EnemyData, AttackDataSchema } from '../EnemyFactory';
import { EnemyRegistry } from '../EnemyRegistry';
import { EventBus } from '../../app/EventBus';
import { createCelMaterial } from '../../rendering/CelShadingPipeline';
import {
  ShardIdleState,
  ShardChaseState,
  ShardAttackState,
  ShardAttackCooldownState,
  ShardStaggeredState,
} from './states';

// ── Constants ────────────────────────────────────────────────────

const TRIANGLE_COLOR = new THREE.Color(0xcc4444);

// ── TriangleShard class ─────────────────────────────────────────

export class TriangleShard extends BaseEnemy {
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
    this.baseColor = TRIANGLE_COLOR.clone();

    this.group.position.copy(position);
    this.group.position.y = 0;

    this.initialize();
  }

  // ── Mesh creation ─────────────────────────────────────────────

  protected createMesh(): THREE.Mesh {
    // Flat isosceles triangle: ConeGeometry with 3 radial segments
    const geometry = new THREE.ConeGeometry(0.6, 1.2, 3, 1);

    // Flatten on Z-axis for blade-like thin profile
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const z = positions.getZ(i);
      positions.setZ(i, z * 0.3);
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();

    const material = createCelMaterial(this.baseColor);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.6;

    return mesh;
  }

  // ── Hurtbox ───────────────────────────────────────────────────

  protected getHurtboxShape(): SphereShape {
    return {
      type: 'sphere',
      center: this.group.position,
      radius: 0.7,
    };
  }

  // ── FSM ───────────────────────────────────────────────────────

  protected initFSM(): void {
    const aggroRange = 10;
    const attackRange = this.attackRange;
    const attackPool = ['lunge', 'slash'];
    const attackCooldown = 800;
    const staggerDuration = 1000;

    this.fsm
      .addState(new ShardIdleState(aggroRange))
      .addState(new ShardChaseState(this, aggroRange, attackRange))
      .addState(new ShardAttackState(this, this._hitboxMgr, this._attacks, attackPool))
      .addState(new ShardAttackCooldownState(this, attackCooldown, attackRange))
      .addState(new ShardStaggeredState(staggerDuration));

    this.fsm.setState('idle');
  }

  // ── Public wrappers for protected BaseEnemy helpers ────────────

  moveTowardPublic(target: THREE.Vector3, dt: number): void {
    this.moveToward(target, dt);
  }

  faceDirectionPublic(dir: THREE.Vector3, dt: number): void {
    this.faceDirection(dir, dt);
  }

}

// ── Register in EnemyRegistry ───────────────────────────────────

EnemyRegistry.register('triangle-shard', TriangleShard);
