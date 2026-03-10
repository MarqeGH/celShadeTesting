/**
 * UIManager — controls HUD visibility and manages UI layers.
 *
 * Show HUD during gameplay, hide during menus/transitions.
 */

import { HUD } from './HUD';
import { BossHealthBar } from './BossHealthBar';

export type UIState = 'title' | 'gameplay' | 'menu' | 'paused' | 'hidden' | 'hub';

export class UIManager {
  private state: UIState = 'gameplay';
  private bossBar: BossHealthBar | null = null;

  constructor(private hud: HUD) {}

  /** Register the boss health bar for state management. */
  setBossBar(bossBar: BossHealthBar): void {
    this.bossBar = bossBar;
  }

  /** Set the UI state and update visibility accordingly. */
  setState(state: UIState): void {
    this.state = state;

    switch (state) {
      case 'gameplay':
      case 'paused':
        // Keep HUD visible during pause (shows behind overlay)
        this.hud.show();
        this.hud.setCombatBarsVisible(true);
        // Boss bar persists — managed by its own show/hide logic
        break;
      case 'hub':
        // Show shard count only, hide HP/stamina/heal bars
        this.hud.show();
        this.hud.setCombatBarsVisible(false);
        // Hide boss bar in hub
        if (this.bossBar) this.bossBar.hide();
        break;
      case 'title':
      case 'menu':
      case 'hidden':
        this.hud.hide();
        if (this.bossBar) this.bossBar.hide();
        break;
    }
  }

  getState(): UIState {
    return this.state;
  }

  /** Call each frame — delegates to HUD update. */
  update(): void {
    if (this.state === 'gameplay' || this.state === 'hub') {
      this.hud.update();
    }
  }

  dispose(): void {
    this.hud.dispose();
    if (this.bossBar) {
      this.bossBar.dispose();
    }
  }
}
