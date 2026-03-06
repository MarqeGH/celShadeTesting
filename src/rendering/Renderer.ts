import * as THREE from 'three';

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(0x1a1a1a);
    container.appendChild(this.renderer.domElement);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.render(scene, camera);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height);
  }

  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }
}
