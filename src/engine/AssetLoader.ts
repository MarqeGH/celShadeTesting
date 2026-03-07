import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Howl } from 'howler';

/**
 * Centralized asset loader with caching, type-safe JSON loading,
 * GLTF model loading, texture loading, and audio loading.
 * Tracks loading progress across all asset types.
 */

type LoadingCallback = (loaded: number, total: number) => void;

export class AssetLoader {
  private jsonCache = new Map<string, unknown>();
  private gltfCache = new Map<string, THREE.Group>();
  private textureCache = new Map<string, THREE.Texture>();
  private audioCache = new Map<string, Howl>();

  private gltfLoader = new GLTFLoader();
  private textureLoader = new THREE.TextureLoader();

  private totalAssets = 0;
  private loadedAssets = 0;
  private onProgress: LoadingCallback | null = null;

  setProgressCallback(cb: LoadingCallback): void {
    this.onProgress = cb;
  }

  private trackLoaded(): void {
    this.loadedAssets++;
    if (this.onProgress) {
      this.onProgress(this.loadedAssets, this.totalAssets);
    }
  }

  /**
   * Load and parse a JSON file with type safety.
   * Results are cached by path.
   */
  async loadJSON<T>(path: string): Promise<T> {
    const cached = this.jsonCache.get(path);
    if (cached !== undefined) {
      return cached as T;
    }

    this.totalAssets++;

    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json() as T;
      this.jsonCache.set(path, data);
      this.trackLoaded();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`AssetLoader: Failed to load JSON "${path}" — ${message}`);
    }
  }

  /**
   * Load a GLTF/GLB model. Returns a cloned Group so the cached
   * original is never modified by callers.
   */
  async loadGLTF(path: string): Promise<THREE.Group> {
    const cached = this.gltfCache.get(path);
    if (cached) {
      return cached.clone();
    }

    this.totalAssets++;

    try {
      const gltf = await new Promise<GLTF>((resolve, reject) => {
        this.gltfLoader.load(
          path,
          resolve,
          undefined,
          (event) => {
            const message = event instanceof ErrorEvent
              ? event.message
              : 'Unknown GLTF load error';
            reject(new Error(message));
          }
        );
      });

      this.gltfCache.set(path, gltf.scene);
      this.trackLoaded();
      return gltf.scene.clone();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`AssetLoader: Failed to load GLTF "${path}" — ${message}`);
    }
  }

  /**
   * Load a texture image. Cached by path.
   */
  async loadTexture(path: string): Promise<THREE.Texture> {
    const cached = this.textureCache.get(path);
    if (cached) {
      return cached;
    }

    this.totalAssets++;

    try {
      const texture = await new Promise<THREE.Texture>((resolve, reject) => {
        this.textureLoader.load(
          path,
          resolve,
          undefined,
          (event) => {
            const message = event instanceof ErrorEvent
              ? event.message
              : 'Unknown texture load error';
            reject(new Error(message));
          }
        );
      });

      this.textureCache.set(path, texture);
      this.trackLoaded();
      return texture;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`AssetLoader: Failed to load texture "${path}" — ${message}`);
    }
  }

  /**
   * Load an audio file via Howler.js. Cached by path.
   */
  async loadAudio(path: string): Promise<Howl> {
    const cached = this.audioCache.get(path);
    if (cached) {
      return cached;
    }

    this.totalAssets++;

    try {
      const howl = await new Promise<Howl>((resolve, reject) => {
        const sound = new Howl({
          src: [path],
          preload: true,
          onload: () => resolve(sound),
          onloaderror: (_id, errorMsg) => {
            reject(new Error(String(errorMsg || 'Unknown audio load error')));
          }
        });
      });

      this.audioCache.set(path, howl);
      this.trackLoaded();
      return howl;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`AssetLoader: Failed to load audio "${path}" — ${message}`);
    }
  }

  /**
   * Returns current loading progress as a ratio (0–1).
   */
  getProgress(): number {
    if (this.totalAssets === 0) return 1;
    return this.loadedAssets / this.totalAssets;
  }

  /**
   * Clear all caches and dispose GPU resources.
   */
  dispose(): void {
    this.jsonCache.clear();

    for (const group of this.gltfCache.values()) {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material?.dispose();
          }
        }
      });
    }
    this.gltfCache.clear();

    for (const texture of this.textureCache.values()) {
      texture.dispose();
    }
    this.textureCache.clear();

    for (const howl of this.audioCache.values()) {
      howl.unload();
    }
    this.audioCache.clear();

    this.totalAssets = 0;
    this.loadedAssets = 0;
  }
}
