/**
 * WeaponData — shape of weapon JSON files in data/weapons/*.json.
 * Loaded by WeaponSystem, consumed by attack states for damage, range, timing, etc.
 */

export interface HitboxSizeData {
  radius: number;
  angle: number;
}

export interface WeaponData {
  id: string;
  name: string;
  description: string;
  baseDamage: number;
  heavyMultiplier: number;
  attackSpeed: number;
  range: number;
  staggerDamage: number;
  comboHits: number;
  staminaCostLight: number;
  staminaCostHeavy: number;
  hitboxShape: string;
  hitboxSize: HitboxSizeData;
  unlockCost: number;
}
