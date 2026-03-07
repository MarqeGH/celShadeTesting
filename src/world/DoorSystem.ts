import * as THREE from 'three';
import { EventBus } from '../app/EventBus';
import { InputManager } from '../app/InputManager';
import { RoomModule, ExitDoor } from './RoomModule';

/** Distance in meters at which the player can interact with a door */
const INTERACT_RANGE = 2.5;
/** Fade duration in seconds */
const FADE_DURATION = 0.5;

type DoorSystemState = 'idle' | 'fading_out' | 'loading' | 'fading_in';

/**
 * Callback invoked during a room transition.
 * Receives the exit door the player used.
 * Should unload the current room, load the next room,
 * and return the player entry position for the new room.
 */
export type RoomTransitionCallback = (exit: ExitDoor) => Promise<THREE.Vector3>;

/**
 * Manages door lock/unlock state and room-to-room transitions.
 *
 * - Listens for ROOM_CLEARED to unlock all exits in the current room.
 * - Each frame, checks if the player is near an unlocked door and pressing interact.
 * - On interact: fades to black, invokes transition callback, repositions player, fades in.
 */
export class DoorSystem {
  private eventBus: EventBus;
  private input: InputManager;
  private currentRoom: RoomModule | null = null;
  private state: DoorSystemState = 'idle';
  private fadeTimer = 0;
  private fadeOverlay: HTMLDivElement;
  private transitionCallback: RoomTransitionCallback | null = null;
  private pendingExit: ExitDoor | null = null;
  private playerPositionRef: THREE.Vector3 | null = null;

  // Prompt UI element
  private promptElement: HTMLDivElement;
  private promptVisible = false;

  // Scratch vector
  private readonly _doorDist = new THREE.Vector3();

  constructor(eventBus: EventBus, input: InputManager, container: HTMLElement) {
    this.eventBus = eventBus;
    this.input = input;

    // Create fade overlay (fullscreen black div)
    this.fadeOverlay = document.createElement('div');
    this.fadeOverlay.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;' +
      'background:#000;pointer-events:none;opacity:0;z-index:100;' +
      'transition:none;';
    container.appendChild(this.fadeOverlay);

    // Create door interact prompt
    this.promptElement = document.createElement('div');
    this.promptElement.style.cssText =
      'position:absolute;bottom:25%;left:50%;transform:translateX(-50%);' +
      'color:#fff;font-family:monospace;font-size:16px;padding:8px 16px;' +
      'background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.3);' +
      'border-radius:4px;pointer-events:none;opacity:0;z-index:50;' +
      'transition:opacity 0.15s ease;';
    this.promptElement.textContent = 'Press E to enter';
    container.appendChild(this.promptElement);

    // Listen for room cleared
    this.onRoomCleared = this.onRoomCleared.bind(this);
    this.eventBus.on('ROOM_CLEARED', this.onRoomCleared);
  }

  /**
   * Set the current room whose doors should be managed.
   */
  setRoom(room: RoomModule): void {
    this.currentRoom = room;
  }

  /**
   * Set the callback that handles room loading during transitions.
   */
  setTransitionCallback(callback: RoomTransitionCallback): void {
    this.transitionCallback = callback;
  }

  /**
   * Set a reference to the player position vector (for proximity checks).
   */
  setPlayerPosition(pos: THREE.Vector3): void {
    this.playerPositionRef = pos;
  }

  /**
   * Per-frame update. Handles proximity checks and fade transitions.
   */
  update(dt: number): void {
    if (this.state === 'fading_out') {
      this.fadeTimer += dt;
      const t = Math.min(this.fadeTimer / FADE_DURATION, 1);
      this.fadeOverlay.style.opacity = String(t);

      if (t >= 1) {
        this.state = 'loading';
        this.executeTransition();
      }
      return;
    }

    if (this.state === 'fading_in') {
      this.fadeTimer += dt;
      const t = Math.min(this.fadeTimer / FADE_DURATION, 1);
      this.fadeOverlay.style.opacity = String(1 - t);

      if (t >= 1) {
        this.fadeOverlay.style.opacity = '0';
        this.state = 'idle';
      }
      return;
    }

    if (this.state === 'loading') {
      // Waiting for async transition callback
      return;
    }

    // Idle: check for door interaction
    if (this.state === 'idle' && this.currentRoom && this.playerPositionRef) {
      const nearDoor = this.findNearestUnlockedDoor();
      if (nearDoor) {
        this.showPrompt(true);
        if (this.input.justPressed('interact')) {
          this.startTransition(nearDoor);
        }
      } else {
        this.showPrompt(false);
      }
    }
  }

  /**
   * Check if the system is in the middle of a transition.
   */
  isTransitioning(): boolean {
    return this.state !== 'idle';
  }

  dispose(): void {
    this.eventBus.off('ROOM_CLEARED', this.onRoomCleared);
    this.fadeOverlay.remove();
    this.promptElement.remove();
    this.currentRoom = null;
    this.transitionCallback = null;
  }

  // ── Private ──────────────────────────────────────────────────

  private onRoomCleared(_data: { roomId: string }): void {
    if (this.currentRoom) {
      this.currentRoom.unlockExits();
      console.log('[DoorSystem] Doors unlocked');
    }
  }

  private findNearestUnlockedDoor(): ExitDoor | null {
    if (!this.currentRoom || !this.playerPositionRef) return null;

    const exits = this.currentRoom.getExits();
    let nearest: ExitDoor | null = null;
    let nearestDist = INTERACT_RANGE;

    for (const exit of exits) {
      if (exit.locked) continue;

      this._doorDist.subVectors(exit.position, this.playerPositionRef);
      this._doorDist.y = 0; // XZ plane distance only
      const dist = this._doorDist.length();

      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = exit;
      }
    }

    return nearest;
  }

  private showPrompt(visible: boolean): void {
    if (visible === this.promptVisible) return;
    this.promptVisible = visible;
    this.promptElement.style.opacity = visible ? '1' : '0';
  }

  private startTransition(exit: ExitDoor): void {
    if (!this.transitionCallback) {
      console.warn('[DoorSystem] No transition callback set');
      return;
    }

    this.pendingExit = exit;
    this.state = 'fading_out';
    this.fadeTimer = 0;
    this.showPrompt(false);

    console.log(`[DoorSystem] Transitioning through ${exit.direction} door`);
  }

  private executeTransition(): void {
    if (!this.pendingExit || !this.transitionCallback) {
      this.state = 'idle';
      return;
    }

    const exit = this.pendingExit;
    this.pendingExit = null;

    this.transitionCallback(exit)
      .then((entryPosition) => {
        // Reposition player at new room entry
        if (this.playerPositionRef) {
          this.playerPositionRef.copy(entryPosition);
        }

        // Start fade in
        this.state = 'fading_in';
        this.fadeTimer = 0;
      })
      .catch((err) => {
        console.error('[DoorSystem] Room transition failed:', err);
        // Recover: fade back in to current state
        this.state = 'fading_in';
        this.fadeTimer = 0;
      });
  }
}
