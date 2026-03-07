/**
 * UIManager — controls HUD visibility and manages UI layers.
 *
 * Show HUD during gameplay, hide during menus/transitions.
 */

import { HUD } from './HUD';

export type UIState = 'gameplay' | 'menu' | 'hidden';

export class UIManager {
  private state: UIState = 'gameplay';

  constructor(private hud: HUD) {}

  /** Set the UI state and update visibility accordingly. */
  setState(state: UIState): void {
    this.state = state;

    switch (state) {
      case 'gameplay':
        this.hud.show();
        break;
      case 'menu':
      case 'hidden':
        this.hud.hide();
        break;
    }
  }

  getState(): UIState {
    return this.state;
  }

  /** Call each frame — delegates to HUD update. */
  update(): void {
    if (this.state === 'gameplay') {
      this.hud.update();
    }
  }

  dispose(): void {
    this.hud.dispose();
  }
}
