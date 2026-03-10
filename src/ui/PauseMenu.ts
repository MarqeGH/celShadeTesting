/**
 * PauseMenu — pause overlay with Resume, Settings (placeholder), and Quit Run.
 *
 * Shown when Escape is pressed during gameplay.
 * Resume returns to gameplay. Quit Run ends the run and restarts.
 */

// ── CSS injected once ──────────────────────────────────────────────

const PAUSE_STYLES = `
.pause-overlay {
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

.pause-overlay.visible {
  opacity: 1;
  background: rgba(0, 0, 0, 0.7);
}

.pause-title {
  font-size: 56px;
  font-weight: 200;
  letter-spacing: 12px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 48px;
}

.pause-buttons {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 200px;
}

.pause-btn {
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

.pause-btn:hover {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.05);
}

.pause-btn:active {
  background: rgba(255, 255, 255, 0.1);
}

.pause-btn.disabled {
  color: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.1);
  cursor: default;
  pointer-events: none;
}

.pause-btn.quit {
  color: rgba(192, 64, 64, 0.8);
  border-color: rgba(192, 64, 64, 0.25);
}

.pause-btn.quit:hover {
  color: #c04040;
  border-color: rgba(192, 64, 64, 0.6);
  background: rgba(192, 64, 64, 0.05);
}
`;

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = PAUSE_STYLES;
  document.head.appendChild(style);
  stylesInjected = true;
}

// ── PauseMenu class ──────────────────────────────────────────────

export class PauseMenu {
  private overlay: HTMLDivElement;
  private active = false;

  constructor(
    container: HTMLElement,
    private onResume: () => void,
    private onQuitRun: () => void,
    private onSettings?: () => void,
  ) {
    injectStyles();

    // Build DOM
    this.overlay = document.createElement('div');
    this.overlay.className = 'pause-overlay';
    this.overlay.style.display = 'none';

    const title = document.createElement('div');
    title.className = 'pause-title';
    title.textContent = 'Paused';
    this.overlay.appendChild(title);

    const buttons = document.createElement('div');
    buttons.className = 'pause-buttons';

    // Resume button
    const resumeBtn = document.createElement('button');
    resumeBtn.className = 'pause-btn';
    resumeBtn.textContent = 'Resume';
    resumeBtn.addEventListener('click', () => this.handleResume());
    buttons.appendChild(resumeBtn);

    // Settings button
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'pause-btn';
    settingsBtn.textContent = 'Settings';
    settingsBtn.addEventListener('click', () => this.handleSettings());
    buttons.appendChild(settingsBtn);

    // Quit Run button
    const quitBtn = document.createElement('button');
    quitBtn.className = 'pause-btn quit';
    quitBtn.textContent = 'Quit Run';
    quitBtn.addEventListener('click', () => this.handleQuitRun());
    buttons.appendChild(quitBtn);

    this.overlay.appendChild(buttons);
    container.appendChild(this.overlay);
  }

  show(): void {
    if (this.active) return;
    this.active = true;
    this.overlay.style.display = '';
    // Force reflow before adding visible class for CSS transition
    void this.overlay.offsetHeight;
    this.overlay.classList.add('visible');
  }

  hide(): void {
    this.overlay.classList.remove('visible');
    this.overlay.style.display = 'none';
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  private handleResume(): void {
    if (!this.active) return;
    this.onResume();
  }

  private handleQuitRun(): void {
    if (!this.active) return;
    this.onQuitRun();
  }

  private handleSettings(): void {
    if (!this.active) return;
    if (this.onSettings) {
      this.hide();
      this.onSettings();
    }
  }

  dispose(): void {
    this.overlay.remove();
  }
}
