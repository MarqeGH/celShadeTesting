import * as THREE from 'three';
import { PlayerStateMachine } from '../player/PlayerStateMachine';
import { PlayerModel } from '../player/PlayerModel';
import { PlayerStats } from '../player/PlayerStats';
import { BaseEnemy } from '../enemies/BaseEnemy';
import { HitboxManager, HitboxShape } from '../combat/HitboxManager';

// ── Debug context: all systems the overlay needs to read ──────────

export interface DebugContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  playerStateMachine: PlayerStateMachine;
  playerModel: PlayerModel;
  playerStats: PlayerStats;
  enemies: BaseEnemy[] | (() => BaseEnemy[]);
  hitboxManager: HitboxManager;
}

// ── DebugOverlay ──────────────────────────────────────────────────

export class DebugOverlay {
  enabled = false;
  godMode = false;
  instantKill = false;

  private ctx: DebugContext;
  private panel: HTMLDivElement;
  private fpsEl!: HTMLSpanElement;
  private stateEl!: HTMLSpanElement;
  private posEl!: HTMLSpanElement;
  private enemyCountEl!: HTMLSpanElement;
  private drawCallsEl!: HTMLSpanElement;
  private godModeEl!: HTMLSpanElement;
  private instantKillEl!: HTMLSpanElement;

  // FPS tracking
  private frameCount = 0;
  private fpsAccumulator = 0;
  private lastFps = 0;

  // Hitbox wireframe visualization
  private wireframeGroup: THREE.Group;
  private wireframeMeshes: THREE.LineSegments[] = [];

  constructor(ctx: DebugContext) {
    this.ctx = ctx;
    this.wireframeGroup = new THREE.Group();
    this.wireframeGroup.visible = false;

    this.panel = this.createPanel();
    this.panel.style.display = 'none';

    window.addEventListener('keydown', this.onKeyDown);
  }

  attach(container: HTMLElement): void {
    container.appendChild(this.panel);
    this.ctx.scene.add(this.wireframeGroup);
  }

  update(dt: number): void {
    // FPS calculation
    this.frameCount++;
    this.fpsAccumulator += dt;
    if (this.fpsAccumulator >= 0.5) {
      this.lastFps = Math.round(this.frameCount / this.fpsAccumulator);
      this.frameCount = 0;
      this.fpsAccumulator = 0;
    }

    if (!this.enabled) return;

    // Update text displays
    this.fpsEl.textContent = String(this.lastFps);

    const stateName = this.ctx.playerStateMachine.getCurrentState() ?? 'none';
    this.stateEl.textContent = stateName;

    const pos = this.ctx.playerModel.mesh.position;
    this.posEl.textContent = `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;

    const enemyList = typeof this.ctx.enemies === 'function' ? this.ctx.enemies() : this.ctx.enemies;
    const aliveEnemies = enemyList.filter((e) => !e.isDead()).length;
    this.enemyCountEl.textContent = String(aliveEnemies);

    const info = this.ctx.renderer.info;
    this.drawCallsEl.textContent = String(info.render.calls);

    this.godModeEl.textContent = this.godMode ? 'ON' : 'OFF';
    this.godModeEl.style.color = this.godMode ? '#0f0' : '#888';
    this.instantKillEl.textContent = this.instantKill ? 'ON' : 'OFF';
    this.instantKillEl.style.color = this.instantKill ? '#f00' : '#888';

    // Update hitbox/hurtbox wireframes
    this.updateWireframes();
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.panel.remove();
    this.clearWireframes();
    this.ctx.scene.remove(this.wireframeGroup);
  }

  // ── Key handler ───────────────────────────────────────────────

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'F1') {
      e.preventDefault();
      this.enabled = !this.enabled;
      this.panel.style.display = this.enabled ? 'block' : 'none';
      this.wireframeGroup.visible = this.enabled;
      if (!this.enabled) {
        this.clearWireframes();
      }
      console.log(`[Debug] Overlay: ${this.enabled ? 'ON' : 'OFF'}`);
    }

    if (e.code === 'F2') {
      e.preventDefault();
      this.godMode = !this.godMode;
      console.log(`[Debug] God mode: ${this.godMode ? 'ON' : 'OFF'}`);
    }

    if (e.code === 'F3') {
      e.preventDefault();
      this.instantKill = !this.instantKill;
      console.log(`[Debug] Instant kill: ${this.instantKill ? 'ON' : 'OFF'}`);
    }
  };

  // ── Wireframe visualization ───────────────────────────────────

  private updateWireframes(): void {
    this.clearWireframes();

    const hitboxes = this.ctx.hitboxManager.getActiveHitboxes();
    const hurtboxes = this.ctx.hitboxManager.getAllHurtboxes();

    // Hitboxes: red wireframe
    for (const hitbox of hitboxes) {
      const mesh = this.createShapeWireframe(hitbox.shape, 0xff0000);
      if (mesh) {
        this.wireframeGroup.add(mesh);
        this.wireframeMeshes.push(mesh);
      }
    }

    // Hurtboxes: green wireframe
    for (const hurtbox of hurtboxes) {
      const mesh = this.createShapeWireframe(hurtbox.shape, 0x00ff00);
      if (mesh) {
        this.wireframeGroup.add(mesh);
        this.wireframeMeshes.push(mesh);
      }
    }
  }

  private createShapeWireframe(shape: HitboxShape, color: number): THREE.LineSegments | null {
    let geometry: THREE.BufferGeometry;

    if (shape.type === 'sphere') {
      geometry = new THREE.SphereGeometry(shape.radius, 8, 6);
      const edges = new THREE.EdgesGeometry(geometry);
      const material = new THREE.LineBasicMaterial({ color, depthTest: false });
      const wireframe = new THREE.LineSegments(edges, material);
      wireframe.position.copy(shape.center);
      wireframe.renderOrder = 999;
      geometry.dispose();
      return wireframe;
    }

    if (shape.type === 'aabb') {
      const size = new THREE.Vector3().subVectors(shape.max, shape.min);
      const center = new THREE.Vector3().addVectors(shape.min, shape.max).multiplyScalar(0.5);
      geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
      const edges = new THREE.EdgesGeometry(geometry);
      const material = new THREE.LineBasicMaterial({ color, depthTest: false });
      const wireframe = new THREE.LineSegments(edges, material);
      wireframe.position.copy(center);
      wireframe.renderOrder = 999;
      geometry.dispose();
      return wireframe;
    }

    return null;
  }

  private clearWireframes(): void {
    for (const mesh of this.wireframeMeshes) {
      this.wireframeGroup.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.wireframeMeshes.length = 0;
  }

  // ── HTML panel creation ───────────────────────────────────────

  private createPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.id = 'debug-overlay';
    panel.style.cssText = `
      position: absolute;
      top: 8px;
      left: 8px;
      background: rgba(0, 0, 0, 0.75);
      color: #0f0;
      font-family: monospace;
      font-size: 13px;
      padding: 8px 12px;
      border-radius: 4px;
      pointer-events: none;
      z-index: 1000;
      line-height: 1.6;
      min-width: 200px;
    `;

    const row = (label: string): { container: HTMLDivElement; value: HTMLSpanElement } => {
      const div = document.createElement('div');
      const labelSpan = document.createElement('span');
      labelSpan.style.color = '#aaa';
      labelSpan.textContent = `${label}: `;
      const valueSpan = document.createElement('span');
      div.appendChild(labelSpan);
      div.appendChild(valueSpan);
      return { container: div, value: valueSpan };
    };

    const fps = row('FPS');
    this.fpsEl = fps.value;

    const state = row('State');
    this.stateEl = state.value;

    const pos = row('Position');
    this.posEl = pos.value;

    const enemies = row('Enemies');
    this.enemyCountEl = enemies.value;

    const draws = row('Draw Calls');
    this.drawCallsEl = draws.value;

    // Separator
    const sep = document.createElement('div');
    sep.style.cssText = 'border-top: 1px solid #444; margin: 4px 0;';

    const god = row('God Mode [F2]');
    this.godModeEl = god.value;
    this.godModeEl.textContent = 'OFF';
    this.godModeEl.style.color = '#888';

    const ik = row('Instant Kill [F3]');
    this.instantKillEl = ik.value;
    this.instantKillEl.textContent = 'OFF';
    this.instantKillEl.style.color = '#888';

    panel.appendChild(fps.container);
    panel.appendChild(state.container);
    panel.appendChild(pos.container);
    panel.appendChild(enemies.container);
    panel.appendChild(draws.container);
    panel.appendChild(sep);
    panel.appendChild(god.container);
    panel.appendChild(ik.container);

    return panel;
  }
}
