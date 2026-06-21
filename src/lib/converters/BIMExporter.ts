import * as THREE from "three";

/**
 * BIM Exporter - exports to Dotbim format (simplified IFC-like JSON)
 * https://dotbim.io/
 */
export class BIMExporter {
  parse(root: THREE.Object3D): string {
    const meshes: THREE.Mesh[] = [];
    root.traverse((child) => {
      if (child.isMesh) {
        meshes.push(child as THREE.Mesh);
      }
    });

    const coordinates: number[] = [];
    const meshData: any[] = [];
    let coordIndex = 0;

    for (const mesh of meshes) {
      const geometry = mesh.geometry;
      const position = geometry.getAttribute("position");
      const index = geometry.getIndex();

      if (!position) continue;

      const meshCoordinates: number[] = [];
      const meshIndices: number[] = [];

      if (index) {
        // Indexed geometry
        for (let i = 0; i < index.count; i++) {
          const idx = index.getX(i);
          const x = position.getX(idx);
          const y = position.getY(idx);
          const z = position.getZ(idx);
          meshCoordinates.push(x, y, z);
        }
        // Use indices directly
        for (let i = 0; i < index.count; i++) {
          meshIndices.push(i);
        }
      } else {
        // Non-indexed geometry
        for (let i = 0; i < position.count; i++) {
          const x = position.getX(i);
          const y = position.getY(i);
          const z = position.getZ(i);
          meshCoordinates.push(x, y, z);
          meshIndices.push(i);
        }
      }

      // Add to global coordinates
      const startCoord = coordinates.length / 3;
      coordinates.push(...meshCoordinates);

      // Adjust indices to global
      const adjustedIndices = meshIndices.map((i) => i + startCoord);

      meshData.push({
        mesh_id: mesh.uuid,
        coordinates: adjustedIndices,
        type: "Mesh",
      });
    }

    // Dotbim format
    const dotbim = {
      schema_version: "1.0.0",
      file_info: {
        file_name: "exported_model.bim",
        file_date: new Date().toISOString(),
        application: "Web3DViewer",
        application_version: "1.0.0",
        author: "Web3DViewer",
      },
      elements: meshData.map((m, i) => ({
        mesh_id: m.mesh_id,
        type: "IfcBuildingElementProxy",
        color: { r: 150, g: 150, b: 200, a: 255 },
        info: { Name: `Element_${i}` },
      })),
      meshes: meshData.map((m) => ({
        mesh_id: m.mesh_id,
        coordinates: m.coordinates,
        indices: m.coordinates, // In dotbim, indices reference coordinates array
      })),
      // Flatten coordinates for dotbim
      coordinates: coordinates,
    };

    return JSON.stringify(dotbim, null, 2);
  }
}