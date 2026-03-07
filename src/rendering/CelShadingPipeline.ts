import * as THREE from 'three';
import { celVertexShader } from '../shaders/celVertex';
import { celFragmentShader } from '../shaders/celFragment';

const DEFAULT_LIGHT_DIR = new THREE.Vector3(0.5, 1.0, 0.3).normalize();
const DEFAULT_AMBIENT = new THREE.Color(0.08, 0.08, 0.12);

/**
 * Creates a cel-shaded ShaderMaterial with 4-step toon ramp.
 * @param baseColor - The base color of the material.
 * @param lightDirection - Direction toward the light (default: top-right-front).
 */
export function createCelMaterial(
  baseColor: THREE.Color,
  lightDirection: THREE.Vector3 = DEFAULT_LIGHT_DIR,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: baseColor.clone() },
      uLightDirection: { value: lightDirection.clone().normalize() },
      uAmbientColor: { value: DEFAULT_AMBIENT.clone() },
      uOpacity: { value: 1.0 },
    },
    vertexShader: celVertexShader,
    fragmentShader: celFragmentShader,
  });
}
