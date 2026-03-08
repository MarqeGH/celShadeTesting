import { EventBus } from '../app/EventBus';

/**
 * Tracks all state for the current roguelike run.
 * Listens to game events to auto-update counters.
 * Emits RUN_STARTED / RUN_ENDED via EventBus.
 */

export interface ActiveBuff {
  id: string;
  duration: number; // remaining seconds, -1 = permanent for run
}

export interface RunRewards {
  shardsCollected: number;
  shardsKept: number;
  roomsCleared: number;
  enemiesKilled: number;
}

export class RunState {
  // Current run tracking
  currentZone: string = '';
  currentRoomIndex: number = 0;
  totalShards: number = 0;
  equippedWeaponId: string = 'fist';
  activeBuffs: ActiveBuff[] = [];
  healCharges: number = 3;
  roomsCleared: number = 0;
  enemiesKilled: number = 0;

  private running: boolean = false;
  private eventBus: EventBus;

  // Bound handlers for cleanup
  private onEnemyDied = (): void => { this.enemiesKilled++; };
  private onRoomCleared = (): void => { this.roomsCleared++; };
  private onShardCollected = (data: { amount: number }): void => { this.totalShards += data.amount; };

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /** Whether a run is currently active. */
  isRunning(): boolean {
    return this.running;
  }

  /** Reset all state and begin a new run. */
  startRun(zone: string = 'void-corridors'): void {
    this.currentZone = zone;
    this.currentRoomIndex = 0;
    this.totalShards = 0;
    this.equippedWeaponId = 'fist';
    this.activeBuffs = [];
    this.healCharges = 3;
    this.roomsCleared = 0;
    this.enemiesKilled = 0;
    this.running = true;

    this.subscribe();
    this.eventBus.emit('RUN_STARTED', {});
  }

  /** End the current run and calculate rewards. Returns reward summary. */
  endRun(survived: boolean = false): RunRewards {
    this.unsubscribe();
    this.running = false;

    const shardsKept = survived
      ? this.totalShards
      : Math.floor(this.totalShards * 0.5);

    const rewards: RunRewards = {
      shardsCollected: this.totalShards,
      shardsKept,
      roomsCleared: this.roomsCleared,
      enemiesKilled: this.enemiesKilled,
    };

    this.eventBus.emit('RUN_ENDED', {
      survived,
      shardsCollected: this.totalShards,
    });

    return rewards;
  }

  /** Advance to the next room in the current zone. */
  advanceRoom(): void {
    this.currentRoomIndex++;
  }

  /** Use a heal charge. Returns true if a charge was available. */
  useHealCharge(): boolean {
    if (this.healCharges <= 0) return false;
    this.healCharges--;
    return true;
  }

  /** Add a buff for the current run. */
  addBuff(id: string, duration: number = -1): void {
    // Replace existing buff of same id
    this.activeBuffs = this.activeBuffs.filter(b => b.id !== id);
    this.activeBuffs.push({ id, duration });
  }

  /** Remove a buff by id. */
  removeBuff(id: string): void {
    this.activeBuffs = this.activeBuffs.filter(b => b.id !== id);
  }

  /** Check if a buff is active. */
  hasBuff(id: string): boolean {
    return this.activeBuffs.some(b => b.id === id);
  }

  private subscribe(): void {
    this.eventBus.on('ENEMY_DIED', this.onEnemyDied);
    this.eventBus.on('ROOM_CLEARED', this.onRoomCleared);
    this.eventBus.on('SHARD_COLLECTED', this.onShardCollected);
  }

  private unsubscribe(): void {
    this.eventBus.off('ENEMY_DIED', this.onEnemyDied);
    this.eventBus.off('ROOM_CLEARED', this.onRoomCleared);
    this.eventBus.off('SHARD_COLLECTED', this.onShardCollected);
  }

  dispose(): void {
    if (this.running) {
      this.unsubscribe();
    }
  }
}
