import * as THREE from 'three';
import { EventBus } from '../app/EventBus';
import { InputManager } from '../app/InputManager';
import { WeaponSystem } from '../combat/WeaponSystem';
import { WeaponData } from '../combat/WeaponData';
import { createCelMaterial } from '../rendering/CelShadingPipeline';

// ── Constants ────────────────────────────────────────────────────

const INTERACT_RADIUS = 2.5;
const INTERACT_RADIUS_SQ = INTERACT_RADIUS * INTERACT_RADIUS;
const FLOAT_AMPLITUDE = 0.4;
const FLOAT_SPEED = 2.0;
const ROTATE_SPEED = 2.5;
const PICKUP_SCALE = 0.4;
const GLOW_PULSE_SPEED = 3.0;
const GLOW_PULSE_MIN = 0.6;
const SPAWN_CHANCE = 0.4;
const LIFETIME = 60; // seconds before despawn

// Weapon-type colors for pickup mesh
const WEAPON_COLORS: Record<string, number> = {
  'fracture-blade': 0x4488cc,
  'edge-spike': 0xcc4444,
  'void-cleaver': 0x8844cc,
};
const DEFAULT_WEAPON_COLOR = 0x44cc88;

// Available weapon pool (all weapons in data/weapons/)
const WEAPON_POOL = ['fracture-blade', 'edge-spike', 'void-cleaver'];

// ── WeaponPickup ────────────────────────────────────────────────

/**
 * Manages weapon pickup spawning and interaction after room clears.
 * Listens for ROOM_CLEARED, rolls 40% chance, spawns a floating weapon
 * at room center. Player presses E within range to pick up.
 */
export class WeaponPickup {
  private scene: THREE.Scene;
  private eventBus: EventBus;
  private input: InputManager;
  private weaponSystem: WeaponSystem;

  // Active pickup state (only one at a time)
  private mesh: THREE.Mesh | null = null;
  private glowMesh: THREE.Mesh | null = null;
  private weaponData: WeaponData | null = null;
  private baseY = 0;
  private age = 0;
  private active = false;

  // UI prompt
  private promptElement: HTMLDivElement;

  // Event handler refs for cleanup
  private onRoomCleared: (data: { roomId: string; roomCenter: { x: number; y: number; z: number } }) => void;

  constructor(
    scene: THREE.Scene,
    eventBus: EventBus,
    input: InputManager,
    weaponSystem: WeaponSystem,
    container: HTMLElement,
  ) {
    this.scene = scene;
    this.eventBus = eventBus;
    this.input = input;
    this.weaponSystem = weaponSystem;

    // Create prompt UI element
    this.promptElement = document.createElement('div');
    this.promptElement.style.cssText = `
      position: absolute;
      bottom: 25%;
      left: 50%;
      transform: translateX(-50%);
      color: #fff;
      font-family: monospace;
      font-size: 14px;
      background: rgba(0, 0, 0, 0.6);
      padding: 6px 14px;
      border-radius: 4px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 10;
    `;
    container.appendChild(this.promptElement);

    // Listen for room clears
    this.onRoomCleared = (data) => this.trySpawn(data.roomCenter);
    this.eventBus.on('ROOM_CLEARED', this.onRoomCleared);
  }

  /**
   * Per-frame update. Animate pickup and check for interaction.
   */
  update(dt: number, playerPosition: THREE.Vector3): void {
    if (!this.active || !this.mesh) return;

    this.age += dt;

    // Despawn after lifetime
    if (this.age >= LIFETIME) {
      this.despawn();
      return;
    }

    // Float and rotate
    this.mesh.position.y = this.baseY + Math.sin(this.age * FLOAT_SPEED) * FLOAT_AMPLITUDE;
    this.mesh.rotation.y += ROTATE_SPEED * dt;

    // Glow pulse (scale the glow mesh)
    if (this.glowMesh) {
      this.glowMesh.position.copy(this.mesh.position);
      this.glowMesh.rotation.copy(this.mesh.rotation);
      const pulse = GLOW_PULSE_MIN + (1 - GLOW_PULSE_MIN) * (0.5 + 0.5 * Math.sin(this.age * GLOW_PULSE_SPEED));
      const glowScale = PICKUP_SCALE * 1.6 * pulse;
      this.glowMesh.scale.setScalar(glowScale / PICKUP_SCALE);
    }

    // Check proximity to player
    const dx = playerPosition.x - this.mesh.position.x;
    const dz = playerPosition.z - this.mesh.position.z;
    const distSq = dx * dx + dz * dz;

    if (distSq <= INTERACT_RADIUS_SQ) {
      this.showPrompt(true);

      if (this.input.justPressed('interact')) {
        this.collect();
      }
    } else {
      this.showPrompt(false);
    }
  }

  /** Clean up everything. */
  dispose(): void {
    this.eventBus.off('ROOM_CLEARED', this.onRoomCleared);
    this.despawn();
    this.promptElement.remove();
  }

  // ── Internal ────────────────────────────────────────────────────

  private trySpawn(roomCenter: { x: number; y: number; z: number }): void {
    // Only one weapon pickup at a time
    if (this.active) return;

    // 40% chance
    if (Math.random() >= SPAWN_CHANCE) return;

    // Pick a random weapon that isn't currently equipped
    const equipped = this.weaponSystem.getEquipped();
    const secondary = this.weaponSystem.getSecondary();
    const candidates = WEAPON_POOL.filter(
      (id) => id !== equipped.id && id !== secondary?.id,
    );

    // If player already has all weapons, still offer a random one
    const weaponId = candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : WEAPON_POOL[Math.floor(Math.random() * WEAPON_POOL.length)];

    this.spawn(weaponId, roomCenter);
  }

  private async spawn(
    weaponId: string,
    position: { x: number; y: number; z: number },
  ): Promise<void> {
    try {
      this.weaponData = await this.weaponSystem.loadWeapon(weaponId);
    } catch (err) {
      console.error(`[WeaponPickup] Failed to load weapon "${weaponId}":`, err);
      return;
    }

    const color = new THREE.Color(WEAPON_COLORS[weaponId] ?? DEFAULT_WEAPON_COLOR);

    // Main weapon mesh — diamond shape (octahedron)
    const geometry = new THREE.OctahedronGeometry(PICKUP_SCALE, 0);
    const material = createCelMaterial(color);
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(position.x, position.y + 1.0, position.z);
    this.scene.add(this.mesh);

    // Glow mesh — larger, semi-transparent overlay
    const glowGeometry = new THREE.OctahedronGeometry(PICKUP_SCALE * 1.6, 0);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide,
    });
    this.glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    this.glowMesh.position.copy(this.mesh.position);
    this.scene.add(this.glowMesh);

    this.baseY = this.mesh.position.y;
    this.age = 0;
    this.active = true;

    console.log(`[WeaponPickup] Spawned "${this.weaponData.name}" at (${position.x.toFixed(1)}, ${position.z.toFixed(1)})`);
  }

  private async collect(): Promise<void> {
    if (!this.weaponData || !this.mesh) return;

    const pos = {
      x: this.mesh.position.x,
      y: this.mesh.position.y,
      z: this.mesh.position.z,
    };

    const pickedWeapon = this.weaponData;

    // If player has no secondary, equip as secondary
    // If player has both slots, replace the currently equipped weapon
    if (!this.weaponSystem.hasSecondary()) {
      await this.weaponSystem.equipSecondary(pickedWeapon.id);
      console.log(`[WeaponPickup] Equipped "${pickedWeapon.name}" as secondary`);
    } else {
      // Replace currently equipped weapon with the pickup
      await this.weaponSystem.equipWeapon(pickedWeapon.id);
      console.log(`[WeaponPickup] Replaced equipped weapon with "${pickedWeapon.name}"`);
    }

    this.eventBus.emit('WEAPON_PICKUP_COLLECTED', {
      weaponId: pickedWeapon.id,
      weaponName: pickedWeapon.name,
      position: pos,
    });

    this.despawn();
  }

  private despawn(): void {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
      this.mesh = null;
    }
    if (this.glowMesh) {
      this.scene.remove(this.glowMesh);
      this.glowMesh.geometry.dispose();
      (this.glowMesh.material as THREE.Material).dispose();
      this.glowMesh = null;
    }
    this.weaponData = null;
    this.active = false;
    this.showPrompt(false);
  }

  private showPrompt(visible: boolean): void {
    if (visible && this.weaponData) {
      this.promptElement.textContent = `Press E to pick up ${this.weaponData.name}`;
      this.promptElement.style.opacity = '1';
    } else {
      this.promptElement.style.opacity = '0';
    }
  }
}
