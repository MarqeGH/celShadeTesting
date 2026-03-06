import * as THREE from 'three';
import { Renderer } from '../rendering/Renderer';
import { GameLoop } from './GameLoop';
import { InputManager, GameAction } from './InputManager';
import { PlayerModel } from '../player/PlayerModel';

export class Game {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: Renderer;
  readonly input: InputManager;

  private container: HTMLElement;
  private gameLoop: GameLoop;
  private testCube: THREE.Mesh | null = null;
  private playerModel: PlayerModel;

  constructor(container: HTMLElement) {
    this.container = container;

    this.scene = new THREE.Scene();

    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.camera.position.set(0, 5, 10);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new Renderer(container);
    this.input = new InputManager();

    this.addTestCube();

    this.playerModel = new PlayerModel();
    this.scene.add(this.playerModel.mesh);

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

  // Actions to log when justPressed
  private static readonly LOG_ACTIONS: GameAction[] = [
    'dodge', 'lightAttack', 'heavyAttack', 'parry', 'heal',
    'lockOn', 'swapWeapon', 'pause',
  ];

  private update(dt: number): void {
    this.input.update();

    // Log justPressed actions (temporary test)
    for (const action of Game.LOG_ACTIONS) {
      if (this.input.justPressed(action)) {
        console.log(`[Input] justPressed: ${action}`);
      }
    }

    // Log held movement/sprint
    if (this.input.isPressed('sprint')) {
      console.log('[Input] held: sprint');
    }

    this.playerModel.update(dt);

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
