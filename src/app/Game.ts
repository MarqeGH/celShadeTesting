import * as THREE from 'three';
import { Renderer } from '../rendering/Renderer';
import { PostProcessing } from '../rendering/PostProcessing';
import { GameLoop } from './GameLoop';
import { InputManager } from './InputManager';
import { PlayerModel } from '../player/PlayerModel';
import { PlayerController } from '../player/PlayerController';
import { PlayerStats } from '../player/PlayerStats';
import { PlayerStateMachine } from '../player/PlayerStateMachine';
import { CameraController } from '../camera/CameraController';
import { createCelMaterial } from '../rendering/CelShadingPipeline';
import { TestArena } from '../world/RoomModule';
import { WeaponSystem } from '../combat/WeaponSystem';

export class Game {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: Renderer;
  readonly input: InputManager;
  readonly cameraController: CameraController;

  private container: HTMLElement;
  private gameLoop: GameLoop;
  private postProcessing: PostProcessing;
  private testCube: THREE.Mesh | null = null;
  private testArena: TestArena;
  private playerModel: PlayerModel;
  private playerController: PlayerController;
  private playerStats: PlayerStats;
  private weaponSystem: WeaponSystem;
  private playerStateMachine: PlayerStateMachine;

  constructor(container: HTMLElement) {
    this.container = container;

    this.scene = new THREE.Scene();

    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);

    this.renderer = new Renderer(container);
    this.input = new InputManager();
    this.cameraController = new CameraController(this.camera, this.input);

    // Lighting for cel-shading
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(5, 10, 3);
    this.scene.add(dirLight);
    this.scene.add(new THREE.AmbientLight(0x404050, 0.4));

    // Test arena
    this.testArena = new TestArena();
    this.scene.add(this.testArena.group);

    this.addTestCube();

    this.playerModel = new PlayerModel();
    this.scene.add(this.playerModel.mesh);

    this.playerController = new PlayerController(this.input, this.cameraController, this.playerModel);
    this.playerStats = new PlayerStats();
    this.weaponSystem = new WeaponSystem();
    this.playerStateMachine = new PlayerStateMachine(
      this.input, this.playerController, this.playerStats, this.playerModel, this.cameraController, this.weaponSystem,
    );

    this.postProcessing = new PostProcessing(
      this.renderer.renderer,
      this.scene,
      this.camera,
      container.clientWidth,
      container.clientHeight,
    );

    // Toggle outline post-processing with 'O' key
    window.addEventListener('keydown', this.onToggleOutline);
    window.addEventListener('resize', this.onResize);

    this.gameLoop = new GameLoop({
      update: (dt) => this.update(dt),
      render: (alpha) => this.render(alpha),
    });
    this.gameLoop.start();
  }

  private addTestCube(): void {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = createCelMaterial(new THREE.Color(0x4488aa));
    this.testCube = new THREE.Mesh(geometry, material);
    this.scene.add(this.testCube);
  }

  private update(dt: number): void {
    this.input.update();

    this.playerStateMachine.update(dt);
    this.playerController.resolveWallCollisions(this.testArena.wallColliders);
    this.playerStats.update(dt);
    this.playerModel.update(dt);

    // Update camera orbit and follow
    this.cameraController.update(dt, this.playerModel.mesh.position);

    // Rotate test cube at consistent speed regardless of frame rate
    if (this.testCube) {
      this.testCube.rotation.y += 1.5 * dt;
      this.testCube.rotation.x += 0.8 * dt;
    }

    this.input.resetMouseDelta();
  }

  private render(_alpha: number): void {
    this.postProcessing.render();
  }

  private onResize = (): void => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.resize(width, height);
    this.postProcessing.resize(width, height);
  };

  private onToggleOutline = (e: KeyboardEvent): void => {
    if (e.code === 'KeyO') {
      this.postProcessing.enabled = !this.postProcessing.enabled;
      console.log(`Outline post-processing: ${this.postProcessing.enabled ? 'ON' : 'OFF'}`);
    }
  };

  dispose(): void {
    this.gameLoop.stop();
    this.input.dispose();
    this.playerModel.dispose();
    this.testArena.dispose();
    this.postProcessing.dispose();
    window.removeEventListener('keydown', this.onToggleOutline);
    window.removeEventListener('resize', this.onResize);
  }
}
