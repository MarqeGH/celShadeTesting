/**
 * SettingsMenu — overlay with volume sliders and camera sensitivity.
 *
 * Opened from PauseMenu "Settings" button.
 * Changes apply immediately via callbacks. On close, persists via SaveManager.
 * "Reset to Defaults" restores DEFAULT_SETTINGS.
 */

import { DEFAULT_SETTINGS, type SaveSettings } from '../save/SaveSchema';

// ── Types ───────────────────────────────────────────────────────

export interface SettingsCallbacks {
  getMasterVolume: () => number;
  getSFXVolume: () => number;
  getMusicVolume: () => number;
  getCameraSensitivity: () => number;
  setMasterVolume: (v: number) => void;
  setSFXVolume: (v: number) => void;
  setMusicVolume: (v: number) => void;
  setCameraSensitivity: (v: number) => void;
  /** Persist current settings to save data. */
  persist: (settings: Partial<SaveSettings>) => void;
}

// ── CSS ─────────────────────────────────────────────────────────

const SETTINGS_STYLES = `
.settings-overlay {
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
  z-index: 95;
  pointer-events: all;
  font-family: 'Segoe UI', Arial, sans-serif;
  user-select: none;
  opacity: 0;
  transition: opacity 200ms ease-in;
}

.settings-overlay.visible {
  opacity: 1;
  background: rgba(0, 0, 0, 0.8);
}

.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 340px;
  max-width: 420px;
}

.settings-title {
  font-size: 36px;
  font-weight: 200;
  letter-spacing: 8px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.8);
  text-align: center;
  margin-bottom: 8px;
}

.settings-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings-row label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
}

.settings-slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.settings-slider {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.settings-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.7);
  border: none;
  cursor: pointer;
  transition: background 150ms;
}

.settings-slider::-webkit-slider-thumb:hover {
  background: #fff;
}

.settings-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.7);
  border: none;
  cursor: pointer;
}

.settings-value {
  font-size: 13px;
  font-family: monospace;
  color: rgba(255, 255, 255, 0.6);
  min-width: 36px;
  text-align: right;
}

.settings-buttons {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.settings-btn {
  flex: 1;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.8);
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.25);
  cursor: pointer;
  transition: border-color 200ms, color 200ms, background 200ms;
}

.settings-btn:hover {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.05);
}

.settings-btn:active {
  background: rgba(255, 255, 255, 0.1);
}

.settings-btn.reset {
  color: rgba(200, 160, 80, 0.8);
  border-color: rgba(200, 160, 80, 0.25);
}

.settings-btn.reset:hover {
  color: #c8a050;
  border-color: rgba(200, 160, 80, 0.6);
  background: rgba(200, 160, 80, 0.05);
}
`;

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = SETTINGS_STYLES;
  document.head.appendChild(style);
  stylesInjected = true;
}

// ── SettingsMenu class ──────────────────────────────────────────

export class SettingsMenu {
  private overlay: HTMLDivElement;
  private active = false;
  private callbacks: SettingsCallbacks;
  private onClose: () => void;

  // Slider + value label references for syncing
  private masterSlider!: HTMLInputElement;
  private masterValue!: HTMLSpanElement;
  private sfxSlider!: HTMLInputElement;
  private sfxValue!: HTMLSpanElement;
  private musicSlider!: HTMLInputElement;
  private musicValue!: HTMLSpanElement;
  private sensSlider!: HTMLInputElement;
  private sensValue!: HTMLSpanElement;

  constructor(
    container: HTMLElement,
    callbacks: SettingsCallbacks,
    onClose: () => void,
  ) {
    injectStyles();
    this.callbacks = callbacks;
    this.onClose = onClose;

    // Build DOM
    this.overlay = document.createElement('div');
    this.overlay.className = 'settings-overlay';
    this.overlay.style.display = 'none';

    const panel = document.createElement('div');
    panel.className = 'settings-panel';

    const title = document.createElement('div');
    title.className = 'settings-title';
    title.textContent = 'Settings';
    panel.appendChild(title);

    // ── Volume sliders ──

    const masterRow = this.createSlider('Master Volume', 0, 100, 1);
    this.masterSlider = masterRow.slider;
    this.masterValue = masterRow.valueEl;
    panel.appendChild(masterRow.row);

    const sfxRow = this.createSlider('SFX Volume', 0, 100, 1);
    this.sfxSlider = sfxRow.slider;
    this.sfxValue = sfxRow.valueEl;
    panel.appendChild(sfxRow.row);

    const musicRow = this.createSlider('Music Volume', 0, 100, 1);
    this.musicSlider = musicRow.slider;
    this.musicValue = musicRow.valueEl;
    panel.appendChild(musicRow.row);

    // ── Camera sensitivity slider ──

    const sensRow = this.createSlider('Camera Sensitivity', 10, 200, 1);
    this.sensSlider = sensRow.slider;
    this.sensValue = sensRow.valueEl;
    panel.appendChild(sensRow.row);

    // ── Buttons ──

    const buttons = document.createElement('div');
    buttons.className = 'settings-buttons';

    const resetBtn = document.createElement('button');
    resetBtn.className = 'settings-btn reset';
    resetBtn.textContent = 'Defaults';
    resetBtn.addEventListener('click', () => this.handleResetDefaults());
    buttons.appendChild(resetBtn);

    const backBtn = document.createElement('button');
    backBtn.className = 'settings-btn';
    backBtn.textContent = 'Back';
    backBtn.addEventListener('click', () => this.handleBack());
    buttons.appendChild(backBtn);

    panel.appendChild(buttons);
    this.overlay.appendChild(panel);
    container.appendChild(this.overlay);

    // ── Slider change handlers ──

    this.masterSlider.addEventListener('input', () => {
      const v = Number(this.masterSlider.value) / 100;
      this.callbacks.setMasterVolume(v);
      this.masterValue.textContent = this.masterSlider.value + '%';
    });

    this.sfxSlider.addEventListener('input', () => {
      const v = Number(this.sfxSlider.value) / 100;
      this.callbacks.setSFXVolume(v);
      this.sfxValue.textContent = this.sfxSlider.value + '%';
    });

    this.musicSlider.addEventListener('input', () => {
      const v = Number(this.musicSlider.value) / 100;
      this.callbacks.setMusicVolume(v);
      this.musicValue.textContent = this.musicSlider.value + '%';
    });

    this.sensSlider.addEventListener('input', () => {
      const v = Number(this.sensSlider.value) / 100;
      this.callbacks.setCameraSensitivity(v);
      this.sensValue.textContent = (v).toFixed(1);
    });
  }

  show(): void {
    if (this.active) return;
    this.active = true;

    // Sync sliders to current values
    this.masterSlider.value = String(Math.round(this.callbacks.getMasterVolume() * 100));
    this.masterValue.textContent = this.masterSlider.value + '%';

    this.sfxSlider.value = String(Math.round(this.callbacks.getSFXVolume() * 100));
    this.sfxValue.textContent = this.sfxSlider.value + '%';

    this.musicSlider.value = String(Math.round(this.callbacks.getMusicVolume() * 100));
    this.musicValue.textContent = this.musicSlider.value + '%';

    const sens = this.callbacks.getCameraSensitivity();
    this.sensSlider.value = String(Math.round(sens * 100));
    this.sensValue.textContent = sens.toFixed(1);

    this.overlay.style.display = '';
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

  // ── Private ───────────────────────────────────────────────────

  private handleBack(): void {
    if (!this.active) return;
    this.persistCurrentSettings();
    this.hide();
    this.onClose();
  }

  private handleResetDefaults(): void {
    // Apply default values immediately
    this.callbacks.setMasterVolume(DEFAULT_SETTINGS.masterVolume);
    this.callbacks.setSFXVolume(DEFAULT_SETTINGS.sfxVolume);
    this.callbacks.setMusicVolume(DEFAULT_SETTINGS.musicVolume);
    this.callbacks.setCameraSensitivity(DEFAULT_SETTINGS.cameraSensitivity);

    // Update sliders to reflect defaults
    this.masterSlider.value = String(Math.round(DEFAULT_SETTINGS.masterVolume * 100));
    this.masterValue.textContent = this.masterSlider.value + '%';

    this.sfxSlider.value = String(Math.round(DEFAULT_SETTINGS.sfxVolume * 100));
    this.sfxValue.textContent = this.sfxSlider.value + '%';

    this.musicSlider.value = String(Math.round(DEFAULT_SETTINGS.musicVolume * 100));
    this.musicValue.textContent = this.musicSlider.value + '%';

    const sens = DEFAULT_SETTINGS.cameraSensitivity;
    this.sensSlider.value = String(Math.round(sens * 100));
    this.sensValue.textContent = sens.toFixed(1);
  }

  private persistCurrentSettings(): void {
    this.callbacks.persist({
      masterVolume: Number(this.masterSlider.value) / 100,
      sfxVolume: Number(this.sfxSlider.value) / 100,
      musicVolume: Number(this.musicSlider.value) / 100,
      cameraSensitivity: Number(this.sensSlider.value) / 100,
    });
  }

  private createSlider(
    label: string,
    min: number,
    max: number,
    step: number,
  ): { row: HTMLDivElement; slider: HTMLInputElement; valueEl: HTMLSpanElement } {
    const row = document.createElement('div');
    row.className = 'settings-row';

    const lbl = document.createElement('label');
    lbl.textContent = label;
    row.appendChild(lbl);

    const sliderRow = document.createElement('div');
    sliderRow.className = 'settings-slider-row';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'settings-slider';
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    sliderRow.appendChild(slider);

    const valueEl = document.createElement('span');
    valueEl.className = 'settings-value';
    sliderRow.appendChild(valueEl);

    row.appendChild(sliderRow);

    return { row, slider, valueEl };
  }

  dispose(): void {
    this.overlay.remove();
  }
}
