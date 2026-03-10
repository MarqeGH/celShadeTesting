import { AttackData } from './HitboxManager';

// ── Damage result ────────────────────────────────────────────────

export interface DamageResult {
  damage: number;
  staggerDamage: number;
  isCritical: boolean;
}

// ── Calculator ───────────────────────────────────────────────────

/**
 * Calculate final damage from attack data, weapon multiplier, and defense.
 *
 * Base formula: rawDamage = attackData.damage * weaponMultiplier
 * Defense reduction: finalDamage = rawDamage * (100 / (100 + defense))
 *   - 0 defense = 100% damage
 *   - 50 defense = 67% damage
 *   - 100 defense = 50% damage
 * Stagger damage is NOT reduced by defense (poise damage bypasses armor).
 * Critical hits are not yet implemented (always false).
 */
export function calculateDamage(
  attackData: AttackData,
  weaponMultiplier: number = 1.0,
  defense: number = 0,
): DamageResult {
  const rawDamage = attackData.damage * weaponMultiplier;
  const defenseMultiplier = defense > 0 ? 100 / (100 + defense) : 1.0;

  return {
    damage: Math.round(rawDamage * defenseMultiplier),
    staggerDamage: attackData.staggerDamage * weaponMultiplier,
    isCritical: false,
  };
}
