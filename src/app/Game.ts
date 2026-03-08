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
import { LockOnSystem } from '../camera/LockOnSystem';
import { CameraShake } from '../camera/CameraShake';
import { createCelMaterial } from '../rendering/CelShadingPipeline';
import { TestArena } from '../world/RoomModule';
import { WeaponSystem } from '../combat/WeaponSystem';
import { HitboxManager } from '../combat/HitboxManager';
import { CombatSystem, CombatEntity, PLAYER_ENTITY_ID } from '../combat/CombatSystem';
import { StaggerSystem, PLAYER_POISE_CONFIG } from '../combat/StaggerSystem';
import { EventBus } from './EventBus';
import '../enemies/triangle-shard/TriangleShard'; // side-effect: registers in EnemyRegistry
import '../enemies/cube-sentinel/CubeSentinel'; // side-effect: registers in EnemyRegistry
import '../enemies/spiral-dancer/SpiralDancer'; // side-effect: registers in EnemyRegistry
import '../enemies/monolith-brute/MonolithBrute'; // side-effect: registers in EnemyRegistry
import '../enemies/aggregate-boss/AggregateBoss'; // side-effect: registers in EnemyRegistry
import '../enemies/lattice-weaver/LatticeWeaver'; // side-effect: registers in EnemyRegistry
import { EncounterManager, EncounterData } from '../world/EncounterManager';
import { HUD } from '../ui/HUD';
import { UIManager } from '../ui/UIManager';
import { DebugOverlay } from '../utils/debug';
import { DamageNumbers } from '../ui/DamageNumbers';
import { DoorSystem } from '../world/DoorSystem';
import { RoomAssembler } from '../world/RoomAssembler';
import { RoomModule, type RoomModuleData, type ExitDoor } from '../world/RoomModule';
import { AssetLoader } from '../engine/AssetLoader';
import { PickupSystem } from '../interactions/PickupSystem';
import { WeaponPickup } from '../interactions/WeaponPickup';
import { MenuSystem } from '../ui/MenuSystem';
import { TitleScreen } from '../ui/TitleScreen';
import { RunState } from '../progression/RunState';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { SaveManager } from '../save/SaveManager';
import { ZoneGenerator, type ZoneLayout } from '../world/ZoneGenerator';
import { HazardSystem } from '../world/HazardSystem';
import '../levels/Zone1Config'; // side-effect: registers zone config in ZoneRegistry

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
  private damageNumbers: DamageNumbers;
  private debugOverlay: DebugOverlay;
  private encounterManager: EncounterManager;
  private lockOnSystem: LockOnSystem;
  private cameraShake: CameraShake;
  private doorSystem: DoorSystem;
  private roomAssembler: RoomAssembler;
  private assetLoader: AssetLoader;
  private pickupSystem: PickupSystem;
  private weaponPickup: WeaponPickup;
  private menuSystem: MenuSystem;
  private titleScreen: TitleScreen;
  private particleSystem: ParticleSystem;
  private runState: RunState;
  private saveManager: SaveManager;
  private zoneGenerator: ZoneGenerator;
  private hazardSystem: HazardSystem;
  private currentLayout: ZoneLayout | null = null;
  private encounterDataCache: EncounterData[] = [];
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
    this.weaponSystem.setEventBus(this.eventBus);
    this.saveManager = new SaveManager(this.eventBus);
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

    // Register parry handler so CombatSystem can check parry state on player hits
    this.combatSystem.setParryHandler({
      check: () => {
        if (this.playerStateMachine.isInParryWindow) return 'success';
        if (this.playerStateMachine.isInParryRecovery) return 'fail';
        return null;
      },
      onSuccess: () => this.playerStateMachine.notifyParrySuccess(),
      onFail: () => this.playerStateMachine.notifyParryFail(),
    });

    // Encounter manager
    this.encounterManager = new EncounterManager(
      this.eventBus, this.hitboxManager, this.combatSystem, this.staggerSystem, this.scene,
    );
    // Provide test arena wall colliders for enemy collision
    this.encounterManager.setWallColliders(this.testArena.wallColliders);

    // Pickup system — listens for ENEMY_DIED, spawns shard pickups
    this.pickupSystem = new PickupSystem(this.scene, this.eventBus);

    // Weapon pickup — listens for ROOM_CLEARED, 40% chance to spawn weapon pickup
    this.weaponPickup = new WeaponPickup(
      this.scene, this.eventBus, this.input, this.weaponSystem, container,
    );

    // Particle system — geometric particle effects for combat/pickup feedback
    this.particleSystem = new ParticleSystem(
      this.scene, this.eventBus, () => this.playerModel.mesh.position,
    );

    // Lock-on system
    this.lockOnSystem = new LockOnSystem(
      this.input,
      this.eventBus,
      () => this.encounterManager.getEnemies(),
    );
    this.lockOnSystem.attachUI(container, this.camera);

    // Camera shake
    this.cameraShake = new CameraShake(this.camera, this.eventBus);

    // Damage numbers
    this.damageNumbers = new DamageNumbers(
      container, this.camera, this.eventBus,
      () => this.playerModel.mesh.position,
    );

    // HUD and UI
    this.hud = new HUD(this.playerStats, this.eventBus);
    this.hud.attach(container);
    this.uiManager = new UIManager(this.hud);

    // Run state tracking (startRun called later in startZoneRun)
    this.runState = new RunState(this.eventBus);

    // Death screen
    this.menuSystem = new MenuSystem(
      container,
      this.eventBus,
      this.runState,
      () => this.handleReturnToHub(),
    );

    // Hide HUD when player dies
    this.eventBus.on('PLAYER_DIED', () => {
      this.uiManager.setState('menu');
    });

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

    // Zone generator and room assembly
    this.zoneGenerator = new ZoneGenerator();
    this.assetLoader = new AssetLoader();
    this.roomAssembler = new RoomAssembler();
    this.hazardSystem = new HazardSystem(this.scene, this.eventBus, this.playerStats);
    this.doorSystem = new DoorSystem(this.eventBus, this.input, container);
    this.doorSystem.setPlayerPosition(this.playerModel.mesh.position);
    this.doorSystem.setTransitionCallback(async (exit) => {
      return this.handleRoomTransition(exit);
    });

    // Start in title state — HUD hidden, scene renders behind title overlay
    this.uiManager.setState('title');

    // Title screen — on dismiss, load weapons and start zone run
    this.titleScreen = new TitleScreen(container, () => {
      this.uiManager.setState('gameplay');
      Promise.all([
        this.weaponSystem.equipWeapon('fracture-blade'),
        this.weaponSystem.equipSecondary('edge-spike'),
      ])
        .then(() => this.startZoneRun('shattered-atrium'))
        .catch((err) => {
          console.warn('[Game] Failed to load weapon, using defaults:', err);
          this.startZoneRun('shattered-atrium');
        });
    });

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

  /**
   * Start a zone run: generate layout, load first room + encounter.
   */
  private async startZoneRun(zoneId: string): Promise<void> {
    // Load encounter definitions from JSON
    try {
      this.encounterDataCache = await this.assetLoader.loadJSON<EncounterData[]>(
        'data/encounters/zone1-encounters.json',
      );
    } catch (err) {
      console.error('[Game] Failed to load encounter data:', err);
      this.encounterDataCache = [];
    }

    // Generate zone layout
    const layout = this.zoneGenerator.generate(zoneId);
    if (!layout || layout.rooms.length === 0) {
      console.error(`[Game] Failed to generate layout for zone "${zoneId}"`);
      return;
    }
    this.currentLayout = layout;

    // Start run tracking
    this.runState.startRun(zoneId);

    // Load the first room from the layout
    await this.loadRoomFromLayout(0);
  }

  /**
   * Load a room and its encounter from the current zone layout by index.
   */
  private async loadRoomFromLayout(roomIndex: number): Promise<void> {
    if (!this.currentLayout) return;

    const entry = this.currentLayout.rooms[roomIndex];
    if (!entry) {
      console.warn(`[Game] No room at index ${roomIndex} in layout`);
      return;
    }

    // Unload current room if exists
    this.hazardSystem.clear();
    if (this.currentRoom) {
      this.scene.remove(this.currentRoom.group);
      this.currentRoom.dispose();
      this.currentRoom = null;
    }

    // Remove test arena from scene on first room load
    if (this.testArena.group.parent) {
      this.scene.remove(this.testArena.group);
    }

    // Load room JSON (fall back to atrium-room-square if missing)
    let roomData: RoomModuleData;
    try {
      roomData = await this.assetLoader.loadJSON<RoomModuleData>(
        `data/rooms/${entry.roomId}.json`,
      );
    } catch {
      console.warn(`[Game] Room "${entry.roomId}" not found, falling back to atrium-room-square`);
      roomData = await this.assetLoader.loadJSON<RoomModuleData>(
        'data/rooms/atrium-room-square.json',
      );
    }

    // Assemble and add to scene (pass hazardSystem so hazards are spawned)
    const room = this.roomAssembler.assemble(roomData, this.hazardSystem);
    this.scene.add(room.group);
    this.currentRoom = room;

    // Register with door system and encounter manager
    this.doorSystem.setRoom(room);
    this.encounterManager.setWallColliders(room.wallColliders);

    // Look up encounter data
    const encounter = this.findEncounter(entry.encounterId);
    if (!encounter) {
      console.error(`[Game] Encounter "${entry.encounterId}" not found in cache`);
      return;
    }

    // Position player and start encounter
    const entryPosition = room.getPlayerEntry();
    const spawnPoints = room.getSpawnPoints();
    this.playerModel.mesh.position.copy(entryPosition);

    await this.encounterManager.startEncounter(
      encounter,
      roomData.id,
      spawnPoints,
      entryPosition,
    );

    console.log(
      `[Game] Room ${roomIndex + 1}/${this.currentLayout.rooms.length}: ` +
      `"${entry.roomId}" + encounter "${entry.encounterId}" (difficulty ${entry.actualDifficulty})`,
    );
  }

  /**
   * Find an encounter in the cached encounter data by ID.
   */
  private findEncounter(encounterId: string): EncounterData | null {
    const found = this.encounterDataCache.find((e) => e.id === encounterId);
    if (!found) {
      console.warn(`[Game] Encounter "${encounterId}" not found in encounter data cache`);
      return null;
    }
    return found;
  }

  private addTestCube(): void {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = createCelMaterial(new THREE.Color(0x4488aa));
    this.testCube = new THREE.Mesh(geometry, material);
    this.scene.add(this.testCube);
  }

  private update(dt: number): void {
    this.input.update();

    // Skip gameplay updates while on title screen
    if (this.uiManager.getState() === 'title') {
      this.input.resetMouseDelta();
      return;
    }

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
    this.hazardSystem.update(dt, playerPos);
    this.pickupSystem.update(dt, playerPos);
    this.weaponPickup.update(dt, playerPos);
    this.particleSystem.update(dt);
    this.doorSystem.update(dt);
    this.playerStats.update(dt);
    this.uiManager.update();
    this.playerModel.update(dt);
    this.debugOverlay.update(dt);

    // Lock-on system: acquire, switch, drop targets
    this.lockOnSystem.update(playerPos, this.cameraController.getYaw());
    this.cameraController.setLockOnTarget(this.lockOnSystem.getTargetPosition());

    // Update camera orbit and follow
    this.cameraController.update(dt, this.playerModel.mesh.position);
    this.cameraShake.update(dt);

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

    // Advance to next room in the zone layout
    this.runState.advanceRoom();

    if (!this.currentLayout) {
      console.error('[Game] No zone layout active during room transition');
      return this.playerModel.mesh.position.clone();
    }

    const nextIndex = this.runState.currentRoomIndex;

    // Check if zone is complete
    if (nextIndex >= this.currentLayout.rooms.length) {
      console.log('[Game] Zone complete! All rooms cleared.');
      // Restart the zone for now (future: victory screen)
      await this.startZoneRun(this.currentLayout.zoneId);
      return this.playerModel.mesh.position.clone();
    }

    // Load the next room from the layout
    await this.loadRoomFromLayout(nextIndex);

    const entryPosition = this.currentRoom
      ? this.currentRoom.getPlayerEntry()
      : this.playerModel.mesh.position.clone();

    console.log(`[Game] Transitioned via ${exit.direction} door to room ${nextIndex + 1}/${this.currentLayout.rooms.length}`);
    return entryPosition;
  }

  /**
   * Called when "Return to Hub" is clicked on death screen.
   * Resets player, encounter, and restarts a fresh run.
   */
  private handleReturnToHub(): void {
    // Reset player state
    this.playerStats.reset();
    this.playerStateMachine.fsm.setState('idle');
    this.playerModel.mesh.position.set(0, 0, 0);

    // Clear current encounter and hazards
    this.encounterManager.dispose();
    this.hazardSystem.clear();

    // Restore HUD
    this.uiManager.setState('gameplay');

    // Start a fresh zone run (generates new layout)
    this.startZoneRun('shattered-atrium').catch((err) => {
      console.error('[Game] Failed to restart zone run:', err);
    });
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
    this.hazardSystem.dispose();
    this.pickupSystem.dispose();
    this.weaponPickup.dispose();
    this.particleSystem.dispose();
    this.lockOnSystem.dispose();
    this.cameraShake.dispose();
    this.doorSystem.dispose();
    this.assetLoader.dispose();
    if (this.currentRoom) {
      this.currentRoom.dispose();
    }
    this.damageNumbers.dispose();
    this.titleScreen.dispose();
    this.menuSystem.dispose();
    this.saveManager.dispose();
    this.runState.dispose();
    this.uiManager.dispose();
    this.debugOverlay.dispose();
    this.hitboxManager.clear();
    this.staggerSystem.clear();
    this.eventBus.clear();
    window.removeEventListener('keydown', this.onToggleOutline);
    window.removeEventListener('resize', this.onResize);
  }
}
