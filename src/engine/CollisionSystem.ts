import * as THREE from 'three';

export interface AABB {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export interface SphereCollider {
  center: THREE.Vector3;
  radius: number;
}

export interface CollisionResult {
  hit: boolean;
  overlap: THREE.Vector3;
  normal: THREE.Vector3;
}

const NO_HIT: CollisionResult = {
  hit: false,
  overlap: new THREE.Vector3(),
  normal: new THREE.Vector3(),
};

// Reusable vectors to avoid per-call allocation
const _overlap = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _closest = new THREE.Vector3();
const _diff = new THREE.Vector3();

export function testAABBvsAABB(a: AABB, b: AABB): CollisionResult {
  const overlapX = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
  const overlapY = Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y);
  const overlapZ = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z);

  if (overlapX <= 0 || overlapY <= 0 || overlapZ <= 0) {
    return NO_HIT;
  }

  // Find minimum overlap axis for resolution
  const centerAX = (a.min.x + a.max.x) * 0.5;
  const centerBX = (b.min.x + b.max.x) * 0.5;
  const centerAY = (a.min.y + a.max.y) * 0.5;
  const centerBY = (b.min.y + b.max.y) * 0.5;
  const centerAZ = (a.min.z + a.max.z) * 0.5;
  const centerBZ = (b.min.z + b.max.z) * 0.5;

  _overlap.set(0, 0, 0);
  _normal.set(0, 0, 0);

  if (overlapX <= overlapY && overlapX <= overlapZ) {
    const sign = centerAX < centerBX ? -1 : 1;
    _overlap.set(overlapX * sign, 0, 0);
    _normal.set(sign, 0, 0);
  } else if (overlapY <= overlapX && overlapY <= overlapZ) {
    const sign = centerAY < centerBY ? -1 : 1;
    _overlap.set(0, overlapY * sign, 0);
    _normal.set(0, sign, 0);
  } else {
    const sign = centerAZ < centerBZ ? -1 : 1;
    _overlap.set(0, 0, overlapZ * sign);
    _normal.set(0, 0, sign);
  }

  return {
    hit: true,
    overlap: _overlap.clone(),
    normal: _normal.clone(),
  };
}

export function testSphereVsSphere(a: SphereCollider, b: SphereCollider): CollisionResult {
  _diff.subVectors(a.center, b.center);
  const distSq = _diff.lengthSq();
  const radiusSum = a.radius + b.radius;

  if (distSq >= radiusSum * radiusSum) {
    return NO_HIT;
  }

  const dist = Math.sqrt(distSq);

  if (dist === 0) {
    // Coincident spheres — push along arbitrary axis
    _normal.set(0, 1, 0);
    _overlap.set(0, radiusSum, 0);
  } else {
    _normal.copy(_diff).divideScalar(dist);
    const penetration = radiusSum - dist;
    _overlap.copy(_normal).multiplyScalar(penetration);
  }

  return {
    hit: true,
    overlap: _overlap.clone(),
    normal: _normal.clone(),
  };
}

export function testSphereVsAABB(sphere: SphereCollider, aabb: AABB): CollisionResult {
  // Find closest point on AABB to sphere center
  _closest.set(
    Math.max(aabb.min.x, Math.min(sphere.center.x, aabb.max.x)),
    Math.max(aabb.min.y, Math.min(sphere.center.y, aabb.max.y)),
    Math.max(aabb.min.z, Math.min(sphere.center.z, aabb.max.z)),
  );

  _diff.subVectors(sphere.center, _closest);
  const distSq = _diff.lengthSq();

  if (distSq >= sphere.radius * sphere.radius) {
    return NO_HIT;
  }

  const dist = Math.sqrt(distSq);

  if (dist === 0) {
    // Sphere center is inside the AABB — find minimum push-out axis
    const dx = Math.min(
      sphere.center.x - aabb.min.x,
      aabb.max.x - sphere.center.x,
    );
    const dy = Math.min(
      sphere.center.y - aabb.min.y,
      aabb.max.y - sphere.center.y,
    );
    const dz = Math.min(
      sphere.center.z - aabb.min.z,
      aabb.max.z - sphere.center.z,
    );

    _normal.set(0, 0, 0);
    if (dx <= dy && dx <= dz) {
      const sign = sphere.center.x < (aabb.min.x + aabb.max.x) * 0.5 ? -1 : 1;
      _normal.x = sign;
      _overlap.set(sign * (dx + sphere.radius), 0, 0);
    } else if (dy <= dx && dy <= dz) {
      const sign = sphere.center.y < (aabb.min.y + aabb.max.y) * 0.5 ? -1 : 1;
      _normal.y = sign;
      _overlap.set(0, sign * (dy + sphere.radius), 0);
    } else {
      const sign = sphere.center.z < (aabb.min.z + aabb.max.z) * 0.5 ? -1 : 1;
      _normal.z = sign;
      _overlap.set(0, 0, sign * (dz + sphere.radius));
    }
  } else {
    _normal.copy(_diff).divideScalar(dist);
    const penetration = sphere.radius - dist;
    _overlap.copy(_normal).multiplyScalar(penetration);
  }

  return {
    hit: true,
    overlap: _overlap.clone(),
    normal: _normal.clone(),
  };
}

export function resolveCollision(entityPosition: THREE.Vector3, collision: CollisionResult): void {
  if (!collision.hit) return;
  entityPosition.add(collision.overlap);
}
