import * as THREE from 'three';

/** Linear interpolation between a and b by factor t (0–1). */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp value between min and max (inclusive). */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Random float in [min, max). */
export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Random integer in [min, max] (inclusive). */
export function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

/** Convert degrees to radians. */
export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/** Convert radians to degrees. */
export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}

const _tempVec = new THREE.Vector3();

/** Euclidean distance between two Vector3 positions. */
export function distanceVec3(a: THREE.Vector3, b: THREE.Vector3): number {
  return _tempVec.subVectors(a, b).length();
}

/** Linearly interpolate between two Vector3s, writing the result into `out`. */
export function lerpVec3(
  a: THREE.Vector3,
  b: THREE.Vector3,
  t: number,
  out: THREE.Vector3
): THREE.Vector3 {
  out.x = a.x + (b.x - a.x) * t;
  out.y = a.y + (b.y - a.y) * t;
  out.z = a.z + (b.z - a.z) * t;
  return out;
}
