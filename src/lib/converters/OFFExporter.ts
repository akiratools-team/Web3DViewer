import * as THREE from "three";

/**
 * OFF (Object File Format) Exporter
 * Simple polygonal mesh format - ASCII only
 */
export class OFFExporter {
  parse(root: THREE.Object3D): string {
    const meshes: THREE.Mesh[] = [];
    root.traverse((child) => {
      if (child.isMesh) {
        meshes.push(child as THREE.Mesh);
      }
    });

    if (meshes.length === 0) {
      return "OFF\n0 0 0\n";
    }

    // Collect all vertices and faces
    let allPositions: number[] = [];
    let allFaces: number[][] = [];
    let vertexOffset = 0;

    for (const mesh of meshes) {
      const geometry = mesh.geometry;
      const position = geometry.getAttribute("position");
      const index = geometry.getIndex();

      if (!position) continue;

      // Get vertices
      for (let i = 0; i < position.count; i++) {
        allPositions.push(position.getX(i), position.getY(i), position.getZ(i));
      }

      // Get faces
      if (index) {
        for (let i = 0; i < index.count; i += 3) {
          const a = index.getX(i) + vertexOffset;
          const b = index.getX(i + 1) + vertexOffset;
          const c = index.getX(i + 2) + vertexOffset;
          allFaces.push([3, a, b, c]);
        }
      } else {
        for (let i = 0; i < position.count; i += 3) {
          allFaces.push([3, vertexOffset + i, vertexOffset + i + 1, vertexOffset + i + 2]);
        }
      }

      vertexOffset += position.count;
    }

    // Build OFF text
    const lines: string[] = [];
    lines.push("OFF");
    lines.push(`${allPositions.length / 3} ${allFaces.length} 0`);

    // Vertices
    for (let i = 0; i < allPositions.length; i += 3) {
      lines.push(`${allPositions[i]} ${allPositions[i + 1]} ${allPositions[i + 2]}`);
    }

    // Faces
    for (const face of allFaces) {
      lines.push(face.join(" "));
    }

    return lines.join("\n");
  }
}