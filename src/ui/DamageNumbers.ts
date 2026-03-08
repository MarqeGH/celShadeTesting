/**
 * DamageNumbers — floating damage number UI.
 *
 * On ENEMY_DAMAGED / PLAYER_DAMAGED events, shows a number rising and fading
 * at the damaged entity's screen-projected position.
 *
 * DOM elements are pooled to avoid allocation during combat.
 * Uses CSS animations for the rise + fade effect.
 */

import * as THREE from 'three';
import { EventBus } from '../app/EventBus';
import { ObjectPool } from '../engine/ObjectPool';

// ── Constants ────────────────────────────────────────────────────

const POOL_SIZE = 20;
const FLOAT_DURATION_MS = 800;
const FLOAT_RISE_PX = 60;

// ── Styles (injected once) ──────────────────────────────────────

const DMG_STYLES = `
.dmg-number {
  position: absolute;
  pointer-events: none;
  font-family: 'Segoe UI', Arial, sans-serif;
  font-weight: bold;
  font-size: 20px;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.9), -1px -1px 2px rgba(0,0,0,0.5);
  white-space: nowrap;
  opacity: 0;
  transform: translate(-50%, -50%);
  z-index: 15;
  will-change: transform, opacity;
}

.dmg-number.active {
  animation: dmg-float ${FLOAT_DURATION_MS}ms ease-out forwards;
}

@keyframes dmg-float {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) translateY(0);
  }
  70% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) translateY(-${FLOAT_RISE_PX}px);
  }
}
`;

let dmgStylesInjected = false;

function injectDmgStyles(): void {
  if (dmgStylesInjected) return;
  const style = document.createElement('style');
  style.textContent = DMG_STYLES;
  document.head.appendChild(style);
  dmgStylesInjected = true;
}

// ── DamageNumbers class ─────────────────────────────────────────

export class DamageNumbers {
  private container: HTMLElement;
  private camera: THREE.PerspectiveCamera;
  private pool: ObjectPool<HTMLDivElement>;

  // Reusable Three.js vector for projection
  private _projVec = new THREE.Vector3();

  // Event handler references for cleanup
  private onEnemyDamaged: (data: { enemyId: string; amount: number; currentHP: number; sourceId?: string; position: { x: number; y: number; z: number } }) => void;
  private onPlayerDamaged: (data: { amount: number; currentHP: number; sourceId?: string }) => void;

  constructor(
    container: HTMLElement,
    camera: THREE.PerspectiveCamera,
    private eventBus: EventBus,
    private playerPositionFn: () => THREE.Vector3,
  ) {
    this.container = container;
    this.camera = camera;

    injectDmgStyles();

    // Pre-warm DOM element pool
    this.pool = new ObjectPool<HTMLDivElement>(
      () => {
        const el = document.createElement('div');
        el.className = 'dmg-number';
        this.container.appendChild(el);
        return el;
      },
      (el) => {
        el.classList.remove('active');
        el.textContent = '';
      },
      POOL_SIZE,
    );

    // Subscribe to damage events
    this.onEnemyDamaged = (data) => {
      this.spawn(data.position.x, data.position.y + 1.5, data.position.z, data.amount, 'enemy');
    };
    this.onPlayerDamaged = (data) => {
      const pos = this.playerPositionFn();
      this.spawn(pos.x, pos.y + 1.5, pos.z, data.amount, 'player');
    };

    this.eventBus.on('ENEMY_DAMAGED', this.onEnemyDamaged);
    this.eventBus.on('PLAYER_DAMAGED', this.onPlayerDamaged);
  }

  /**
   * Spawn a floating damage number at a world position.
   */
  private spawn(
    worldX: number,
    worldY: number,
    worldZ: number,
    amount: number,
    type: 'enemy' | 'player',
  ): void {
    // Project world position to screen
    this._projVec.set(worldX, worldY, worldZ);
    this._projVec.project(this.camera);

    // Behind camera check
    if (this._projVec.z > 1) return;

    const screenX = (this._projVec.x * 0.5 + 0.5) * this.container.clientWidth;
    const screenY = (-this._projVec.y * 0.5 + 0.5) * this.container.clientHeight;

    // Add small random horizontal offset to prevent stacking
    const offsetX = (Math.random() - 0.5) * 30;

    // Acquire a pooled element
    const el = this.pool.acquire();

    // Set color based on type
    if (type === 'player') {
      el.style.color = '#ff4444'; // red for player damage
    } else {
      el.style.color = '#ffffff'; // white for normal enemy damage
    }

    el.textContent = String(Math.round(amount));
    el.style.left = `${screenX + offsetX}px`;
    el.style.top = `${screenY}px`;

    // Force reflow then start animation
    void el.offsetWidth;
    el.classList.add('active');

    // Release back to pool after animation
    setTimeout(() => {
      this.pool.release(el);
    }, FLOAT_DURATION_MS);
  }

  dispose(): void {
    this.eventBus.off('ENEMY_DAMAGED', this.onEnemyDamaged);
    this.eventBus.off('PLAYER_DAMAGED', this.onPlayerDamaged);
    this.pool.forEachActive((el) => el.remove());
    this.pool.releaseAll();
  }
}
