/**
 * Typed event bus for decoupled system communication.
 * Systems emit events; other systems subscribe without direct imports.
 */

// ── Event payload definitions ──────────────────────────────────────

export interface GameEvents {
  PLAYER_DAMAGED: { amount: number; currentHP: number; sourceId?: string };
  ENEMY_DAMAGED: { enemyId: string; amount: number; currentHP: number; sourceId?: string; position: { x: number; y: number; z: number } };
  ENEMY_DIED: { enemyId: string; position: { x: number; y: number; z: number } };
  SHARD_COLLECTED: { amount: number; totalShards: number; position: { x: number; y: number; z: number } };
  ROOM_CLEARED: { roomId: string; roomCenter: { x: number; y: number; z: number } };
  PLAYER_DIED: {};
  RUN_STARTED: {};
  RUN_ENDED: { survived: boolean; shardsCollected: number };
  WEAPON_SWAPPED: { weaponId: string; weaponName: string };
  WEAPON_PICKUP_COLLECTED: { weaponId: string; weaponName: string; position: { x: number; y: number; z: number } };
}

// ── Types ──────────────────────────────────────────────────────────

export type GameEventName = keyof GameEvents;
type Callback<T> = (data: T) => void;

// ── EventBus ───────────────────────────────────────────────────────

export class EventBus {
  private listeners = new Map<GameEventName, Set<Callback<any>>>();

  /** Subscribe to a typed event. */
  on<E extends GameEventName>(event: E, callback: Callback<GameEvents[E]>): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(callback);
  }

  /** Unsubscribe from a typed event. */
  off<E extends GameEventName>(event: E, callback: Callback<GameEvents[E]>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /** Emit a typed event to all subscribers. */
  emit<E extends GameEventName>(event: E, data: GameEvents[E]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const cb of set) {
        cb(data);
      }
    }
  }

  /** Remove all listeners (useful for cleanup / dispose). */
  clear(): void {
    this.listeners.clear();
  }
}
