/**
 * MenuSystem — death screen overlay.
 *
 * Listens for PLAYER_DIED, shows "Collapsed" screen with run stats,
 * and provides a "Return to Hub" button that ends the run and restarts.
 */

import { EventBus } from '../app/EventBus';
import { RunState, type RunRewards } from '../progression/RunState';

// ── CSS injected once ──────────────────────────────────────────────

const MENU_STYLES = `
.death-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0);
  z-index: 100;
  pointer-events: all;
  font-family: 'Segoe UI', Arial, sans-serif;
  user-select: none;
  opacity: 0;
  transition: opacity 500ms ease-in;
}

.death-overlay.visible {
  opacity: 1;
  background: rgba(0, 0, 0, 0.75);
}

.death-title {
  font-size: 64px;
  font-weight: 200;
  letter-spacing: 16px;
  text-transform: uppercase;
  color: #c04040;
  margin-bottom: 48px;
  text-shadow: 0 0 20px rgba(192, 64, 64, 0.4);
}

.death-stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 48px;
  min-width: 240px;
}

.death-stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 8px;
}

.death-stat-value {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.death-stat-row.kept .death-stat-value {
  color: #e0d060;
}

.death-divider {
  width: 240px;
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 8px 0;
}

.death-return-btn {
  padding: 12px 32px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.8);
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.25);
  cursor: pointer;
  transition: border-color 200ms, color 200ms, background 200ms;
  pointer-events: all;
}

.death-return-btn:hover {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.05);
}

.death-return-btn:active {
  background: rgba(255, 255, 255, 0.1);
}
`;

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = MENU_STYLES;
  document.head.appendChild(style);
  stylesInjected = true;
}

// ── MenuSystem class ──────────────────────────────────────────────

export class MenuSystem {
  private overlay: HTMLDivElement;
  private statsContainer: HTMLDivElement;
  private returnBtn: HTMLButtonElement;
  private active = false;

  private onPlayerDied: () => void;
  private onReturnClick: () => void;

  constructor(
    container: HTMLElement,
    private eventBus: EventBus,
    private runState: RunState,
    private onReturnToHub: () => void,
  ) {
    injectStyles();

    // Build DOM
    this.overlay = document.createElement('div');
    this.overlay.className = 'death-overlay';
    this.overlay.style.display = 'none';

    const title = document.createElement('div');
    title.className = 'death-title';
    title.textContent = 'Collapsed';
    this.overlay.appendChild(title);

    this.statsContainer = document.createElement('div');
    this.statsContainer.className = 'death-stats';
    this.overlay.appendChild(this.statsContainer);

    this.returnBtn = document.createElement('button');
    this.returnBtn.className = 'death-return-btn';
    this.returnBtn.textContent = 'Return to Hub';
    this.overlay.appendChild(this.returnBtn);

    container.appendChild(this.overlay);

    // Event handlers
    this.onPlayerDied = () => this.showDeathScreen();
    this.onReturnClick = () => this.handleReturn();

    this.eventBus.on('PLAYER_DIED', this.onPlayerDied);
    this.returnBtn.addEventListener('click', this.onReturnClick);
  }

  private showDeathScreen(): void {
    if (this.active) return;
    this.active = true;

    // End the run and get rewards
    const rewards = this.runState.endRun(false);
    this.populateStats(rewards);

    // Show overlay with fade-in
    this.overlay.style.display = '';
    // Force reflow before adding visible class for CSS transition
    void this.overlay.offsetHeight;
    this.overlay.classList.add('visible');
  }

  private populateStats(rewards: RunRewards): void {
    this.statsContainer.innerHTML = '';

    const rows: Array<{ label: string; value: string; className?: string }> = [
      { label: 'Rooms Cleared', value: String(rewards.roomsCleared) },
      { label: 'Enemies Killed', value: String(rewards.enemiesKilled) },
      { label: 'Shards Collected', value: String(rewards.shardsCollected) },
      { label: 'Shards Kept (50%)', value: String(rewards.shardsKept), className: 'kept' },
    ];

    for (const row of rows) {
      const el = document.createElement('div');
      el.className = 'death-stat-row';
      if (row.className) el.classList.add(row.className);

      const label = document.createElement('span');
      label.textContent = row.label;

      const value = document.createElement('span');
      value.className = 'death-stat-value';
      value.textContent = row.value;

      el.appendChild(label);
      el.appendChild(value);
      this.statsContainer.appendChild(el);
    }
  }

  private handleReturn(): void {
    if (!this.active) return;
    this.hide();
    this.onReturnToHub();
  }

  hide(): void {
    this.overlay.classList.remove('visible');
    this.overlay.style.display = 'none';
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  dispose(): void {
    this.eventBus.off('PLAYER_DIED', this.onPlayerDied);
    this.returnBtn.removeEventListener('click', this.onReturnClick);
    this.overlay.remove();
  }
}
