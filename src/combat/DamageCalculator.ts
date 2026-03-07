import { AttackData } from './HitboxManager';

// ── Damage result ────────────────────────────────────────────────

export interface DamageResult {
  damage: number;
  staggerDamage: number;
  isCritical: boolean;
}

// ── Calculator ───────────────────────────────────────────────────

/**
 * Calculate final damage from attack data and weapon multiplier.
 *
 * Base formula: damage = attackData.damage * weaponMultiplier.
 * No defense reduction for now — add later when enemy armor exists.
 * Critical hits are not yet implemented (always false).
 */
export function calculateDamage(
  attackData: AttackData,
  weaponMultiplier: number = 1.0,
): DamageResult {
  return {
    damage: attackData.damage * weaponMultiplier,
    staggerDamage: attackData.staggerDamage * weaponMultiplier,
    isCritical: false,
  };
}
