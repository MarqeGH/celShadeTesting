import { EventBus } from '../app/EventBus';

/**
 * Full-width boss health bar at the bottom of the screen.
 * Shows boss name + HP bar with phase markers at 66% and 33%.
 * Appears on boss spawn, fades out on boss death.
 * All HTML/CSS overlay — no canvas rendering.
 */

/** Known boss IDs and display names */
const BOSS_NAMES: Record<string, string> = {
  'aggregate-boss': 'The Aggregate',
};

/** Boss IDs to detect in encounters */
const BOSS_IDS = new Set(Object.keys(BOSS_NAMES));

export class BossHealthBar {
  private container: HTMLElement;
  private eventBus: EventBus;

  private root: HTMLElement;
  private nameEl: HTMLElement;
  private barFill: HTMLElement;
  private barBg: HTMLElement;

  private activeBossId: string | null = null;
  private bossMaxHp = 0;
  private bossCurrentHp = 0;
  private visible = false;

  constructor(container: HTMLElement, eventBus: EventBus) {
    this.container = container;
    this.eventBus = eventBus;

    // Build DOM
    this.root = document.createElement('div');
    this.root.className = 'boss-bar-root';
    this.root.style.cssText = `
      position: absolute;
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%);
      width: 60%;
      max-width: 700px;
      z-index: 15;
      opacity: 0;
      transition: opacity 0.5s ease;
      pointer-events: none;
      display: none;
    `;

    // Boss name
    this.nameEl = document.createElement('div');
    this.nameEl.className = 'boss-bar-name';
    this.nameEl.style.cssText = `
      color: #cc3333;
      font-family: monospace;
      font-size: 14px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 2px;
      text-align: center;
      margin-bottom: 4px;
      text-shadow: 0 0 6px rgba(200, 50, 50, 0.6);
    `;

    // Bar background
    this.barBg = document.createElement('div');
    this.barBg.className = 'boss-bar-bg';
    this.barBg.style.cssText = `
      position: relative;
      width: 100%;
      height: 12px;
      background: #1a0a0a;
      border: 1px solid #442222;
      border-radius: 2px;
      overflow: hidden;
    `;

    // HP fill
    this.barFill = document.createElement('div');
    this.barFill.className = 'boss-bar-fill';
    this.barFill.style.cssText = `
      width: 100%;
      height: 100%;
      background: linear-gradient(180deg, #dd3333, #991111);
      transition: width 0.3s ease;
      border-radius: 1px;
    `;

    // Phase markers at 66% and 33%
    const marker66 = this.createMarker(66);
    const marker33 = this.createMarker(33);

    this.barBg.appendChild(this.barFill);
    this.barBg.appendChild(marker66);
    this.barBg.appendChild(marker33);
    this.root.appendChild(this.nameEl);
    this.root.appendChild(this.barBg);
    this.container.appendChild(this.root);

    // Subscribe to events
    this.eventBus.on('ENEMY_DAMAGED', this.onEnemyDamaged);
    this.eventBus.on('ENEMY_DIED', this.onEnemyDied);
  }

  /**
   * Notify the boss bar that a boss has spawned.
   * Call from EncounterManager or Game when a boss enemy is detected.
   */
  showBoss(bossId: string, maxHp: number): void {
    this.activeBossId = bossId;
    this.bossMaxHp = maxHp;
    this.bossCurrentHp = maxHp;

    this.nameEl.textContent = BOSS_NAMES[bossId] ?? 'BOSS';
    this.barFill.style.width = '100%';
    this.barFill.classList.remove('boss-bar-low');

    this.root.style.display = 'block';
    // Force reflow before opacity transition
    void this.root.offsetHeight;
    this.root.style.opacity = '1';
    this.visible = true;
  }

  /** Hide the boss bar (with fade). */
  hide(): void {
    if (!this.visible) return;
    this.root.style.opacity = '0';
    this.visible = false;
    setTimeout(() => {
      if (!this.visible) {
        this.root.style.display = 'none';
        this.activeBossId = null;
      }
    }, 500);
  }

  /** Check if a given enemy ID is a known boss. */
  static isBoss(enemyId: string): boolean {
    // Boss stringIds contain the boss type id
    for (const id of BOSS_IDS) {
      if (enemyId.includes(id)) return true;
    }
    return false;
  }

  // ── Event handlers ────────────────────────────────────────────

  private onEnemyDamaged = (data: { enemyId: string; amount: number; currentHP: number }): void => {
    if (!this.activeBossId) return;
    if (!data.enemyId.includes(this.activeBossId)) return;

    this.bossCurrentHp = Math.max(0, data.currentHP);
    const pct = this.bossMaxHp > 0 ? (this.bossCurrentHp / this.bossMaxHp) * 100 : 0;
    this.barFill.style.width = `${pct}%`;

    // Low HP pulse effect (<20%)
    if (pct < 20) {
      this.barFill.classList.add('boss-bar-low');
    } else {
      this.barFill.classList.remove('boss-bar-low');
    }
  };

  private onEnemyDied = (data: { enemyId: string }): void => {
    if (!this.activeBossId) return;
    if (!data.enemyId.includes(this.activeBossId)) return;
    this.hide();
  };

  // ── Helpers ───────────────────────────────────────────────────

  private createMarker(pct: number): HTMLElement {
    const marker = document.createElement('div');
    marker.style.cssText = `
      position: absolute;
      top: 0;
      left: ${pct}%;
      width: 1px;
      height: 100%;
      background: rgba(255, 255, 255, 0.4);
      pointer-events: none;
    `;
    return marker;
  }

  // ── Cleanup ───────────────────────────────────────────────────

  dispose(): void {
    this.eventBus.off('ENEMY_DAMAGED', this.onEnemyDamaged);
    this.eventBus.off('ENEMY_DIED', this.onEnemyDied);
    if (this.root.parentElement) {
      this.root.parentElement.removeChild(this.root);
    }
  }
}

// ── CSS animation for low HP pulse (injected once) ──────────────

const STYLE_ID = 'boss-bar-styles';
if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .boss-bar-low {
      animation: boss-pulse 0.6s ease-in-out infinite alternate;
    }
    @keyframes boss-pulse {
      from { background: linear-gradient(180deg, #dd3333, #991111); }
      to   { background: linear-gradient(180deg, #ff5555, #cc2222); box-shadow: 0 0 8px rgba(255, 50, 50, 0.5); }
    }
  `;
  document.head.appendChild(style);
}
