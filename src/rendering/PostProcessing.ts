import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { outlineVertexShader } from '../shaders/outlineVertex';
import { outlineFragmentShader } from '../shaders/outlineFragment';

const NORMAL_MATERIAL = new THREE.MeshNormalMaterial();

export class PostProcessing {
  private composer: EffectComposer;
  private outlinePass: ShaderPass;
  private depthTarget: THREE.WebGLRenderTarget;
  private normalTarget: THREE.WebGLRenderTarget;
  private depthMaterial: THREE.MeshDepthMaterial;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private _enabled = true;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    width: number,
    height: number,
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    // Separate render targets for depth and normals
    this.depthTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthTexture: new THREE.DepthTexture(width, height),
    });
    this.depthTarget.depthTexture.format = THREE.DepthFormat;
    this.depthTarget.depthTexture.type = THREE.UnsignedIntType;

    this.normalTarget = new THREE.WebGLRenderTarget(width, height);

    this.depthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.BasicDepthPacking,
    });

    // Composer for the main pipeline
    this.composer = new EffectComposer(renderer);

    // Pass 1: Render scene
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // Pass 2: Outline detection — use null placeholders to avoid clone issues
    this.outlinePass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        tNormal: { value: null },
        uResolution: { value: new THREE.Vector2(width, height) },
        uOutlineWidth: { value: 2.0 },
        uDepthThreshold: { value: 0.15 },
        uNormalThreshold: { value: 0.5 },
        cameraNear: { value: 0.1 },
        cameraFar: { value: 1000.0 },
      },
      vertexShader: outlineVertexShader,
      fragmentShader: outlineFragmentShader,
    });
    this.composer.addPass(this.outlinePass);

    // Pass 3: Output (gamma correction)
    this.composer.addPass(new OutputPass());

    // Set textures after construction (avoids ShaderPass clone issue)
    this.outlinePass.uniforms['tDepth'].value = this.depthTarget.depthTexture;
    this.outlinePass.uniforms['tNormal'].value = this.normalTarget.texture;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(value: boolean) {
    this._enabled = value;
  }

  setOutlineWidth(width: number): void {
    this.outlinePass.uniforms['uOutlineWidth'].value = width;
  }

  render(): void {
    if (!this._enabled) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Update camera uniforms
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.outlinePass.uniforms['cameraNear'].value = this.camera.near;
      this.outlinePass.uniforms['cameraFar'].value = this.camera.far;
    }

    const prevOverrideMaterial = this.scene.overrideMaterial;
    const prevBackground = this.scene.background;

    // Render depth to separate target
    this.scene.overrideMaterial = this.depthMaterial;
    this.scene.background = null;
    this.renderer.setRenderTarget(this.depthTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    // Render normals to separate target
    this.scene.overrideMaterial = NORMAL_MATERIAL;
    this.renderer.setRenderTarget(this.normalTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    // Restore
    this.scene.overrideMaterial = prevOverrideMaterial;
    this.scene.background = prevBackground;
    this.renderer.setRenderTarget(null);

    // Run composer pipeline (render + outline + output)
    this.composer.render();
  }

  resize(width: number, height: number): void {
    this.composer.setSize(width, height);
    this.depthTarget.setSize(width, height);
    this.normalTarget.setSize(width, height);
    this.outlinePass.uniforms['uResolution'].value.set(width, height);

    // Depth texture must be recreated at new size
    this.depthTarget.depthTexture.dispose();
    this.depthTarget.depthTexture = new THREE.DepthTexture(width, height);
    this.depthTarget.depthTexture.format = THREE.DepthFormat;
    this.depthTarget.depthTexture.type = THREE.UnsignedIntType;
    this.outlinePass.uniforms['tDepth'].value = this.depthTarget.depthTexture;
  }

  dispose(): void {
    this.depthTarget.dispose();
    this.normalTarget.dispose();
    this.composer.renderTarget1.dispose();
    this.composer.renderTarget2.dispose();
  }
}
