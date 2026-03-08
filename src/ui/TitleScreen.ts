/**
 * TitleScreen — HTML/CSS overlay shown on game launch.
 *
 * Displays game title, subtitle, and "press any key" prompt over
 * the Three.js scene (slowly rotating empty arena). On key press,
 * fades out and fires a callback to start gameplay.
 */

// ── CSS injected once ──────────────────────────────────────────────

const TITLE_STYLES = `
.title-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  z-index: 150;
  pointer-events: all;
  font-family: 'Segoe UI', Arial, sans-serif;
  user-select: none;
  opacity: 1;
  transition: opacity 500ms ease-out;
}

.title-overlay.fade-out {
  opacity: 0;
  pointer-events: none;
}

.title-name {
  font-size: 72px;
  font-weight: 100;
  letter-spacing: 24px;
  text-transform: uppercase;
  color: #c0c0c0;
  margin-bottom: 16px;
  text-shadow: 0 0 30px rgba(192, 192, 192, 0.2);
}

.title-subtitle {
  font-size: 16px;
  font-weight: 300;
  letter-spacing: 4px;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 80px;
}

.title-prompt {
  font-size: 14px;
  font-weight: 400;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
  animation: title-pulse 2s ease-in-out infinite;
}

@keyframes title-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.8; }
}
`;

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = TITLE_STYLES;
  document.head.appendChild(style);
  stylesInjected = true;
}

// ── TitleScreen class ──────────────────────────────────────────────

export class TitleScreen {
  private overlay: HTMLDivElement;
  private active = true;
  private onKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private onMouseDown: ((e: MouseEvent) => void) | null = null;

  constructor(
    container: HTMLElement,
    private onStart: () => void,
  ) {
    injectStyles();

    // Build DOM
    this.overlay = document.createElement('div');
    this.overlay.className = 'title-overlay';

    const title = document.createElement('div');
    title.className = 'title-name';
    title.textContent = 'Celtest';
    this.overlay.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.className = 'title-subtitle';
    subtitle.textContent = 'A world of collapsed forms';
    this.overlay.appendChild(subtitle);

    const prompt = document.createElement('div');
    prompt.className = 'title-prompt';
    prompt.textContent = 'Press any key to start';
    this.overlay.appendChild(prompt);

    container.appendChild(this.overlay);

    // Listen for any key or click to start
    this.onKeyDown = (e: KeyboardEvent) => {
      // Ignore modifier keys alone and repeats
      if (e.repeat) return;
      this.handleStart();
    };

    this.onMouseDown = () => {
      this.handleStart();
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('mousedown', this.onMouseDown);
  }

  private handleStart(): void {
    if (!this.active) return;
    this.active = false;

    // Remove listeners immediately
    this.removeListeners();

    // Fade out
    this.overlay.classList.add('fade-out');

    // After fade, remove overlay and fire callback
    setTimeout(() => {
      this.overlay.remove();
      this.onStart();
    }, 500);
  }

  private removeListeners(): void {
    if (this.onKeyDown) {
      window.removeEventListener('keydown', this.onKeyDown);
      this.onKeyDown = null;
    }
    if (this.onMouseDown) {
      window.removeEventListener('mousedown', this.onMouseDown);
      this.onMouseDown = null;
    }
  }

  isActive(): boolean {
    return this.active;
  }

  dispose(): void {
    this.removeListeners();
    this.overlay.remove();
  }
}
