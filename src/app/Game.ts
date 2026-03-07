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
import { HitboxManager } from '../combat/HitboxManager';
import { CombatSystem, CombatEntity, PLAYER_ENTITY_ID } from '../combat/CombatSystem';
import { EventBus } from './EventBus';
import { BaseEnemy } from '../enemies/BaseEnemy';
import { EnemyFactory } from '../enemies/EnemyFactory';
import '../enemies/TriangleShard'; // side-effect: registers in EnemyRegistry
import { CubeSentinel } from '../enemies/CubeSentinel'; // side-effect: registers in EnemyRegistry
import { HUD } from '../ui/HUD';
import { UIManager } from '../ui/UIManager';
import { DebugOverlay } from '../utils/debug';

export class Game {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: Renderer;
  readonly input: InputManager;
  readonly cameraController: CameraController;
  readonly eventBus: EventBus;

  private container: HTMLElement;
  private gameLoop: GameLoop;
  private postProcessing: PostProcessing;
  private testCube: THREE.Mesh | null = null;
  private testArena: TestArena;
  private playerModel: PlayerModel;
  private playerController: PlayerController;
  private playerStats: PlayerStats;
  private weaponSystem: WeaponSystem;
  private hitboxManager: HitboxManager;
  private combatSystem: CombatSystem;
  private playerStateMachine: PlayerStateMachine;
  private hud: HUD;
  private uiManager: UIManager;
  private debugOverlay: DebugOverlay;
  private enemies: BaseEnemy[] = [];

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

    // Combat system: EventBus → HitboxManager → CombatSystem
    this.eventBus = new EventBus();
    this.hitboxManager = new HitboxManager();
    this.combatSystem = new CombatSystem(this.hitboxManager, this.eventBus);

    // Register player as a damageable combat entity
    // Debug overlay reference captured via closure after construction below
    const debugRef = { overlay: null as DebugOverlay | null };
    const playerStats = this.playerStats;
    const playerMesh = this.playerModel.mesh;
    const playerEntity: CombatEntity = {
      entityId: PLAYER_ENTITY_ID,
      type: 'player',
      stringId: 'player',
      getHp: () => playerStats.hp,
      getMaxHp: () => playerStats.maxHp,
      takeDamage: (amount) => {
        if (debugRef.overlay?.godMode) return playerStats.hp; // god mode: no damage
        return playerStats.takeDamage(amount);
      },
      isDead: () => playerStats.isDead,
      getPosition: () => playerMesh.position,
    };
    this.combatSystem.registerEntity(playerEntity);

    // HUD and UI
    this.hud = new HUD(this.playerStats, this.eventBus);
    this.hud.attach(container);
    this.uiManager = new UIManager(this.hud);

    // Debug overlay
    this.debugOverlay = new DebugOverlay({
      renderer: this.renderer.renderer,
      scene: this.scene,
      playerStateMachine: this.playerStateMachine,
      playerModel: this.playerModel,
      playerStats: this.playerStats,
      enemies: this.enemies,
      hitboxManager: this.hitboxManager,
    });
    this.debugOverlay.attach(container);
    debugRef.overlay = this.debugOverlay;

    // Debug: instant kill — when any enemy takes damage, kill it immediately
    this.eventBus.on('ENEMY_DAMAGED', (data) => {
      if (!this.debugOverlay.instantKill) return;
      const enemy = this.enemies.find((e) => e.stringId === data.enemyId);
      if (enemy && !enemy.isDead()) {
        enemy.takeDamage(enemy.getHp());
      }
    });

    // Spawn test enemies
    this.spawnEnemies();

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

  private spawnEnemies(): void {
    const triangleSpawns = [
      new THREE.Vector3(5, 0, 5),
      new THREE.Vector3(-5, 0, -5),
      new THREE.Vector3(6, 0, -4),
    ];

    for (const pos of triangleSpawns) {
      EnemyFactory.create('triangle-shard', pos, this.eventBus, this.hitboxManager)
        .then((enemy) => {
          this.enemies.push(enemy);
          this.scene.add(enemy.group);
          this.combatSystem.registerEntity(enemy);
        })
        .catch((err) => {
          console.error('[Game] Failed to spawn enemy:', err);
        });
    }

    const cubeSpawns = [
      new THREE.Vector3(-7, 0, 6),
      new THREE.Vector3(7, 0, -6),
    ];

    for (const pos of cubeSpawns) {
      EnemyFactory.create('cube-sentinel', pos, this.eventBus, this.hitboxManager)
        .then((enemy) => {
          if (enemy instanceof CubeSentinel) {
            enemy.setScene(this.scene);
          }
          this.enemies.push(enemy);
          this.scene.add(enemy.group);
          this.combatSystem.registerEntity(enemy);
        })
        .catch((err) => {
          console.error('[Game] Failed to spawn enemy:', err);
        });
    }
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

    // Update enemies
    const playerPos = this.playerModel.mesh.position;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(dt, playerPos);
      if (enemy.isDead() && !enemy.isDying) {
        this.combatSystem.unregisterEntity(enemy.entityId);
        this.enemies.splice(i, 1);
      }
    }

    this.combatSystem.update();
    this.playerStats.update(dt);
    this.uiManager.update();
    this.playerModel.update(dt);
    this.debugOverlay.update(dt);

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
    for (const enemy of this.enemies) {
      enemy.dispose();
    }
    this.enemies.length = 0;
    this.uiManager.dispose();
    this.debugOverlay.dispose();
    this.hitboxManager.clear();
    this.eventBus.clear();
    window.removeEventListener('keydown', this.onToggleOutline);
    window.removeEventListener('resize', this.onResize);
  }
}
