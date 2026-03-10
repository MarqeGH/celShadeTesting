import * as THREE from 'three';
import { createCelMaterial } from '../rendering/CelShadingPipeline';
import { InputManager } from '../app/InputManager';
import type { WallCollider } from './RoomModule';

const HUB_SIZE = 10;
const WALL_HEIGHT = 3;
const WALL_THICKNESS = 0.4;
const FLOOR_COLOR = new THREE.Color(0x3a3a3a);
const WALL_COLOR = new THREE.Color(0x4a4a50);

const INTERACT_RANGE = 2.5;
const PORTAL_COLOR = new THREE.Color(0xffaa22);
const PORTAL_Y = 1.5;
const PORTAL_Z = -3;

const PEDESTAL_COLOR = new THREE.Color(0x4488cc);
const PEDESTAL_X = 3;
const PEDESTAL_Z = -1;

/**
 * Hub scene — small room between runs.
 * Contains a pulsing portal (start run) and a shop pedestal (open shop).
 */
export class HubScene {
  readonly group: THREE.Group;
  readonly wallColliders: WallCollider[] = [];

  private portalMesh: THREE.Mesh;
  private portalBaseMaterial: THREE.ShaderMaterial;
  private pedestalMesh: THREE.Mesh;
  private pedestalBaseMaterial: THREE.ShaderMaterial;
  private elapsed = 0;

  private input: InputManager;
  private onPortalActivated: () => void;
  private onShopActivated: (() => void) | null;

  private portalPrompt: HTMLDivElement;
  private shopPrompt: HTMLDivElement;
  private portalPromptVisible = false;
  private shopPromptVisible = false;
  private interactionsEnabled = true;
  private readonly _dist = new THREE.Vector3();

  constructor(
    input: InputManager,
    container: HTMLElement,
    onPortalActivated: () => void,
    onShopActivated?: () => void,
  ) {
    this.input = input;
    this.onPortalActivated = onPortalActivated;
    this.onShopActivated = onShopActivated ?? null;
    this.group = new THREE.Group();

    this.buildFloor();
    this.buildWalls();

    // ── Portal (north side) ──
    const torusGeo = new THREE.TorusGeometry(1.2, 0.15, 8, 32);
    this.portalBaseMaterial = createCelMaterial(PORTAL_COLOR) as THREE.ShaderMaterial;
    this.portalMesh = new THREE.Mesh(torusGeo, this.portalBaseMaterial);
    this.portalMesh.position.set(0, PORTAL_Y, PORTAL_Z);
    this.group.add(this.portalMesh);

    // Inner glow plane (semi-transparent disc inside the torus)
    const glowGeo = new THREE.CircleGeometry(1.1, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffcc44,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
    const glowDisc = new THREE.Mesh(glowGeo, glowMat);
    glowDisc.position.set(0, PORTAL_Y, PORTAL_Z);
    this.group.add(glowDisc);

    // ── Shop pedestal (east side) ──
    // Base cylinder
    const baseGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.8, 12);
    const baseMat = createCelMaterial(WALL_COLOR);
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.set(PEDESTAL_X, 0.4, PEDESTAL_Z);
    this.group.add(baseMesh);

    // Top crystal (rotating box)
    const crystalGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    this.pedestalBaseMaterial = createCelMaterial(PEDESTAL_COLOR) as THREE.ShaderMaterial;
    this.pedestalMesh = new THREE.Mesh(crystalGeo, this.pedestalBaseMaterial);
    this.pedestalMesh.position.set(PEDESTAL_X, 1.2, PEDESTAL_Z);
    this.pedestalMesh.rotation.y = Math.PI / 4;
    this.group.add(this.pedestalMesh);

    // ── Interaction prompts ──
    this.portalPrompt = this.createPrompt(container, 'Press E to enter the Rift');
    this.shopPrompt = this.createPrompt(container, 'Press E to browse wares');
  }

  /** Player spawns at south side of hub. */
  getPlayerEntry(): THREE.Vector3 {
    return new THREE.Vector3(0, 0, 3);
  }

  /** Enable or disable E-key interactions (disabled while shop overlay is open). */
  setInteractionsEnabled(enabled: boolean): void {
    this.interactionsEnabled = enabled;
    if (!enabled) {
      this.setPromptVisible(this.portalPrompt, false, 'portal');
      this.setPromptVisible(this.shopPrompt, false, 'shop');
    }
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    this.elapsed += dt;

    // ── Animate portal ──
    this.portalMesh.rotation.z += 0.4 * dt;
    this.portalMesh.rotation.y = Math.sin(this.elapsed * 0.5) * 0.15;

    const portalPulse = 1.0 + 0.3 * Math.sin(this.elapsed * 2.5);
    const portalUniform = this.portalBaseMaterial.uniforms['uBaseColor'];
    if (portalUniform) {
      portalUniform.value.copy(PORTAL_COLOR).multiplyScalar(portalPulse);
    }

    // ── Animate pedestal crystal ──
    this.pedestalMesh.rotation.y += 0.6 * dt;
    this.pedestalMesh.position.y = 1.2 + 0.1 * Math.sin(this.elapsed * 2.0);

    const pedestalPulse = 1.0 + 0.25 * Math.sin(this.elapsed * 1.8);
    const pedestalUniform = this.pedestalBaseMaterial.uniforms['uBaseColor'];
    if (pedestalUniform) {
      pedestalUniform.value.copy(PEDESTAL_COLOR).multiplyScalar(pedestalPulse);
    }

    if (!this.interactionsEnabled) return;

    // ── Portal proximity ──
    const portalDist = this.xzDistance(playerPos, 0, PORTAL_Z);
    const shopDist = this.xzDistance(playerPos, PEDESTAL_X, PEDESTAL_Z);

    // Only show prompt for the closest interactable
    const nearPortal = portalDist < INTERACT_RANGE;
    const nearShop = shopDist < INTERACT_RANGE;

    if (nearPortal && (!nearShop || portalDist <= shopDist)) {
      this.setPromptVisible(this.portalPrompt, true, 'portal');
      this.setPromptVisible(this.shopPrompt, false, 'shop');
      if (this.input.justPressed('interact')) {
        this.setPromptVisible(this.portalPrompt, false, 'portal');
        this.onPortalActivated();
      }
    } else if (nearShop && this.onShopActivated) {
      this.setPromptVisible(this.shopPrompt, true, 'shop');
      this.setPromptVisible(this.portalPrompt, false, 'portal');
      if (this.input.justPressed('interact')) {
        this.setPromptVisible(this.shopPrompt, false, 'shop');
        this.onShopActivated();
      }
    } else {
      this.setPromptVisible(this.portalPrompt, false, 'portal');
      this.setPromptVisible(this.shopPrompt, false, 'shop');
    }
  }

  dispose(): void {
    this.portalPrompt.remove();
    this.shopPrompt.remove();
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
  }

  // ── Private ──────────────────────────────────────────────────

  private buildFloor(): void {
    const geometry = new THREE.PlaneGeometry(HUB_SIZE, HUB_SIZE);
    const material = createCelMaterial(FLOOR_COLOR);
    const floor = new THREE.Mesh(geometry, material);
    floor.rotation.x = -Math.PI / 2;
    this.group.add(floor);
  }

  private buildWalls(): void {
    const half = HUB_SIZE / 2;
    const halfHeight = WALL_HEIGHT / 2;
    const halfThick = WALL_THICKNESS / 2;

    const wallDefs: [number, number, number, number][] = [
      [0, -half - halfThick, HUB_SIZE + WALL_THICKNESS * 2, WALL_THICKNESS], // south
      [0, half + halfThick, HUB_SIZE + WALL_THICKNESS * 2, WALL_THICKNESS],  // north
      [-half - halfThick, 0, WALL_THICKNESS, HUB_SIZE],                       // west
      [half + halfThick, 0, WALL_THICKNESS, HUB_SIZE],                        // east
    ];

    const wallGeometry = new THREE.BoxGeometry(1, WALL_HEIGHT, 1);
    const wallMaterial = createCelMaterial(WALL_COLOR);

    for (const [px, pz, sx, sz] of wallDefs) {
      const wall = new THREE.Mesh(wallGeometry, wallMaterial);
      wall.position.set(px, halfHeight, pz);
      wall.scale.set(sx, 1, sz);
      this.group.add(wall);

      this.wallColliders.push({
        min: new THREE.Vector3(px - sx / 2, 0, pz - sz / 2),
        max: new THREE.Vector3(px + sx / 2, WALL_HEIGHT, pz + sz / 2),
      });
    }
  }

  private createPrompt(container: HTMLElement, text: string): HTMLDivElement {
    const el = document.createElement('div');
    el.style.cssText =
      'position:absolute;bottom:25%;left:50%;transform:translateX(-50%);' +
      'color:#fff;font-family:monospace;font-size:16px;padding:8px 16px;' +
      'background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.3);' +
      'border-radius:4px;pointer-events:none;opacity:0;z-index:50;' +
      'transition:opacity 0.15s ease;';
    el.textContent = text;
    container.appendChild(el);
    return el;
  }

  private setPromptVisible(el: HTMLDivElement, visible: boolean, which: 'portal' | 'shop'): void {
    const current = which === 'portal' ? this.portalPromptVisible : this.shopPromptVisible;
    if (visible === current) return;
    if (which === 'portal') this.portalPromptVisible = visible;
    else this.shopPromptVisible = visible;
    el.style.opacity = visible ? '1' : '0';
  }

  private xzDistance(playerPos: THREE.Vector3, tx: number, tz: number): number {
    this._dist.set(tx - playerPos.x, 0, tz - playerPos.z);
    return this._dist.length();
  }
}
