import * as THREE from 'three';
import { InputManager } from '../app/InputManager';
import { EventBus } from '../app/EventBus';
import { BaseEnemy } from '../enemies/BaseEnemy';

// ── Constants ────────────────────────────────────────────────────

/** Maximum lock-on distance in meters */
const LOCK_ON_RANGE = 15;

/** Forward cone half-angle for initial acquisition (degrees) */
const ACQUISITION_CONE_DEG = 60;
const ACQUISITION_CONE_RAD = THREE.MathUtils.degToRad(ACQUISITION_CONE_DEG);

/** Minimum horizontal mouse flick to trigger target switch */
const SWITCH_FLICK_THRESHOLD = 40;

// ── LockOnSystem ─────────────────────────────────────────────────

/**
 * Manages lock-on targeting for the camera and combat systems.
 *
 * On lock-on input: finds nearest enemy within range and forward cone.
 * While locked: camera focuses between player and target. Lock drops
 * if the target dies or exits range. Flicking mouse horizontally
 * while locked switches to the next valid target in that direction.
 */
export class LockOnSystem {
  private input: InputManager;
  private eventBus: EventBus;

  /** Function that returns current alive enemies */
  private getEnemies: () => BaseEnemy[];

  /** Currently locked target (null = no lock) */
  private target: BaseEnemy | null = null;

  /** UI indicator element */
  private indicator: HTMLDivElement | null = null;
  private container: HTMLElement | null = null;
  private camera: THREE.PerspectiveCamera | null = null;

  /** Event handler refs for cleanup */
  private onEnemyDied: (data: { enemyId: string }) => void;

  constructor(
    input: InputManager,
    eventBus: EventBus,
    getEnemies: () => BaseEnemy[],
  ) {
    this.input = input;
    this.eventBus = eventBus;
    this.getEnemies = getEnemies;

    // Listen for enemy deaths to drop lock if our target dies
    this.onEnemyDied = (data) => {
      if (this.target && this.target.stringId === data.enemyId) {
        this.dropLock();
      }
    };
    this.eventBus.on('ENEMY_DIED', this.onEnemyDied);
  }

  /**
   * Attach the UI indicator overlay to a container element.
   * Call once during setup.
   */
  attachUI(container: HTMLElement, camera: THREE.PerspectiveCamera): void {
    this.container = container;
    this.camera = camera;

    this.indicator = document.createElement('div');
    this.indicator.className = 'lock-on-indicator';
    this.indicator.style.cssText = `
      position: absolute;
      width: 40px;
      height: 40px;
      pointer-events: none;
      display: none;
      z-index: 10;
    `;
    // Diamond shape via rotated border
    const diamond = document.createElement('div');
    diamond.style.cssText = `
      width: 100%;
      height: 100%;
      border: 2px solid #ff4444;
      transform: rotate(45deg);
      box-sizing: border-box;
      animation: lock-on-pulse 1s ease-in-out infinite;
    `;
    this.indicator.appendChild(diamond);

    // Add pulse animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes lock-on-pulse {
        0%, 100% { opacity: 0.8; transform: rotate(45deg) scale(1); }
        50% { opacity: 1; transform: rotate(45deg) scale(1.15); }
      }
    `;
    container.appendChild(style);
    container.appendChild(this.indicator);
  }

  /**
   * Per-frame update. Handles toggle, switching, range checks, and UI.
   */
  update(
    playerPosition: THREE.Vector3,
    cameraYaw: number,
  ): void {
    // Toggle lock-on
    if (this.input.justPressed('lockOn')) {
      if (this.target) {
        this.dropLock();
      } else {
        this.acquireTarget(playerPosition, cameraYaw);
      }
    }

    if (!this.target) return;

    // Drop if target is dead
    if (this.target.isDead()) {
      this.dropLock();
      return;
    }

    // Drop if target is out of range
    const dist = _toTarget.subVectors(this.target.getPosition(), playerPosition);
    dist.y = 0;
    if (dist.length() > LOCK_ON_RANGE) {
      this.dropLock();
      return;
    }

    // Target switching via mouse flick
    const dx = this.input.mouseDeltaX;
    if (Math.abs(dx) > SWITCH_FLICK_THRESHOLD) {
      this.switchTarget(playerPosition, cameraYaw, dx > 0 ? 'right' : 'left');
    }

    // Update UI indicator position
    this.updateIndicator();
  }

  /** Whether lock-on is currently active */
  isLocked(): boolean {
    return this.target !== null;
  }

  /** Get the locked target's position (or null) */
  getTargetPosition(): THREE.Vector3 | null {
    if (!this.target || this.target.isDead()) return null;
    return this.target.getPosition();
  }

  /** Get the locked target (or null) */
  getTarget(): BaseEnemy | null {
    return this.target;
  }

  /** Forcefully drop lock (e.g. on room transition) */
  dropLock(): void {
    this.target = null;
    if (this.indicator) {
      this.indicator.style.display = 'none';
    }
  }

  dispose(): void {
    this.eventBus.off('ENEMY_DIED', this.onEnemyDied);
    this.dropLock();
    if (this.indicator) {
      this.indicator.remove();
      this.indicator = null;
    }
  }

  // ── Private ──────────────────────────────────────────────────

  /**
   * Find the nearest alive enemy within range and forward cone.
   */
  private acquireTarget(playerPos: THREE.Vector3, cameraYaw: number): void {
    const enemies = this.getEnemies();
    if (enemies.length === 0) return;

    // Camera forward direction on XZ plane
    const fwd = _fwd.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));

    let bestEnemy: BaseEnemy | null = null;
    let bestDist = Infinity;

    for (const enemy of enemies) {
      if (enemy.isDead()) continue;

      const toEnemy = _toTarget.subVectors(enemy.getPosition(), playerPos);
      toEnemy.y = 0;
      const dist = toEnemy.length();

      if (dist > LOCK_ON_RANGE || dist < 0.1) continue;

      // Check forward cone
      toEnemy.normalize();
      const dot = fwd.dot(toEnemy);
      if (dot < Math.cos(ACQUISITION_CONE_RAD)) continue;

      if (dist < bestDist) {
        bestDist = dist;
        bestEnemy = enemy;
      }
    }

    if (bestEnemy) {
      this.target = bestEnemy;
      if (this.indicator) {
        this.indicator.style.display = 'block';
      }
    }
  }

  /**
   * Switch to the nearest valid target in the given screen direction.
   */
  private switchTarget(
    playerPos: THREE.Vector3,
    cameraYaw: number,
    direction: 'left' | 'right',
  ): void {
    if (!this.target) return;

    const enemies = this.getEnemies();
    if (enemies.length < 2) return;

    // Camera right direction
    const camRight = _camRight.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));

    const currentPos = this.target.getPosition();
    let bestEnemy: BaseEnemy | null = null;
    let bestScore = Infinity;

    for (const enemy of enemies) {
      if (enemy === this.target) continue;
      if (enemy.isDead()) continue;

      const toEnemy = _toTarget.subVectors(enemy.getPosition(), playerPos);
      toEnemy.y = 0;
      const dist = toEnemy.length();
      if (dist > LOCK_ON_RANGE || dist < 0.1) continue;

      // Determine if this enemy is in the desired direction relative to current target
      const toCandidate = _toCandidate.subVectors(enemy.getPosition(), currentPos);
      toCandidate.y = 0;
      const screenX = camRight.dot(toCandidate);

      // Must be in the right direction
      if (direction === 'right' && screenX <= 0) continue;
      if (direction === 'left' && screenX >= 0) continue;

      // Score: prefer closest in the desired direction
      if (dist < bestScore) {
        bestScore = dist;
        bestEnemy = enemy;
      }
    }

    if (bestEnemy) {
      this.target = bestEnemy;
    }
  }

  /**
   * Update the screen-space position of the lock-on indicator.
   */
  private updateIndicator(): void {
    if (!this.indicator || !this.target || !this.camera || !this.container) return;

    const pos = this.target.getPosition();
    _screenPos.copy(pos);
    _screenPos.y += 1.5; // above enemy center
    _screenPos.project(this.camera);

    // Convert from NDC [-1,1] to pixel coords
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const x = ((_screenPos.x + 1) / 2) * w;
    const y = ((1 - _screenPos.y) / 2) * h;

    // Hide if behind camera
    if (_screenPos.z > 1) {
      this.indicator.style.display = 'none';
      return;
    }

    this.indicator.style.display = 'block';
    this.indicator.style.left = `${x - 20}px`;
    this.indicator.style.top = `${y - 20}px`;
  }
}

// ── Scratch vectors ──────────────────────────────────────────────

const _toTarget = new THREE.Vector3();
const _toCandidate = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _screenPos = new THREE.Vector3();
