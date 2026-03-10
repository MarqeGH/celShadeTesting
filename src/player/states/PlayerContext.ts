import { InputManager } from '../../app/InputManager';
import { PlayerController } from '../PlayerController';
import { PlayerStats } from '../PlayerStats';
import { PlayerModel } from '../PlayerModel';
import { CameraController } from '../../camera/CameraController';
import { WeaponSystem } from '../../combat/WeaponSystem';
import { EventBus } from '../../app/EventBus';

// ── Context shared by all player states ─────────────────────────

export interface PlayerContext {
  input: InputManager;
  controller: PlayerController;
  stats: PlayerStats;
  model: PlayerModel;
  camera: CameraController;
  weaponSystem: WeaponSystem;
  eventBus?: EventBus;
}

// ── Helper: check for any movement input ────────────────────────

export function hasMovementInput(input: InputManager): boolean {
  return (
    input.isPressed('moveForward') ||
    input.isPressed('moveBack') ||
    input.isPressed('moveLeft') ||
    input.isPressed('moveRight')
  );
}

// ── Helper: check action transitions common to idle/run ─────────

export function checkActionTransitions(input: InputManager, stats: PlayerStats): string | null {
  if (input.justPressed('dodge') && stats.canPerformAction('dodge')) {
    stats.drainStamina('dodge');
    return 'dodge';
  }
  if (input.justPressed('parry') && stats.canPerformAction('parry')) {
    stats.drainStamina('parry');
    return 'parry';
  }
  if (input.justPressed('lightAttack') && stats.canPerformAction('light_attack')) {
    stats.drainStamina('light_attack');
    return 'light_attack';
  }
  if (input.justPressed('heavyAttack') && stats.canPerformAction('heavy_attack')) {
    stats.drainStamina('heavy_attack');
    return 'heavy_attack';
  }
  if (input.justPressed('heal') && stats.canHeal()) {
    return 'heal';
  }
  return null;
}
