/**
 * StaggerSystem — centralized poise management for all combat entities.
 *
 * Tracks poise per entity. When stagger damage is applied and poise reaches 0,
 * the onPoiseBreak callback fires (triggering the FSM stagger state).
 * Poise regens after a configurable delay.
 *
 * Stagger duration is managed by each entity's FSM stagger state, not here.
 */

// ── Poise configuration ──────────────────────────────────────────

export interface PoiseConfig {
  maxPoise: number;
  regenDelay: number;  // seconds before poise starts recovering
  regenRate: number;   // poise per second
}

// ── Internal entry per entity ────────────────────────────────────

interface PoiseEntry {
  current: number;
  max: number;
  regenDelay: number;
  regenRate: number;
  regenTimer: number;
  onPoiseBreak: (() => void) | null;
}

// ── Player poise defaults ────────────────────────────────────────

export const PLAYER_POISE_CONFIG: PoiseConfig = {
  maxPoise: 60,
  regenDelay: 1.0,
  regenRate: 20,
};

// ── StaggerSystem ────────────────────────────────────────────────

export class StaggerSystem {
  private entries = new Map<number, PoiseEntry>();

  /**
   * Register an entity's poise with the system.
   * onPoiseBreak is called when poise reaches 0 (trigger stagger in FSM).
   */
  register(
    entityId: number,
    config: PoiseConfig,
    onPoiseBreak?: () => void,
  ): void {
    this.entries.set(entityId, {
      current: config.maxPoise,
      max: config.maxPoise,
      regenDelay: config.regenDelay,
      regenRate: config.regenRate,
      regenTimer: 0,
      onPoiseBreak: onPoiseBreak ?? null,
    });
  }

  /** Remove an entity from poise tracking (on death or dispose). */
  unregister(entityId: number): void {
    this.entries.delete(entityId);
  }

  /**
   * Apply stagger damage to an entity's poise.
   * Returns true if poise broke (entity enters stagger state).
   */
  applyStaggerDamage(entityId: number, amount: number): boolean {
    const entry = this.entries.get(entityId);
    if (!entry) return false;

    entry.current -= amount;
    entry.regenTimer = 0;

    if (entry.current <= 0) {
      // Poise broke — reset to max and trigger stagger
      entry.current = entry.max;
      entry.onPoiseBreak?.();
      return true;
    }

    return false;
  }

  /** Get poise values for an entity (for debug/UI display). */
  getPoise(entityId: number): { current: number; max: number } | null {
    const entry = this.entries.get(entityId);
    if (!entry) return null;
    return { current: entry.current, max: entry.max };
  }

  /**
   * Per-frame update. Handles poise regen for all registered entities.
   */
  update(dt: number): void {
    for (const entry of this.entries.values()) {
      if (entry.current >= entry.max) continue;

      entry.regenTimer += dt;
      if (entry.regenTimer >= entry.regenDelay) {
        entry.current = Math.min(
          entry.max,
          entry.current + entry.regenRate * dt,
        );
      }
    }
  }

  /** Remove all entries. */
  clear(): void {
    this.entries.clear();
  }
}
