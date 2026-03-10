/**
 * ControlsOverlay — semi-transparent panel showing keybindings.
 *
 * Auto-shows on first run (checks SaveManager tutorialShown flag).
 * Toggleable with F1 key. Dismiss with any key.
 */

// ── CSS ─────────────────────────────────────────────────────────

const CONTROLS_STYLES = `
.controls-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  z-index: 85;
  pointer-events: all;
  font-family: 'Segoe UI', Arial, sans-serif;
  user-select: none;
  opacity: 0;
  transition: opacity 200ms ease-in;
}

.controls-overlay.visible {
  opacity: 1;
}

.controls-panel {
  background: rgba(10, 10, 15, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 28px 36px;
  min-width: 280px;
}

.controls-title {
  font-size: 18px;
  font-weight: 200;
  letter-spacing: 6px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
  margin-bottom: 20px;
}

.controls-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.controls-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
}

.controls-key {
  font-size: 12px;
  font-family: monospace;
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 2px 8px;
  min-width: 40px;
  text-align: center;
}

.controls-action {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 1px;
}

.controls-hint {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.25);
  text-align: center;
  margin-top: 20px;
  letter-spacing: 1px;
}
`;

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = CONTROLS_STYLES;
  document.head.appendChild(style);
  stylesInjected = true;
}

// ── Keybinding data ─────────────────────────────────────────────

const CONTROLS: Array<[string, string]> = [
  ['WASD', 'Move'],
  ['Shift', 'Sprint'],
  ['Space', 'Dodge'],
  ['LMB', 'Light Attack'],
  ['RMB', 'Heavy Attack (hold)'],
  ['Q', 'Parry'],
  ['R', 'Heal'],
  ['Tab', 'Lock-On'],
  ['E', 'Interact'],
  ['V', 'Swap Weapon'],
  ['M', 'Toggle Audio'],
  ['Esc', 'Pause'],
];

// ── ControlsOverlay class ───────────────────────────────────────

export class ControlsOverlay {
  private overlay: HTMLDivElement;
  private active = false;
  private onDismissFirstTime: (() => void) | null;
  private firstTimeShown: boolean;

  private onKeyDown = (e: KeyboardEvent): void => {
    // F1 toggles
    if (e.code === 'F1') {
      e.preventDefault();
      if (this.active) {
        this.hide();
      } else {
        this.show();
      }
      return;
    }
    // Any other key dismisses if active
    if (this.active) {
      this.hide();
    }
  };

  constructor(
    container: HTMLElement,
    autoShow: boolean,
    onDismissFirstTime: (() => void) | null,
  ) {
    injectStyles();
    this.onDismissFirstTime = onDismissFirstTime;
    this.firstTimeShown = autoShow;

    // Build DOM
    this.overlay = document.createElement('div');
    this.overlay.className = 'controls-overlay';
    this.overlay.style.display = 'none';

    const panel = document.createElement('div');
    panel.className = 'controls-panel';

    const title = document.createElement('div');
    title.className = 'controls-title';
    title.textContent = 'Controls';
    panel.appendChild(title);

    const list = document.createElement('div');
    list.className = 'controls-list';

    for (const [key, action] of CONTROLS) {
      const row = document.createElement('div');
      row.className = 'controls-row';

      const keyEl = document.createElement('span');
      keyEl.className = 'controls-key';
      keyEl.textContent = key;
      row.appendChild(keyEl);

      const actionEl = document.createElement('span');
      actionEl.className = 'controls-action';
      actionEl.textContent = action;
      row.appendChild(actionEl);

      list.appendChild(row);
    }

    panel.appendChild(list);

    const hint = document.createElement('div');
    hint.className = 'controls-hint';
    hint.textContent = 'Press any key to dismiss \u2022 F1 to toggle';
    panel.appendChild(hint);

    this.overlay.appendChild(panel);
    container.appendChild(this.overlay);

    window.addEventListener('keydown', this.onKeyDown);

    // Auto-show for new players
    if (autoShow) {
      this.show();
    }
  }

  show(): void {
    if (this.active) return;
    this.active = true;
    this.overlay.style.display = '';
    void this.overlay.offsetHeight;
    this.overlay.classList.add('visible');
  }

  hide(): void {
    if (!this.active) return;
    this.overlay.classList.remove('visible');
    this.overlay.style.display = 'none';
    this.active = false;

    // Notify on first dismissal to persist tutorialShown flag
    if (this.firstTimeShown && this.onDismissFirstTime) {
      this.firstTimeShown = false;
      this.onDismissFirstTime();
    }
  }

  isActive(): boolean {
    return this.active;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.overlay.remove();
  }
}
