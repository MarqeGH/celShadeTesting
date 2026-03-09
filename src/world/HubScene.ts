import * as THREE from 'three';
import { createCelMaterial } from '../rendering/CelShadingPipeline';
import { InputManager } from '../app/InputManager';
import type { WallCollider } from './RoomModule';

const HUB_SIZE = 10;
const WALL_HEIGHT = 3;
const WALL_THICKNESS = 0.4;
const FLOOR_COLOR = new THREE.Color(0x3a3a3a);
const WALL_COLOR = new THREE.Color(0x4a4a50);

const PORTAL_INTERACT_RANGE = 2.5;
const PORTAL_COLOR = new THREE.Color(0xffaa22);
const PORTAL_Y = 1.5;
const PORTAL_Z = -3;

/**
 * Hub scene — small room between runs.
 * Contains a pulsing portal that starts the next run on E-key interaction.
 */
export class HubScene {
  readonly group: THREE.Group;
  readonly wallColliders: WallCollider[] = [];

  private portalMesh: THREE.Mesh;
  private portalBaseMaterial: THREE.ShaderMaterial;
  private elapsed = 0;

  private input: InputManager;
  private onPortalActivated: () => void;

  private promptElement: HTMLDivElement;
  private promptVisible = false;
  private readonly _dist = new THREE.Vector3();

  constructor(input: InputManager, container: HTMLElement, onPortalActivated: () => void) {
    this.input = input;
    this.onPortalActivated = onPortalActivated;
    this.group = new THREE.Group();

    this.buildFloor();
    this.buildWalls();

    // Portal
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

    // Interaction prompt
    this.promptElement = document.createElement('div');
    this.promptElement.style.cssText =
      'position:absolute;bottom:25%;left:50%;transform:translateX(-50%);' +
      'color:#fff;font-family:monospace;font-size:16px;padding:8px 16px;' +
      'background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.3);' +
      'border-radius:4px;pointer-events:none;opacity:0;z-index:50;' +
      'transition:opacity 0.15s ease;';
    this.promptElement.textContent = 'Press E to enter the Rift';
    container.appendChild(this.promptElement);
  }

  /** Player spawns at south side of hub. */
  getPlayerEntry(): THREE.Vector3 {
    return new THREE.Vector3(0, 0, 3);
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    this.elapsed += dt;

    // Rotate portal slowly
    this.portalMesh.rotation.z += 0.4 * dt;
    this.portalMesh.rotation.y = Math.sin(this.elapsed * 0.5) * 0.15;

    // Pulse portal color brightness
    const pulse = 1.0 + 0.3 * Math.sin(this.elapsed * 2.5);
    const uniform = this.portalBaseMaterial.uniforms['uBaseColor'];
    if (uniform) {
      uniform.value.copy(PORTAL_COLOR).multiplyScalar(pulse);
    }

    // Proximity check for portal interaction
    this._dist.set(0, 0, PORTAL_Z).sub(playerPos);
    this._dist.y = 0;
    const dist = this._dist.length();

    if (dist < PORTAL_INTERACT_RANGE) {
      this.showPrompt(true);
      if (this.input.justPressed('interact')) {
        this.showPrompt(false);
        this.onPortalActivated();
      }
    } else {
      this.showPrompt(false);
    }
  }

  dispose(): void {
    this.promptElement.remove();
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
  }

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

  private showPrompt(visible: boolean): void {
    if (visible === this.promptVisible) return;
    this.promptVisible = visible;
    this.promptElement.style.opacity = visible ? '1' : '0';
  }
}
