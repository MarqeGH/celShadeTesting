/**
 * HUD — HTML/CSS overlay displaying HP, Stamina, Heal charges, and Shard count.
 *
 * All elements are absolutely positioned HTML divs on top of the Three.js canvas.
 * Bars animate smoothly via CSS transitions.
 * Subscribes to EventBus for shard/damage events; polls PlayerStats each frame for stamina/HP.
 */

import { EventBus } from '../app/EventBus';
import { PlayerStats } from '../player/PlayerStats';

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
  private hpFill: HTMLDivElement;
  private staminaFill: HTMLDivElement;
  private staminaBar: HTMLDivElement;
  private healContainer: HTMLDivElement;
  private shardsValue: HTMLSpanElement;

  private shardCount = 0;
  private lastHealCharges = -1;

  private onShardCollected: (data: { amount: number; totalShards: number; position: { x: number; y: number; z: number } }) => void;

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

    // Subscribe to events
    this.onShardCollected = (data) => {
      this.shardCount = data.totalShards;
      this.shardsValue.textContent = String(this.shardCount);
    };
    this.eventBus.on('SHARD_COLLECTED', this.onShardCollected);

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

  show(): void {
    this.root.style.display = '';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  get visible(): boolean {
    return this.root.style.display !== 'none';
  }

  dispose(): void {
    this.eventBus.off('SHARD_COLLECTED', this.onShardCollected);
    this.root.remove();
  }
}
