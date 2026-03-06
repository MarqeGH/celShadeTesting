/**
 * InputManager — maps keyboard + mouse input to game actions.
 * Poll-based: call update() once per frame before reading state.
 * Includes a 150ms input buffer for attack queuing.
 */

// ── Action definitions ────────────────────────────────────────────

export type GameAction =
  | 'moveForward'
  | 'moveBack'
  | 'moveLeft'
  | 'moveRight'
  | 'sprint'
  | 'dodge'
  | 'lightAttack'
  | 'heavyAttack'
  | 'parry'
  | 'heal'
  | 'lockOn'
  | 'swapWeapon'
  | 'pause';

// ── Key / button binding types ────────────────────────────────────

interface KeyBinding {
  type: 'keyboard';
  code: string;
}

interface MouseBinding {
  type: 'mouse';
  button: number; // 0 = left, 1 = middle, 2 = right
}

type Binding = KeyBinding | MouseBinding;

// ── Default bindings ──────────────────────────────────────────────

const DEFAULT_BINDINGS: Record<GameAction, Binding[]> = {
  moveForward:  [{ type: 'keyboard', code: 'KeyW' }],
  moveBack:     [{ type: 'keyboard', code: 'KeyS' }],
  moveLeft:     [{ type: 'keyboard', code: 'KeyA' }],
  moveRight:    [{ type: 'keyboard', code: 'KeyD' }],
  sprint:       [{ type: 'keyboard', code: 'ShiftLeft' }, { type: 'keyboard', code: 'ShiftRight' }],
  dodge:        [{ type: 'keyboard', code: 'Space' }],
  lightAttack:  [{ type: 'mouse', button: 0 }],
  heavyAttack:  [{ type: 'mouse', button: 2 }],
  parry:        [{ type: 'keyboard', code: 'KeyQ' }],
  heal:         [{ type: 'keyboard', code: 'KeyR' }],
  lockOn:       [{ type: 'keyboard', code: 'Tab' }, { type: 'mouse', button: 1 }],
  swapWeapon:   [{ type: 'keyboard', code: 'KeyF' }],
  pause:        [{ type: 'keyboard', code: 'Escape' }],
};

// ── Buffered action entry ─────────────────────────────────────────

interface BufferedAction {
  action: GameAction;
  timestamp: number;
}

// ── Input buffer duration ─────────────────────────────────────────

const INPUT_BUFFER_MS = 150;

// ── InputManager ──────────────────────────────────────────────────

export class InputManager {
  private bindings: Record<GameAction, Binding[]>;

  // Raw hardware state
  private keysDown = new Set<string>();
  private mouseDown = new Set<number>();

  // Per-frame edge detection
  private keysJustDown = new Set<string>();
  private keysJustUp = new Set<string>();
  private mouseJustDown = new Set<number>();
  private mouseJustUp = new Set<number>();

  // Queues filled by event handlers, consumed on update()
  private keyDownQueue: string[] = [];
  private keyUpQueue: string[] = [];
  private mouseDownQueue: number[] = [];
  private mouseUpQueue: number[] = [];

  // Mouse movement (consumed each frame)
  private _mouseDeltaX = 0;
  private _mouseDeltaY = 0;

  // Input buffer for attack queuing
  private buffer: BufferedAction[] = [];

  // Bound event handlers (for cleanup)
  private handleKeyDown: (e: KeyboardEvent) => void;
  private handleKeyUp: (e: KeyboardEvent) => void;
  private handleMouseDown: (e: MouseEvent) => void;
  private handleMouseUp: (e: MouseEvent) => void;
  private handleMouseMove: (e: MouseEvent) => void;
  private handleContextMenu: (e: Event) => void;

  constructor(bindings?: Partial<Record<GameAction, Binding[]>>) {
    this.bindings = { ...DEFAULT_BINDINGS, ...bindings } as Record<GameAction, Binding[]>;

    // Create bound handlers
    this.handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      this.keyDownQueue.push(e.code);
    };

    this.handleKeyUp = (e: KeyboardEvent) => {
      this.keyUpQueue.push(e.code);
    };

    this.handleMouseDown = (e: MouseEvent) => {
      this.mouseDownQueue.push(e.button);
    };

    this.handleMouseUp = (e: MouseEvent) => {
      this.mouseUpQueue.push(e.button);
    };

    this.handleMouseMove = (e: MouseEvent) => {
      this._mouseDeltaX += e.movementX;
      this._mouseDeltaY += e.movementY;
    };

    this.handleContextMenu = (e: Event) => {
      e.preventDefault();
    };

    // Attach listeners
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('contextmenu', this.handleContextMenu);
  }

  /**
   * Call once per frame at the start of the update tick.
   * Processes queued events and updates edge-detection sets.
   */
  update(): void {
    // Clear previous frame's edge state
    this.keysJustDown.clear();
    this.keysJustUp.clear();
    this.mouseJustDown.clear();
    this.mouseJustUp.clear();

    // Process keyboard queues
    for (const code of this.keyDownQueue) {
      if (!this.keysDown.has(code)) {
        this.keysJustDown.add(code);
      }
      this.keysDown.add(code);
    }
    for (const code of this.keyUpQueue) {
      if (this.keysDown.has(code)) {
        this.keysJustUp.add(code);
      }
      this.keysDown.delete(code);
    }

    // Process mouse queues
    for (const button of this.mouseDownQueue) {
      if (!this.mouseDown.has(button)) {
        this.mouseJustDown.add(button);
      }
      this.mouseDown.add(button);
    }
    for (const button of this.mouseUpQueue) {
      if (this.mouseDown.has(button)) {
        this.mouseJustUp.add(button);
      }
      this.mouseDown.delete(button);
    }

    // Clear queues
    this.keyDownQueue.length = 0;
    this.keyUpQueue.length = 0;
    this.mouseDownQueue.length = 0;
    this.mouseUpQueue.length = 0;

    // Buffer justPressed actions
    const now = performance.now();
    for (const action of Object.keys(this.bindings) as GameAction[]) {
      if (this.justPressed(action)) {
        this.buffer.push({ action, timestamp: now });
      }
    }

    // Expire old buffer entries
    this.buffer = this.buffer.filter(
      (entry) => now - entry.timestamp < INPUT_BUFFER_MS
    );
  }

  /** True while the action's key/button is held down. */
  isPressed(action: GameAction): boolean {
    return this.bindings[action].some((b) => this.isBindingHeld(b));
  }

  /** True only on the frame the key/button went down. */
  justPressed(action: GameAction): boolean {
    return this.bindings[action].some((b) => this.isBindingJustDown(b));
  }

  /** True only on the frame the key/button was released. */
  justReleased(action: GameAction): boolean {
    return this.bindings[action].some((b) => this.isBindingJustUp(b));
  }

  /**
   * Consume a buffered action if one exists.
   * Returns true if the action was in the buffer (and removes it).
   * Useful for attack queuing — check `consumeBuffer('lightAttack')` when
   * the player exits a recovery state.
   */
  consumeBuffer(action: GameAction): boolean {
    const idx = this.buffer.findIndex((entry) => entry.action === action);
    if (idx !== -1) {
      this.buffer.splice(idx, 1);
      return true;
    }
    return false;
  }

  /** Check if any buffered entry exists for the given action. */
  hasBuffered(action: GameAction): boolean {
    return this.buffer.some((entry) => entry.action === action);
  }

  /** Mouse movement delta since last frame. Reset after reading. */
  get mouseDeltaX(): number {
    return this._mouseDeltaX;
  }

  get mouseDeltaY(): number {
    return this._mouseDeltaY;
  }

  /** Call at end of frame to reset mouse deltas. */
  resetMouseDelta(): void {
    this._mouseDeltaX = 0;
    this._mouseDeltaY = 0;
  }

  /** Cleanup all event listeners. */
  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('contextmenu', this.handleContextMenu);
  }

  // ── Private helpers ───────────────────────────────────────────────

  private isBindingHeld(binding: Binding): boolean {
    if (binding.type === 'keyboard') return this.keysDown.has(binding.code);
    return this.mouseDown.has(binding.button);
  }

  private isBindingJustDown(binding: Binding): boolean {
    if (binding.type === 'keyboard') return this.keysJustDown.has(binding.code);
    return this.mouseJustDown.has(binding.button);
  }

  private isBindingJustUp(binding: Binding): boolean {
    if (binding.type === 'keyboard') return this.keysJustUp.has(binding.code);
    return this.mouseJustUp.has(binding.button);
  }
}
