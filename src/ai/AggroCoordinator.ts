/**
 * AggroCoordinator — limits how many enemies can attack the player simultaneously.
 *
 * Per the combat spec: max 2 enemies actively attacking at once; others orbit/reposition.
 * Enemies request an "attack token" before entering their attack state. If denied,
 * they orbit at range or wait. Tokens auto-expire after TOKEN_EXPIRY_TIME to prevent
 * deadlocks (e.g. if an enemy dies mid-attack without releasing).
 */

/** Max simultaneous attack tokens */
const MAX_TOKENS = 2;
/** Auto-expire time for tokens in seconds (prevents deadlocks) */
const TOKEN_EXPIRY_TIME = 3.0;

interface TokenEntry {
  entityId: number;
  /** Time remaining before this token auto-expires */
  timer: number;
}

export class AggroCoordinator {
  private tokens: TokenEntry[] = [];

  /**
   * Request an attack token for the given entity.
   * Returns true if the token was granted (entity may attack).
   * Returns true immediately if the entity already holds a token (refreshes it).
   */
  requestToken(entityId: number): boolean {
    // Already holding a token — refresh timer
    const existing = this.tokens.find((t) => t.entityId === entityId);
    if (existing) {
      existing.timer = TOKEN_EXPIRY_TIME;
      return true;
    }

    // Slots available
    if (this.tokens.length < MAX_TOKENS) {
      this.tokens.push({ entityId, timer: TOKEN_EXPIRY_TIME });
      return true;
    }

    return false;
  }

  /**
   * Release the attack token held by an entity.
   * Called when attack completes, enemy staggers, or enemy dies.
   */
  releaseToken(entityId: number): void {
    const idx = this.tokens.findIndex((t) => t.entityId === entityId);
    if (idx !== -1) {
      this.tokens.splice(idx, 1);
    }
  }

  /** Returns true if the given entity currently holds an attack token. */
  hasToken(entityId: number): boolean {
    return this.tokens.some((t) => t.entityId === entityId);
  }

  /** Number of tokens currently in use. */
  get activeCount(): number {
    return this.tokens.length;
  }

  /**
   * Tick token expiry timers. Call once per frame.
   * Expired tokens are silently removed (deadlock prevention).
   */
  update(dt: number): void {
    for (let i = this.tokens.length - 1; i >= 0; i--) {
      this.tokens[i].timer -= dt;
      if (this.tokens[i].timer <= 0) {
        this.tokens.splice(i, 1);
      }
    }
  }

  /** Remove all tokens (e.g. encounter reset). */
  clear(): void {
    this.tokens.length = 0;
  }
}
