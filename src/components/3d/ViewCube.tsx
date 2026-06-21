"use client";

import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";

/**
 * Simple ViewCube component for camera orientation control.
 * Displays a wireframe cube in the corner of the view.
 */
export function ViewCube() {
  const { camera, gl } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!groupRef.current) return;

    const edges = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(1, 1, 1).trim(new THREE.Vector3(0.5, 0.5, 0.5))
    );
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
    );
    groupRef.current.add(line);

    const axes = new THREE.AxisHelper(0.5);
    axes.material.transparent = true;
    axes.material.opacity = 0.5;
    groupRef.current.add(axes);
  }, []);

  return (
    <group
      ref={groupRef}
      position={[1.4, -1.4, 0]}
      scale={[0.5, 0.5, 0.5]}
    />
  );
}