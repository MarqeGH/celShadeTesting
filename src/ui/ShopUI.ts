/**
 * ShopUI — HTML/CSS overlay for the hub shop.
 *
 * Lists available unlocks with name, description, cost.
 * Handles purchase flow via SaveManager.
 * Follows PauseMenu overlay pattern.
 */

import { SaveManager } from '../save/SaveManager';
import { UnlockRegistry, type UnlockData } from '../progression/UnlockRegistry';

// ── CSS injected once ──────────────────────────────────────────────

const SHOP_STYLES = `
.shop-overlay {
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
  z-index: 90;
  pointer-events: all;
  font-family: 'Segoe UI', Arial, sans-serif;
  user-select: none;
  opacity: 0;
  transition: opacity 200ms ease-in;
}

.shop-overlay.visible {
  opacity: 1;
  background: rgba(0, 0, 0, 0.8);
}

.shop-panel {
  width: 420px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.shop-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 0 16px 0;
}

.shop-title {
  font-size: 32px;
  font-weight: 200;
  letter-spacing: 8px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.8);
}

.shop-balance {
  font-size: 18px;
  color: #e0d060;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
}

.shop-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  max-height: 50vh;
  padding-right: 4px;
}

.shop-list::-webkit-scrollbar {
  width: 4px;
}

.shop-list::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

.shop-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
}

.shop-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.03);
  transition: border-color 150ms;
}

.shop-item:hover {
  border-color: rgba(255, 255, 255, 0.25);
}

.shop-item.owned {
  border-color: rgba(80, 168, 64, 0.3);
  background: rgba(80, 168, 64, 0.05);
}

.shop-item.locked {
  opacity: 0.4;
}

.shop-item-info {
  flex: 1;
  min-width: 0;
}

.shop-item-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.shop-item-name {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.shop-item-tag {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 2px;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.08);
}

.shop-item-tag.weapon { color: #e08040; background: rgba(224, 128, 64, 0.12); }
.shop-item-tag.stat { color: #60c0e0; background: rgba(96, 192, 224, 0.12); }
.shop-item-tag.ability { color: #c080e0; background: rgba(192, 128, 224, 0.12); }
.shop-item-tag.cosmetic { color: #80e0a0; background: rgba(128, 224, 160, 0.12); }

.shop-item-desc {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  line-height: 1.3;
}

.shop-item-action {
  margin-left: 12px;
  flex-shrink: 0;
}

.shop-buy-btn {
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #e0d060;
  background: transparent;
  border: 1px solid rgba(224, 208, 96, 0.3);
  cursor: pointer;
  transition: border-color 200ms, color 200ms, background 200ms;
  pointer-events: all;
  white-space: nowrap;
}

.shop-buy-btn:hover {
  color: #fff;
  border-color: rgba(224, 208, 96, 0.7);
  background: rgba(224, 208, 96, 0.08);
}

.shop-buy-btn:active {
  background: rgba(224, 208, 96, 0.15);
}

.shop-buy-btn.cannot-afford {
  color: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.1);
  cursor: default;
  pointer-events: none;
}

.shop-owned-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: rgba(80, 168, 64, 0.8);
}

.shop-locked-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  font-style: italic;
}

.shop-close-btn {
  margin-top: 20px;
  align-self: center;
  padding: 10px 28px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: border-color 200ms, color 200ms, background 200ms;
  pointer-events: all;
}

.shop-close-btn:hover {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.05);
}
`;

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = SHOP_STYLES;
  document.head.appendChild(style);
  stylesInjected = true;
}

// ── ShopUI class ──────────────────────────────────────────────────

export class ShopUI {
  private overlay: HTMLDivElement;
  private balanceEl: HTMLSpanElement;
  private listEl: HTMLDivElement;
  private active = false;

  private saveManager: SaveManager | null = null;
  private unlockRegistry: UnlockRegistry | null = null;
  private onClose: () => void;

  private onEscapeHandler: (e: KeyboardEvent) => void;

  constructor(container: HTMLElement, onClose: () => void) {
    this.onClose = onClose;
    injectStyles();

    // Build DOM
    this.overlay = document.createElement('div');
    this.overlay.className = 'shop-overlay';
    this.overlay.style.display = 'none';

    const panel = document.createElement('div');
    panel.className = 'shop-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'shop-header';

    const title = document.createElement('div');
    title.className = 'shop-title';
    title.textContent = 'Shop';
    header.appendChild(title);

    this.balanceEl = document.createElement('span');
    this.balanceEl.className = 'shop-balance';
    this.balanceEl.textContent = '0';
    header.appendChild(this.balanceEl);

    panel.appendChild(header);

    // Item list
    this.listEl = document.createElement('div');
    this.listEl.className = 'shop-list';
    panel.appendChild(this.listEl);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'shop-close-btn';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => this.handleClose());
    panel.appendChild(closeBtn);

    this.overlay.appendChild(panel);
    container.appendChild(this.overlay);

    // Escape key handler
    this.onEscapeHandler = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && this.active) {
        e.stopPropagation();
        this.handleClose();
      }
    };
    // Use capture phase so shop Escape fires before Game.ts Escape
    window.addEventListener('keydown', this.onEscapeHandler, true);
  }

  /** Open the shop with current save + unlock state. */
  show(saveManager: SaveManager, unlockRegistry: UnlockRegistry): void {
    if (this.active) return;
    this.saveManager = saveManager;
    this.unlockRegistry = unlockRegistry;
    this.active = true;

    this.rebuildList();

    this.overlay.style.display = '';
    void this.overlay.offsetHeight;
    this.overlay.classList.add('visible');
  }

  hide(): void {
    this.overlay.classList.remove('visible');
    this.overlay.style.display = 'none';
    this.active = false;
    this.saveManager = null;
    this.unlockRegistry = null;
  }

  isActive(): boolean {
    return this.active;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onEscapeHandler, true);
    this.overlay.remove();
  }

  // ── Private ──────────────────────────────────────────────────

  private handleClose(): void {
    if (!this.active) return;
    this.hide();
    this.onClose();
  }

  private handlePurchase(unlockId: string): void {
    if (!this.saveManager || !this.unlockRegistry) return;

    const cost = this.unlockRegistry.getCost(unlockId);
    if (this.saveManager.spendCurrency(cost)) {
      this.saveManager.addUnlock(unlockId);
      this.rebuildList();
    }
  }

  private rebuildList(): void {
    if (!this.saveManager || !this.unlockRegistry) return;

    const saveData = this.saveManager.getData();
    const ownedSet = new Set(saveData.unlocks);
    const balance = saveData.metaCurrency;

    // Update balance display
    this.balanceEl.textContent = `${balance}`;

    // Clear list
    this.listEl.innerHTML = '';

    // Show all unlocks (owned, available, locked)
    const allUnlocks = this.unlockRegistry.getAll();

    for (const unlock of allUnlocks) {
      const isOwned = ownedSet.has(unlock.id);
      const hasPrereq = !unlock.prerequisite || ownedSet.has(unlock.prerequisite);
      const canAfford = balance >= unlock.cost;

      const item = document.createElement('div');
      item.className = 'shop-item';
      if (isOwned) item.classList.add('owned');
      if (!hasPrereq && !isOwned) item.classList.add('locked');

      // Info section
      const info = document.createElement('div');
      info.className = 'shop-item-info';

      const topRow = document.createElement('div');
      topRow.className = 'shop-item-top';

      const name = document.createElement('span');
      name.className = 'shop-item-name';
      name.textContent = unlock.name;
      topRow.appendChild(name);

      const tag = document.createElement('span');
      tag.className = `shop-item-tag ${unlock.category}`;
      tag.textContent = unlock.category;
      topRow.appendChild(tag);

      info.appendChild(topRow);

      const desc = document.createElement('div');
      desc.className = 'shop-item-desc';
      desc.textContent = unlock.description;
      info.appendChild(desc);

      item.appendChild(info);

      // Action section
      const action = document.createElement('div');
      action.className = 'shop-item-action';

      if (isOwned) {
        const owned = document.createElement('span');
        owned.className = 'shop-owned-label';
        owned.textContent = '\u2713 Owned';
        action.appendChild(owned);
      } else if (!hasPrereq) {
        const locked = document.createElement('span');
        locked.className = 'shop-locked-label';
        locked.textContent = 'Locked';
        action.appendChild(locked);
      } else {
        const btn = this.createBuyButton(unlock, canAfford);
        action.appendChild(btn);
      }

      item.appendChild(action);
      this.listEl.appendChild(item);
    }
  }

  private createBuyButton(unlock: UnlockData, canAfford: boolean): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'shop-buy-btn';
    btn.textContent = `${unlock.cost}`;
    if (!canAfford) {
      btn.classList.add('cannot-afford');
    } else {
      btn.addEventListener('click', () => this.handlePurchase(unlock.id));
    }
    return btn;
  }
}
