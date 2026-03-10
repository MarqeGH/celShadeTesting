/**
 * HUD — HTML/CSS overlay displaying HP, Stamina, Heal charges, and Shard count.
 *
 * All elements are absolutely positioned HTML divs on top of the Three.js canvas.
 * Bars animate smoothly via CSS transitions.
 * Subscribes to EventBus for shard/damage events; polls PlayerStats each frame for stamina/HP.
 */

import { EventBus } from '../app/EventBus';
import { PlayerStats } from '../player/PlayerStats';
import type { WeaponSystem } from '../combat/WeaponSystem';

// ── CSS injected once ──────────────────────────────────────────────

const HUD_STYLES = `
.hud-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  font-family: 'Segoe UI', Arial, sans-serif;
  user-select: none;
  z-index: 10;
}

/* ── Left panel: HP, Stamina, Heal charges ── */

.hud-left {
  position: absolute;
  top: 20px;
  left: 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Bar container */
.hud-bar {
  position: relative;
  width: 200px;
  height: 16px;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.hud-bar-fill {
  height: 100%;
  transition: width 0.25s ease-out;
}

.hud-bar-hp .hud-bar-fill {
  background: #c44040;
}

.hud-bar-stamina .hud-bar-fill {
  background: #50a840;
}

.hud-bar-stamina.exhausted .hud-bar-fill {
  background: #806030;
}

.hud-bar-label {
  position: absolute;
  top: 0;
  left: 6px;
  line-height: 16px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.7);
  text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.8);
}

/* Heal charges */
.hud-heals {
  display: flex;
  gap: 4px;
  margin-top: 2px;
}

.hud-heal-charge {
  width: 14px;
  height: 14px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: #3080d0;
}

.hud-heal-charge.empty {
  background: rgba(0, 0, 0, 0.4);
}

/* ── Right panel: Shard count ── */

.hud-right {
  position: absolute;
  top: 20px;
  right: 20px;
  text-align: right;
}

.hud-shards {
  font-size: 18px;
  color: #e0d060;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
}

.hud-shards-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.8);
}

/* ── Bottom-right: Weapon indicator ── */

.hud-weapon {
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.hud-weapon-slot {
  display: flex;
  align-items: center;
  gap: 8px;
  transition: opacity 200ms;
}

.hud-weapon-slot.secondary {
  opacity: 0.35;
}

.hud-weapon-slot.secondary .hud-weapon-icon {
  width: 22px;
  height: 10px;
}

.hud-weapon-slot.secondary .hud-weapon-name {
  font-size: 10px;
}

.hud-weapon-icon {
  width: 30px;
  height: 14px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.hud-weapon-name {
  font-size: 12px;
  font-family: 'Segoe UI Semibold', 'Segoe UI', Arial, sans-serif;
  font-stretch: condensed;
  color: rgba(255, 255, 255, 0.5);
  text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.8);
  letter-spacing: 0.5px;
}

@keyframes hud-weapon-flash {
  0% { opacity: 1; filter: brightness(2); }
  100% { opacity: 1; filter: brightness(1); }
}

.hud-weapon-slot.flash {
  animation: hud-weapon-flash 0.35s ease-out;
}

/* ── Top-center: Room progress ── */

.hud-room-progress {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.4s ease-in-out;
}

.hud-room-progress.visible {
  opacity: 1;
}

.hud-room-progress.dimmed {
  opacity: 0.25;
}

.hud-room-zone-name {
  font-size: 10px;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
  text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.8);
}

.hud-room-dots {
  display: flex;
  gap: 8px;
  align-items: center;
}

.hud-room-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.4);
  background: transparent;
  transition: background 0.3s, border-color 0.3s;
}

.hud-room-dot.cleared {
  background: rgba(160, 160, 160, 0.6);
  border-color: rgba(160, 160, 160, 0.6);
}

.hud-room-dot.current {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(255, 255, 255, 0.9);
}
`;

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = HUD_STYLES;
  document.head.appendChild(style);
  stylesInjected = true;
}

// ── HUD class ──────────────────────────────────────────────────────

export class HUD {
  private root: HTMLDivElement;
  private leftPanel!: HTMLDivElement;
  private hpFill: HTMLDivElement;
  private staminaFill: HTMLDivElement;
  private staminaBar: HTMLDivElement;
  private healContainer: HTMLDivElement;
  private shardsValue: HTMLSpanElement;

  private shardCount = 0;
  private lastHealCharges = -1;

  // Weapon indicator
  private weaponContainer: HTMLDivElement;
  private primarySlot: HTMLDivElement;
  private primaryIcon: HTMLDivElement;
  private primaryName: HTMLSpanElement;
  private secondarySlot: HTMLDivElement;
  private secondaryIcon: HTMLDivElement;
  private secondaryName: HTMLSpanElement;
  private weaponSystem: WeaponSystem | null = null;
  private lastPrimaryId = '';
  private lastSecondaryId = '';

  // Room progress
  private roomProgressContainer: HTMLDivElement;
  private roomDotsContainer: HTMLDivElement;
  private roomZoneLabel: HTMLDivElement;
  private roomDots: HTMLDivElement[] = [];
  private roomProgressCurrent = 0;
  private roomFadeShowTime = 0;
  private roomFadeActive = false;

  private onShardCollected: (data: { amount: number; totalShards: number; position: { x: number; y: number; z: number } }) => void;
  private onWeaponSwapped: (data: { weaponId: string; weaponName: string }) => void;
  private onRoomCleared: () => void;

  constructor(
    private stats: PlayerStats,
    private eventBus: EventBus,
  ) {
    injectStyles();

    // Build DOM
    this.root = document.createElement('div');
    this.root.className = 'hud-container';

    // ── Left panel ──
    const left = document.createElement('div');
    left.className = 'hud-left';

    // HP bar
    const hpBar = document.createElement('div');
    hpBar.className = 'hud-bar hud-bar-hp';
    const hpLabel = document.createElement('span');
    hpLabel.className = 'hud-bar-label';
    hpLabel.textContent = 'HP';
    this.hpFill = document.createElement('div');
    this.hpFill.className = 'hud-bar-fill';
    this.hpFill.style.width = '100%';
    hpBar.appendChild(this.hpFill);
    hpBar.appendChild(hpLabel);
    left.appendChild(hpBar);

    // Stamina bar
    this.staminaBar = document.createElement('div');
    this.staminaBar.className = 'hud-bar hud-bar-stamina';
    const staminaLabel = document.createElement('span');
    staminaLabel.className = 'hud-bar-label';
    staminaLabel.textContent = 'ST';
    this.staminaFill = document.createElement('div');
    this.staminaFill.className = 'hud-bar-fill';
    this.staminaFill.style.width = '100%';
    this.staminaBar.appendChild(this.staminaFill);
    this.staminaBar.appendChild(staminaLabel);
    left.appendChild(this.staminaBar);

    // Heal charges
    this.healContainer = document.createElement('div');
    this.healContainer.className = 'hud-heals';
    left.appendChild(this.healContainer);

    this.leftPanel = left;
    this.root.appendChild(left);

    // ── Right panel ──
    const right = document.createElement('div');
    right.className = 'hud-right';

    const shardsLabel = document.createElement('div');
    shardsLabel.className = 'hud-shards-label';
    shardsLabel.textContent = 'SHARDS';
    right.appendChild(shardsLabel);

    const shardsDiv = document.createElement('div');
    shardsDiv.className = 'hud-shards';
    this.shardsValue = document.createElement('span');
    this.shardsValue.textContent = '0';
    shardsDiv.appendChild(this.shardsValue);
    right.appendChild(shardsDiv);

    this.root.appendChild(right);

    // ── Weapon indicator (bottom-right) ──
    this.weaponContainer = document.createElement('div');
    this.weaponContainer.className = 'hud-weapon';

    // Primary slot
    this.primarySlot = document.createElement('div');
    this.primarySlot.className = 'hud-weapon-slot';
    this.primaryName = document.createElement('span');
    this.primaryName.className = 'hud-weapon-name';
    this.primaryIcon = document.createElement('div');
    this.primaryIcon.className = 'hud-weapon-icon';
    this.primarySlot.appendChild(this.primaryName);
    this.primarySlot.appendChild(this.primaryIcon);
    this.weaponContainer.appendChild(this.primarySlot);

    // Secondary slot
    this.secondarySlot = document.createElement('div');
    this.secondarySlot.className = 'hud-weapon-slot secondary';
    this.secondarySlot.style.display = 'none';
    this.secondaryName = document.createElement('span');
    this.secondaryName.className = 'hud-weapon-name';
    this.secondaryIcon = document.createElement('div');
    this.secondaryIcon.className = 'hud-weapon-icon';
    this.secondarySlot.appendChild(this.secondaryName);
    this.secondarySlot.appendChild(this.secondaryIcon);
    this.weaponContainer.appendChild(this.secondarySlot);

    this.root.appendChild(this.weaponContainer);

    // ── Room progress (top-center) ──
    this.roomProgressContainer = document.createElement('div');
    this.roomProgressContainer.className = 'hud-room-progress';

    this.roomZoneLabel = document.createElement('div');
    this.roomZoneLabel.className = 'hud-room-zone-name';
    this.roomProgressContainer.appendChild(this.roomZoneLabel);

    this.roomDotsContainer = document.createElement('div');
    this.roomDotsContainer.className = 'hud-room-dots';
    this.roomProgressContainer.appendChild(this.roomDotsContainer);

    this.root.appendChild(this.roomProgressContainer);

    // Subscribe to events
    this.onShardCollected = (data) => {
      this.shardCount = data.totalShards;
      this.shardsValue.textContent = String(this.shardCount);
    };
    this.eventBus.on('SHARD_COLLECTED', this.onShardCollected);

    this.onWeaponSwapped = () => {
      this.syncWeaponIndicator();
      // Play flash animation on primary
      this.primarySlot.classList.remove('flash');
      void this.primarySlot.offsetHeight; // reflow to restart animation
      this.primarySlot.classList.add('flash');
    };
    this.eventBus.on('WEAPON_SWAPPED', this.onWeaponSwapped);

    this.onRoomCleared = () => {
      // Mark current room as cleared and advance
      if (this.roomProgressCurrent < this.roomDots.length) {
        this.roomDots[this.roomProgressCurrent].className = 'hud-room-dot cleared';
      }
      this.roomProgressCurrent++;
      if (this.roomProgressCurrent < this.roomDots.length) {
        this.roomDots[this.roomProgressCurrent].className = 'hud-room-dot current';
      }
      // Re-show at full opacity then fade
      this.showRoomProgress();
    };
    this.eventBus.on('ROOM_CLEARED', this.onRoomCleared);

    // Initial heal charge render
    this.rebuildHealCharges();
  }

  /** Attach HUD DOM to the given container element. */
  attach(container: HTMLElement): void {
    container.appendChild(this.root);
  }

  /** Call each frame to sync bar widths with current stats. */
  update(): void {
    const hpPct = (this.stats.hp / this.stats.maxHp) * 100;
    this.hpFill.style.width = `${hpPct}%`;

    const stPct = (this.stats.stamina / this.stats.maxStamina) * 100;
    this.staminaFill.style.width = `${stPct}%`;

    // Exhaustion visual feedback
    if (this.stats.exhausted) {
      this.staminaBar.classList.add('exhausted');
    } else {
      this.staminaBar.classList.remove('exhausted');
    }

    // Rebuild heal charge icons only when count changes
    if (this.stats.healCharges !== this.lastHealCharges) {
      this.lastHealCharges = this.stats.healCharges;
      this.rebuildHealCharges();
    }

    // Room progress fade: dim after 3 seconds
    if (this.roomFadeActive && performance.now() - this.roomFadeShowTime > 3000) {
      this.roomProgressContainer.classList.add('dimmed');
      this.roomFadeActive = false;
    }
  }

  private rebuildHealCharges(): void {
    this.healContainer.innerHTML = '';
    const max = 3; // MAX_HEAL_CHARGES from PlayerStats
    for (let i = 0; i < max; i++) {
      const charge = document.createElement('div');
      charge.className = 'hud-heal-charge';
      if (i >= this.stats.healCharges) {
        charge.classList.add('empty');
      }
      this.healContainer.appendChild(charge);
    }
  }

  /** Set reference to weapon system for reading equipped weapons. */
  setWeaponSystem(ws: WeaponSystem): void {
    this.weaponSystem = ws;
    this.syncWeaponIndicator();
  }

  /** Toggle HP/stamina/heal visibility (hidden in hub, shown in gameplay). */
  setCombatBarsVisible(visible: boolean): void {
    this.leftPanel.style.display = visible ? '' : 'none';
  }

  /**
   * Set room progress for the current zone run.
   * Called when a new run starts or a new room is loaded.
   */
  setRoomProgress(currentIndex: number, totalRooms: number, zoneName: string): void {
    this.roomProgressCurrent = currentIndex;

    // Zone name
    const prettyName = zoneName.replace(/-/g, ' ');
    this.roomZoneLabel.textContent = prettyName;

    // Rebuild dots
    this.roomDotsContainer.innerHTML = '';
    this.roomDots = [];
    for (let i = 0; i < totalRooms; i++) {
      const dot = document.createElement('div');
      if (i < currentIndex) {
        dot.className = 'hud-room-dot cleared';
      } else if (i === currentIndex) {
        dot.className = 'hud-room-dot current';
      } else {
        dot.className = 'hud-room-dot';
      }
      this.roomDotsContainer.appendChild(dot);
      this.roomDots.push(dot);
    }

    this.showRoomProgress();
  }

  /** Hide room progress (e.g. when returning to hub). */
  hideRoomProgress(): void {
    this.roomProgressContainer.classList.remove('visible', 'dimmed');
    this.roomFadeActive = false;
  }

  private showRoomProgress(): void {
    this.roomProgressContainer.classList.remove('dimmed');
    this.roomProgressContainer.classList.add('visible');
    this.roomFadeShowTime = performance.now();
    this.roomFadeActive = true;
  }

  show(): void {
    this.root.style.display = '';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  get visible(): boolean {
    return this.root.style.display !== 'none';
  }

  /** Sync weapon indicator with current equipped/secondary weapon. */
  private syncWeaponIndicator(): void {
    if (!this.weaponSystem) return;

    const primary = this.weaponSystem.getEquipped();
    if (primary.id !== this.lastPrimaryId) {
      this.lastPrimaryId = primary.id;
      this.primaryName.textContent = primary.name;
      this.primaryIcon.style.background = weaponColor(primary.id);
    }

    const secondary = this.weaponSystem.getSecondary();
    if (secondary) {
      if (secondary.id !== this.lastSecondaryId) {
        this.lastSecondaryId = secondary.id;
        this.secondaryName.textContent = secondary.name;
        this.secondaryIcon.style.background = weaponColor(secondary.id);
      }
      this.secondarySlot.style.display = '';
    } else {
      this.secondarySlot.style.display = 'none';
      this.lastSecondaryId = '';
    }
  }

  dispose(): void {
    this.eventBus.off('SHARD_COLLECTED', this.onShardCollected);
    this.eventBus.off('WEAPON_SWAPPED', this.onWeaponSwapped);
    this.eventBus.off('ROOM_CLEARED', this.onRoomCleared);
    this.root.remove();
  }
}

// ── Weapon color lookup ─────────────────────────────────────────

const WEAPON_COLORS: Record<string, string> = {
  'fracture-blade': '#6088c0',
  'edge-spike': '#c06060',
  'void-needle': '#9060c0',
  'prism-cleaver': '#60c090',
};

function weaponColor(weaponId: string): string {
  return WEAPON_COLORS[weaponId] ?? '#808080';
}
