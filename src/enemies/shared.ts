import * as THREE from 'three';
import { EnemyContext } from './BaseEnemy';
import { AttackDataSchema } from './EnemyFactory';

/** Distance from enemy to player on ground plane. */
export function distToPlayer(ctx: EnemyContext): number {
  const pos = ctx.enemy.getPosition();
  const dx = pos.x - ctx.playerPosition.x;
  const dz = pos.z - ctx.playerPosition.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Pick a random attack from the given pool. */
export function pickAttack(attacks: AttackDataSchema[], pool: string[]): AttackDataSchema {
  const candidates = attacks.filter(a => pool.includes(a.id));
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ── Aggro coordination helpers ────────────────────────────────

/**
 * Request an attack token from the coordinator.
 * Returns true if allowed to attack (token granted or no coordinator present).
 */
export function requestAttackToken(ctx: EnemyContext): boolean {
  if (!ctx.aggroCoordinator) return true;
  return ctx.aggroCoordinator.requestToken(ctx.enemy.entityId);
}

/**
 * Release the attack token held by this enemy.
 * Safe to call even if no token is held.
 */
export function releaseAttackToken(ctx: EnemyContext): void {
  ctx.aggroCoordinator?.releaseToken(ctx.enemy.entityId);
}

// ── Scratch vector for orbit ──────────────────────────────────

const _orbitTarget = new THREE.Vector3();

/**
 * Compute an orbit-strafe target position around the player.
 * The enemy circles at `orbitRadius` distance. Used when attack token is denied.
 */
export function getOrbitTarget(
  ctx: EnemyContext,
  orbitRadius: number,
  dt: number,
  orbitSpeed: number = 3.0,
): THREE.Vector3 {
  const pos = ctx.enemy.getPosition();
  const dx = pos.x - ctx.playerPosition.x;
  const dz = pos.z - ctx.playerPosition.z;
  const currentAngle = Math.atan2(dz, dx);

  // Advance angle based on orbit speed
  const angularSpeed = orbitSpeed / orbitRadius;
  const newAngle = currentAngle + angularSpeed * dt;

  _orbitTarget.set(
    ctx.playerPosition.x + Math.cos(newAngle) * orbitRadius,
    0,
    ctx.playerPosition.z + Math.sin(newAngle) * orbitRadius,
  );
  return _orbitTarget;
}
