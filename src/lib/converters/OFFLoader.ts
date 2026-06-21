import * as THREE from "three";

/**
 * OFF (Object File Format) Loader
 * Simple polygonal mesh format - supports ASCII only for now
 */
export class OFFLoader {
  parse(text: string): THREE.BufferGeometry {
    const lines = text.trim().split(/\r?\n/);
    let lineIndex = 0;

    // Skip comments
    while (lineIndex < lines.length && lines[lineIndex].startsWith("#")) {
      lineIndex++;
    }

    // Check magic number
    if (lineIndex >= lines.length || lines[lineIndex].trim() !== "OFF") {
      throw new Error("Not a valid OFF file");
    }
    lineIndex++;

    // Parse header: vertex_count face_count edge_count
    const header = lines[lineIndex++].trim().split(/\s+/);
    const vertexCount = parseInt(header[0], 10);
    const faceCount = parseInt(header[1], 10);

    if (isNaN(vertexCount) || isNaN(faceCount)) {
      throw new Error("Invalid OFF header");
    }

    // Parse vertices
    const positions = new Float32Array(vertexCount * 3);
    for (let i = 0; i < vertexCount; i++) {
      const parts = lines[lineIndex++].trim().split(/\s+/);
      positions[i * 3] = parseFloat(parts[0]);
      positions[i * 3 + 1] = parseFloat(parts[1]);
      positions[i * 3 + 2] = parseFloat(parts[2]);
    }

    // Parse faces (triangulate polygons)
    const indices: number[] = [];
    for (let i = 0; i < faceCount; i++) {
      const parts = lines[lineIndex++].trim().split(/\s+/);
      const vertexCountInFace = parseInt(parts[0], 10);

      // Triangulate: fan triangulation
      for (let j = 1; j < vertexCountInFace - 1; j++) {
        indices.push(parseInt(parts[1], 10));
        indices.push(parseInt(parts[1 + j], 10));
        indices.push(parseInt(parts[1 + j + 1], 10));
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
    geometry.computeVertexNormals();

    return geometry;
  }
}