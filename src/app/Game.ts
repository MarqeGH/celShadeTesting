import * as THREE from 'three';
import { Renderer } from '../rendering/Renderer';
import { GameLoop } from './GameLoop';
import { InputManager } from './InputManager';
import { PlayerModel } from '../player/PlayerModel';
import { PlayerController } from '../player/PlayerController';
import { PlayerStateMachine } from '../player/PlayerStateMachine';
import { CameraController } from '../camera/CameraController';

export class Game {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: Renderer;
  readonly input: InputManager;
  readonly cameraController: CameraController;

  private container: HTMLElement;
  private gameLoop: GameLoop;
  private testCube: THREE.Mesh | null = null;
  private playerModel: PlayerModel;
  private playerController: PlayerController;
  private playerStateMachine: PlayerStateMachine;

  constructor(container: HTMLElement) {
    this.container = container;

    this.scene = new THREE.Scene();

    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);

    this.renderer = new Renderer(container);
    this.input = new InputManager();
    this.cameraController = new CameraController(this.camera, this.input);

    this.addTestCube();

    this.playerModel = new PlayerModel();
    this.scene.add(this.playerModel.mesh);

    this.playerController = new PlayerController(this.input, this.cameraController, this.playerModel);
    this.playerStateMachine = new PlayerStateMachine(
      this.input, this.playerController, this.playerModel, this.cameraController,
    );

    window.addEventListener('resize', this.onResize);

    this.gameLoop = new GameLoop({
      update: (dt) => this.update(dt),
      render: (alpha) => this.render(alpha),
    });
    this.gameLoop.start();
  }

  private addTestCube(): void {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x4488aa });
    this.testCube = new THREE.Mesh(geometry, material);
    this.scene.add(this.testCube);
  }

  private update(dt: number): void {
    this.input.update();

    this.playerStateMachine.update(dt);
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
    this.renderer.render(this.scene, this.camera);
  }

  private onResize = (): void => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.resize(width, height);
  };

  dispose(): void {
    this.gameLoop.stop();
    this.input.dispose();
    this.playerModel.dispose();
    window.removeEventListener('resize', this.onResize);
  }
}
