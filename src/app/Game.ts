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
import { StaggerSystem, PLAYER_POISE_CONFIG } from '../combat/StaggerSystem';
import { EventBus } from './EventBus';
import '../enemies/TriangleShard'; // side-effect: registers in EnemyRegistry
import '../enemies/CubeSentinel'; // side-effect: registers in EnemyRegistry
import { EncounterManager, EncounterData } from '../world/EncounterManager';
import { HUD } from '../ui/HUD';
import { UIManager } from '../ui/UIManager';
import { DebugOverlay } from '../utils/debug';
import { DoorSystem } from '../world/DoorSystem';
import { RoomAssembler } from '../world/RoomAssembler';
import { RoomModule, type RoomModuleData, type ExitDoor } from '../world/RoomModule';
import { AssetLoader } from '../engine/AssetLoader';

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
  private staggerSystem: StaggerSystem;
  private playerStateMachine: PlayerStateMachine;
  private hud: HUD;
  private uiManager: UIManager;
  private debugOverlay: DebugOverlay;
  private encounterManager: EncounterManager;
  private doorSystem: DoorSystem;
  private roomAssembler: RoomAssembler;
  private assetLoader: AssetLoader;
  private currentRoom: RoomModule | null = null;

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

    // Combat system: EventBus → HitboxManager → StaggerSystem → CombatSystem
    this.eventBus = new EventBus();
    this.hitboxManager = new HitboxManager();
    this.staggerSystem = new StaggerSystem();
    this.combatSystem = new CombatSystem(this.hitboxManager, this.eventBus, this.staggerSystem);

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

    // Register player poise with StaggerSystem
    this.staggerSystem.register(
      PLAYER_ENTITY_ID,
      PLAYER_POISE_CONFIG,
      () => this.playerStateMachine.fsm.setState('stagger'),
    );

    // Encounter manager
    this.encounterManager = new EncounterManager(
      this.eventBus, this.hitboxManager, this.combatSystem, this.staggerSystem, this.scene,
    );

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
      enemies: () => this.encounterManager.getEnemies(),
      hitboxManager: this.hitboxManager,
    });
    this.debugOverlay.attach(container);
    debugRef.overlay = this.debugOverlay;

    // Debug: instant kill — when any enemy takes damage, kill it immediately
    this.eventBus.on('ENEMY_DAMAGED', (data) => {
      if (!this.debugOverlay.instantKill) return;
      const enemies = this.encounterManager.getEnemies();
      const enemy = enemies.find((e) => e.stringId === data.enemyId);
      if (enemy && !enemy.isDead()) {
        enemy.takeDamage(enemy.getHp());
      }
    });

    // Door system and room assembler
    this.assetLoader = new AssetLoader();
    this.roomAssembler = new RoomAssembler();
    this.doorSystem = new DoorSystem(this.eventBus, this.input, container);
    this.doorSystem.setPlayerPosition(this.playerModel.mesh.position);
    this.doorSystem.setTransitionCallback(async (exit) => {
      return this.handleRoomTransition(exit);
    });

    // Start test encounter via EncounterManager
    this.startTestEncounter();

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

  private startTestEncounter(): void {
    // Load encounter data and start via EncounterManager
    const testEncounter: EncounterData = {
      id: 'test-arena',
      difficulty: 3,
      waves: [
        {
          delay: 0,
          spawns: [
            { enemyId: 'triangle-shard', count: 3, spawnPoint: 'random' },
            { enemyId: 'cube-sentinel', count: 2, spawnPoint: 'farthest' },
          ],
        },
      ],
    };

    const spawnPoints = [
      new THREE.Vector3(5, 0, 5),
      new THREE.Vector3(-5, 0, -5),
      new THREE.Vector3(6, 0, -4),
      new THREE.Vector3(-7, 0, 6),
      new THREE.Vector3(7, 0, -6),
    ];

    this.encounterManager.startEncounter(
      testEncounter,
      'test-arena',
      spawnPoints,
      this.playerModel.mesh.position,
    ).catch((err) => {
      console.error('[Game] Failed to start test encounter:', err);
    });
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

    // Resolve wall collisions against current room (assembled or test arena)
    const walls = this.currentRoom
      ? this.currentRoom.wallColliders
      : this.testArena.wallColliders;
    this.playerController.resolveWallCollisions(walls);

    // Update encounter (handles enemy updates + wave progression)
    const playerPos = this.playerModel.mesh.position;
    this.encounterManager.update(dt, playerPos);

    this.combatSystem.update();
    this.staggerSystem.update(dt);
    this.doorSystem.update(dt);
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

  /**
   * Handles room transition: unloads current room, loads next room, returns entry position.
   * Used as a callback by DoorSystem during door transitions.
   */
  private async handleRoomTransition(exit: ExitDoor): Promise<THREE.Vector3> {
    // Dispose current encounter
    this.encounterManager.dispose();

    // Unload current assembled room if one exists
    if (this.currentRoom) {
      this.scene.remove(this.currentRoom.group);
      this.currentRoom.dispose();
      this.currentRoom = null;
    }

    // Determine the next room to load.
    // For now, always load the atrium-room-square as a demonstration.
    // A full ZoneGenerator (T-030) will provide proper room sequencing.
    const roomData = await this.assetLoader.loadJSON<RoomModuleData>('data/rooms/atrium-room-square.json');
    const room = this.roomAssembler.assemble(roomData);
    this.scene.add(room.group);
    this.currentRoom = room;

    // Register room with door system
    this.doorSystem.setRoom(room);

    // Start a new encounter for the new room
    const encounter: EncounterData = {
      id: `encounter-${roomData.id}`,
      difficulty: 3,
      waves: [
        {
          delay: 500,
          spawns: [
            { enemyId: 'triangle-shard', count: 2, spawnPoint: 'random' },
            { enemyId: 'cube-sentinel', count: 1, spawnPoint: 'farthest' },
          ],
        },
      ],
    };

    const entryPosition = room.getPlayerEntry();
    const spawnPoints = room.getSpawnPoints();

    await this.encounterManager.startEncounter(
      encounter,
      roomData.id,
      spawnPoints,
      entryPosition,
    );

    console.log(`[Game] Loaded room "${roomData.id}" via ${exit.direction} door`);
    return entryPosition;
  }

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
    this.encounterManager.dispose();
    this.doorSystem.dispose();
    this.assetLoader.dispose();
    if (this.currentRoom) {
      this.currentRoom.dispose();
    }
    this.uiManager.dispose();
    this.debugOverlay.dispose();
    this.hitboxManager.clear();
    this.staggerSystem.clear();
    this.eventBus.clear();
    window.removeEventListener('keydown', this.onToggleOutline);
    window.removeEventListener('resize', this.onResize);
  }
}
