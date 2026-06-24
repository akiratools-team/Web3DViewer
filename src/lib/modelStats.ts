import * as THREE from "three";

export interface ModelStats {
  vertices: number;
  triangles: number;
  meshCount: number;
  materialCount: number;
  /** Bounding box width (X axis), 2 decimal places. */
  sizeX: number;
  /** Bounding box depth (Y axis), 2 decimal places. */
  sizeY: number;
  /** Bounding box height (Z axis), 2 decimal places. */
  sizeZ: number;
  center: { x: number; y: number; z: number };
}

function roundDimension(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Computes mesh statistics and axis-aligned bounding box data
 * for a loaded Three.js object hierarchy.
 */
export function computeModelStats(object: THREE.Object3D): ModelStats {
  let vertices = 0;
  let triangles = 0;
  let meshCount = 0;
  const materials = new Set<string>();

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    meshCount += 1;

    const geometry = child.geometry as THREE.BufferGeometry | undefined;
    if (!geometry) return;

    const position = geometry.attributes.position;
    if (position) {
      vertices += position.count;
    }

    const index = geometry.index;
    if (index) {
      triangles += Math.floor(index.count / 3);
    } else if (position) {
      triangles += Math.floor(position.count / 3);
    }

    const meshMaterials = Array.isArray(child.material)
      ? child.material
      : child.material
        ? [child.material]
        : [];

    for (const material of meshMaterials) {
      materials.add(material.uuid);
    }
  });

  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  return {
    vertices,
    triangles,
    meshCount,
    materialCount: materials.size,
    sizeX: roundDimension(size.x),
    sizeY: roundDimension(size.y),
    sizeZ: roundDimension(size.z),
    center: {
      x: roundDimension(center.x),
      y: roundDimension(center.y),
      z: roundDimension(center.z),
    },
  };
}
