/**
 * Generic object pool for reusing instances and avoiding runtime allocation.
 *
 * Usage:
 *   const pool = new ObjectPool(
 *     () => new Projectile(),   // factory
 *     (p) => p.reset(),         // reset function
 *     20,                       // initial size
 *   );
 *   const p = pool.acquire();
 *   // ... use p ...
 *   pool.release(p);
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private active = new Set<T>();
  private factory: () => T;
  private resetFn: (item: T) => void;

  constructor(
    factory: () => T,
    resetFn: (item: T) => void,
    initialSize = 0,
  ) {
    this.factory = factory;
    this.resetFn = resetFn;

    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
    }
  }

  /** Get an item from the pool, creating one if empty. */
  acquire(): T {
    const item = this.pool.length > 0 ? this.pool.pop()! : this.factory();
    this.resetFn(item);
    this.active.add(item);
    return item;
  }

  /** Return an item to the pool for reuse. */
  release(item: T): void {
    if (!this.active.has(item)) return;
    this.active.delete(item);
    this.pool.push(item);
  }

  /** Iterate all currently active items. */
  forEachActive(fn: (item: T) => void): void {
    for (const item of this.active) {
      fn(item);
    }
  }

  /** Release all active items back to the pool. */
  releaseAll(): void {
    for (const item of this.active) {
      this.pool.push(item);
    }
    this.active.clear();
  }

  /** Number of currently active items. */
  get activeCount(): number {
    return this.active.size;
  }

  /** Number of items available in the pool. */
  get availableCount(): number {
    return this.pool.length;
  }
}
