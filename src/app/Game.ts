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
import { BossHealthBar } from '../ui/BossHealthBar';
import { ControlsOverlay } from '../ui/ControlsOverlay';
import { DebugOverlay } from '../utils/debug';
import { DamageNumbers } from '../ui/DamageNumbers';
import { DoorSystem } from '../world/DoorSystem';
import { RoomAssembler } from '../world/RoomAssembler';
import { RoomModule, type RoomModuleData, type ExitDoor } from '../world/RoomModule';
import { AssetLoader } from '../engine/AssetLoader';
import { PickupSystem } from '../interactions/PickupSystem';
import { WeaponPickup } from '../interactions/WeaponPickup';
import { MenuSystem } from '../ui/MenuSystem';
import { PauseMenu } from '../ui/PauseMenu';
import { TitleScreen } from '../ui/TitleScreen';
import { VictoryScreen } from '../ui/VictoryScreen';
import { RunState } from '../progression/RunState';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { SaveManager } from '../save/SaveManager';
import { ZoneGenerator, type ZoneLayout } from '../world/ZoneGenerator';
import { HazardSystem } from '../world/HazardSystem';
import { HubScene } from '../world/HubScene';
import { ShopUI } from '../ui/ShopUI';
import { UnlockRegistry } from '../progression/UnlockRegistry';
import { MetaProgression } from '../progression/MetaProgression';
import { AudioManager } from '../audio/AudioManager';
import { SettingsMenu } from '../ui/SettingsMenu';
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
  private pauseMenu: PauseMenu;
  private titleScreen: TitleScreen;
  private victoryScreen: VictoryScreen;
  private particleSystem: ParticleSystem;
  private runState: RunState;
  private saveManager: SaveManager;
  private zoneGenerator: ZoneGenerator;
  private hazardSystem: HazardSystem;
  private currentLayout: ZoneLayout | null = null;
  private encounterDataCache: EncounterData[] = [];
  private currentRoom: RoomModule | null = null;
  private hubScene: HubScene | null = null;
  private inHub = false;
  private shopUI: ShopUI;
  private unlockRegistry: UnlockRegistry;
  private metaProgression: MetaProgression;
  private audioManager: AudioManager;
  private bossHealthBar: BossHealthBar;
  private settingsMenu: SettingsMenu;
  private controlsOverlay: ControlsOverlay;
  /** Tracks UI state before pausing so we can restore it on resume. */
  private prePauseState: 'gameplay' | 'hub' = 'gameplay';

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
    this.playerStateMachine.setEventBus(this.eventBus);
    this.saveManager = new SaveManager(this.eventBus);
    this.audioManager = new AudioManager(this.eventBus, this.saveManager);
    this.hitboxManager = new HitboxManager();
    this.weaponSystem.setHitboxManager(this.hitboxManager, PLAYER_ENTITY_ID);
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
      getDefense: () => 0, // player base defense (future: armor pickups)
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

    // Parry buff → 1.5x player damage multiplier for 3s after successful parry
    this.combatSystem.setPlayerAttackMultiplier(
      () => this.playerStateMachine.damageMultiplier,
    );

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
    this.hud.setWeaponSystem(this.weaponSystem);
    this.hud.attach(container);
    this.uiManager = new UIManager(this.hud);
    this.bossHealthBar = new BossHealthBar(container, this.eventBus);
    this.uiManager.setBossBar(this.bossHealthBar);

    // Run state tracking (startRun called later in startZoneRun)
    this.runState = new RunState(this.eventBus);

    // Death screen
    this.menuSystem = new MenuSystem(
      container,
      this.eventBus,
      this.runState,
      () => this.handleReturnToHub(),
    );

    // Victory screen
    this.victoryScreen = new VictoryScreen(
      container,
      () => this.handleReturnToHub(),
    );

    // Settings menu (created before pause menu so pause can reference it)
    this.settingsMenu = new SettingsMenu(container, {
      getMasterVolume: () => this.audioManager.getMasterVolume(),
      getSFXVolume: () => this.audioManager.getSFXVolume(),
      getMusicVolume: () => this.audioManager.getMusicVolume(),
      getCameraSensitivity: () => this.cameraController.getSensitivity(),
      setMasterVolume: (v) => this.audioManager.setMasterVolume(v),
      setSFXVolume: (v) => this.audioManager.setSFXVolume(v),
      setMusicVolume: (v) => this.audioManager.setMusicVolume(v),
      setCameraSensitivity: (v) => this.cameraController.setSensitivity(v),
      persist: (settings) => this.saveManager.updateSettings(settings),
    }, () => this.handleSettingsClosed());

    // Pause menu
    this.pauseMenu = new PauseMenu(
      container,
      () => this.resumeGame(),
      () => this.handleQuitFromPause(),
      () => this.handleSettingsOpened(),
    );

    // Apply saved settings on startup
    const savedSettings = this.saveManager.getData().settings;
    this.cameraController.setSensitivity(savedSettings.cameraSensitivity);

    // Controls overlay — auto-shows on first run if tutorial not yet shown
    this.controlsOverlay = new ControlsOverlay(
      container,
      !savedSettings.tutorialShown,
      () => this.saveManager.updateSettings({ tutorialShown: true }),
    );

    // Hide HUD when player dies (and unpause if paused)
    this.eventBus.on('PLAYER_DIED', () => {
      if (this.uiManager.getState() === 'paused') {
        this.pauseMenu.hide();
        this.gameLoop.resume();
      }
      this.uiManager.setState('menu');
      this.audioManager.fadeAmbientOut(1.5);
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

    // Unlock registry, meta-progression, and shop UI
    this.unlockRegistry = new UnlockRegistry();
    this.metaProgression = new MetaProgression(this.unlockRegistry, this.saveManager);
    this.shopUI = new ShopUI(container, () => this.handleShopClosed());

    // Start in title state — HUD hidden, scene renders behind title overlay
    this.uiManager.setState('title');

    // Title screen — on dismiss, load weapons and enter hub
    this.titleScreen = new TitleScreen(container, () => {
      Promise.all([
        this.weaponSystem.equipWeapon('fracture-blade'),
        this.weaponSystem.equipSecondary('edge-spike'),
      ])
        .then(() => this.loadHub())
        .catch((err) => {
          console.warn('[Game] Failed to load weapon, using defaults:', err);
          this.loadHub();
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
    window.addEventListener('keydown', this.onEscapeKey);
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

    // Start run tracking and apply meta-progression bonuses
    this.runState.startRun(zoneId);
    this.playerStats.reset();
    this.metaProgression.applyBonuses(this.playerStats);
    this.audioManager.playAmbient(zoneId);
    this.hud.setRoomProgress(0, layout.rooms.length, zoneId);

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

    // Detect boss enemies in this encounter and show boss health bar
    for (const enemy of this.encounterManager.getEnemies()) {
      if (BossHealthBar.isBoss(enemy.stringId)) {
        this.bossHealthBar.showBoss(
          enemy.stringId.split('_')[0], // extract base ID (e.g. 'aggregate-boss')
          enemy.getMaxHp(),
        );
        break; // only one boss at a time
      }
    }

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

    // Skip player/hub updates while shop overlay is open
    if (this.shopUI.isActive()) {
      this.input.resetMouseDelta();
      return;
    }

    this.playerStateMachine.update(dt);

    // Update parry buff visual glow on player mesh
    this.playerModel.setParryBuffGlow(this.playerStateMachine.hasParryBuff);

    const playerPos = this.playerModel.mesh.position;

    if (this.inHub) {
      // Hub mode: only player movement, hub interaction, camera, UI
      if (this.hubScene) {
        this.playerController.resolveWallCollisions(this.hubScene.wallColliders);
        this.hubScene.update(dt, playerPos);
      }
      this.playerStats.update(dt);
      this.uiManager.update();
      this.playerModel.update(dt);
      this.debugOverlay.update(dt);
    } else {
      // Gameplay mode: full combat systems
      const walls = this.currentRoom
        ? this.currentRoom.wallColliders
        : this.testArena.wallColliders;
      this.playerController.resolveWallCollisions(walls);

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

      // Debug: F4 clear room — kill all enemies instantly
      if (this.debugOverlay.clearRoomRequested) {
        this.debugOverlay.clearRoomRequested = false;
        const enemies = this.encounterManager.getEnemies();
        for (const enemy of enemies) {
          if (!enemy.isDead()) {
            enemy.takeDamage(enemy.getHp());
          }
        }
      }

      // Lock-on system: acquire, switch, drop targets
      this.lockOnSystem.update(playerPos, this.cameraController.getYaw());
      this.cameraController.setLockOnTarget(this.lockOnSystem.getTargetPosition());
    }

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
      const rewards = this.runState.endRun(true);
      this.uiManager.setState('menu');
      this.victoryScreen.show(rewards);
      return this.playerModel.mesh.position.clone();
    }

    // Update room progress indicator
    this.hud.setRoomProgress(nextIndex, this.currentLayout.rooms.length, this.runState.currentZone);

    // Load the next room from the layout
    await this.loadRoomFromLayout(nextIndex);

    const entryPosition = this.currentRoom
      ? this.currentRoom.getPlayerEntry()
      : this.playerModel.mesh.position.clone();

    console.log(`[Game] Transitioned via ${exit.direction} door to room ${nextIndex + 1}/${this.currentLayout.rooms.length}`);
    return entryPosition;
  }

  /**
   * Called when "Return to Hub" is clicked on death/victory screen.
   * Cleans up the run and loads the hub scene.
   */
  private handleReturnToHub(): void {
    // Hide victory screen if active
    this.victoryScreen.hide();

    // Clear current encounter and hazards
    this.encounterManager.dispose();
    this.hazardSystem.clear();

    this.loadHub();
  }

  /**
   * Load the hub scene. Creates it on first call, then re-adds to scene.
   * Loads unlock registry, resets player state, positions at hub entry.
   */
  private loadHub(): void {
    // Remove current room from scene
    if (this.currentRoom) {
      this.scene.remove(this.currentRoom.group);
      this.currentRoom.dispose();
      this.currentRoom = null;
    }

    // Remove test arena if still present
    if (this.testArena.group.parent) {
      this.scene.remove(this.testArena.group);
    }

    // Load unlock data (no-op if already loaded)
    this.unlockRegistry.load(this.assetLoader).catch((err) => {
      console.warn('[Game] Failed to load unlock registry:', err);
    });

    // Create hub scene on first load
    if (!this.hubScene) {
      this.hubScene = new HubScene(
        this.input,
        this.container,
        () => this.handleStartRunFromHub(),
        () => this.handleShopActivated(),
      );
    }

    // Add hub to scene (if not already there)
    if (!this.hubScene.group.parent) {
      this.scene.add(this.hubScene.group);
    }

    this.inHub = true;

    // Reset player
    this.playerStats.reset();
    this.playerStateMachine.fsm.setState('idle');
    const entry = this.hubScene.getPlayerEntry();
    this.playerModel.mesh.position.copy(entry);

    this.uiManager.setState('hub');
    this.hud.hideRoomProgress();
    this.audioManager.playAmbient('hub');
    console.log('[Game] Hub loaded');
  }

  /**
   * Called when the player activates the hub portal.
   * Removes hub, starts a zone run.
   */
  private handleStartRunFromHub(): void {
    if (this.hubScene && this.hubScene.group.parent) {
      this.scene.remove(this.hubScene.group);
    }
    this.inHub = false;

    this.uiManager.setState('gameplay');
    this.startZoneRun('shattered-atrium').catch((err) => {
      console.error('[Game] Failed to start zone run from hub:', err);
    });
  }

  /** Called when the player interacts with the shop pedestal. */
  private handleShopActivated(): void {
    this.shopUI.show(this.saveManager, this.unlockRegistry);
    if (this.hubScene) {
      this.hubScene.setInteractionsEnabled(false);
    }
  }

  /** Called when the shop overlay is closed. */
  private handleShopClosed(): void {
    if (this.hubScene) {
      this.hubScene.setInteractionsEnabled(true);
    }
  }

  /** Called when "Settings" is clicked in pause menu. */
  private handleSettingsOpened(): void {
    this.settingsMenu.show();
  }

  /** Called when settings menu is closed (Back button). */
  private handleSettingsClosed(): void {
    this.pauseMenu.show();
  }

  // ── Pause toggle (Escape key) ─────────────────────────────────────

  private onEscapeKey = (e: KeyboardEvent): void => {
    if (e.code !== 'Escape') return;
    // If settings menu is open, close it and return to pause menu
    if (this.settingsMenu.isActive()) {
      this.settingsMenu.hide();
      this.pauseMenu.show();
      return;
    }

    const state = this.uiManager.getState();
    if (state === 'gameplay' || state === 'hub') {
      this.prePauseState = state === 'hub' ? 'hub' : 'gameplay';
      this.pauseGame();
    } else if (state === 'paused') {
      this.resumeGame();
    }
  };

  private pauseGame(): void {
    this.gameLoop.pause();
    this.uiManager.setState('paused');
    this.pauseMenu.show();
    this.audioManager.fadeAmbientOut(0.8);
  }

  private resumeGame(): void {
    this.pauseMenu.hide();
    this.uiManager.setState(this.prePauseState);
    this.gameLoop.resume();
    this.audioManager.resumeAmbient();
  }

  /** Quit Run from pause menu — ends the run and returns to hub. */
  private handleQuitFromPause(): void {
    this.pauseMenu.hide();
    this.gameLoop.resume();
    if (this.inHub) {
      // Already in hub — just resume
      this.uiManager.setState('hub');
    } else {
      this.runState.endRun(false);
      this.handleReturnToHub();
    }
  }

  private onToggleOutline = (e: KeyboardEvent): void => {
    if (e.code === 'KeyO') {
      this.postProcessing.enabled = !this.postProcessing.enabled;
      console.log(`Outline post-processing: ${this.postProcessing.enabled ? 'ON' : 'OFF'}`);
    }
    if (e.code === 'KeyM') {
      this.audioManager.toggleMute();
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
    if (this.hubScene) {
      this.hubScene.dispose();
    }
    this.damageNumbers.dispose();
    this.titleScreen.dispose();
    this.menuSystem.dispose();
    this.victoryScreen.dispose();
    this.pauseMenu.dispose();
    this.settingsMenu.dispose();
    this.controlsOverlay.dispose();
    this.shopUI.dispose();
    this.audioManager.dispose();
    this.saveManager.dispose();
    this.runState.dispose();
    this.uiManager.dispose();
    this.debugOverlay.dispose();
    this.hitboxManager.clear();
    this.staggerSystem.clear();
    this.eventBus.clear();
    window.removeEventListener('keydown', this.onToggleOutline);
    window.removeEventListener('keydown', this.onEscapeKey);
    window.removeEventListener('resize', this.onResize);
  }
}
