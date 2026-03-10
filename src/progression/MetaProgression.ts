import { UnlockRegistry } from './UnlockRegistry';
import { SaveManager } from '../save/SaveManager';
import { PlayerStats, BASE_MAX_HP, BASE_MAX_STAMINA } from '../player/PlayerStats';

/** Maximum meta-progression bonus as a fraction of base stat value. */
const META_BONUS_CAP = 0.2; // +20%

export interface AppliedBonuses {
  maxHp: number;
  maxStamina: number;
}

/**
 * Reads purchased stat bonuses from SaveManager and applies them
 * to PlayerStats at the start of each run.
 * Caps total bonuses at +20% of base values.
 */
export class MetaProgression {
  private unlockRegistry: UnlockRegistry;
  private saveManager: SaveManager;
  private lastApplied: AppliedBonuses = { maxHp: 0, maxStamina: 0 };

  constructor(unlockRegistry: UnlockRegistry, saveManager: SaveManager) {
    this.unlockRegistry = unlockRegistry;
    this.saveManager = saveManager;
  }

  /**
   * Apply purchased stat bonuses to PlayerStats.
   * Call after PlayerStats.reset() at run start.
   */
  applyBonuses(stats: PlayerStats): void {
    const ownedIds = this.saveManager.getData().unlocks;

    // Sum raw bonuses by stat target
    const rawBonuses: Record<string, number> = {};
    for (const id of ownedIds) {
      const effect = this.unlockRegistry.getEffect(id);
      if (!effect || effect.type !== 'stat_bonus' || effect.value === undefined) continue;
      rawBonuses[effect.target] = (rawBonuses[effect.target] ?? 0) + effect.value;
    }

    // Cap bonuses at +20% of base values
    const maxHpCap = Math.floor(BASE_MAX_HP * META_BONUS_CAP);
    const maxStaminaCap = Math.floor(BASE_MAX_STAMINA * META_BONUS_CAP);

    const hpBonus = Math.min(rawBonuses['maxHp'] ?? 0, maxHpCap);
    const staminaBonus = Math.min(rawBonuses['maxStamina'] ?? 0, maxStaminaCap);

    this.lastApplied = { maxHp: hpBonus, maxStamina: staminaBonus };

    stats.applyMetaBonuses(hpBonus, staminaBonus);

    if (hpBonus > 0 || staminaBonus > 0) {
      console.log(
        `[MetaProgression] Applied bonuses: HP +${hpBonus} (cap ${maxHpCap}), ` +
        `Stamina +${staminaBonus} (cap ${maxStaminaCap})`,
      );
    }
  }

  /** Returns summary of last applied bonuses (for debug/UI). */
  getAppliedBonuses(): AppliedBonuses {
    return { ...this.lastApplied };
  }
}
