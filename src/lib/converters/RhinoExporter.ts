import * as THREE from "three";

/**
 * Loads rhino3dm from CDN via a script tag.
 * Completely bypasses Webpack — same approach as rhinoLoader.ts.
 */
async function loadRhinoModule(): Promise<any> {
  const w = window as any;
  if (w.__rhino3dmPromise) return w.__rhino3dmPromise;

  w.__rhino3dmPromise = new Promise((resolve, reject) => {
    if (w.rhino3dm) {
      resolve(w.rhino3dm());
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/rhino3dm@8.0.0-beta2/rhino3dm.min.js";
    script.async = true;
    script.onload = () => {
      if (w.rhino3dm) {
        resolve(w.rhino3dm());
      } else {
        reject(new Error("rhino3dm loaded but global `window.rhino3dm` not found"));
      }
    };
    script.onerror = () =>
      reject(new Error("Failed to load rhino3dm from CDN"));
    document.body.appendChild(script);
  });

  return w.__rhino3dmPromise;
}

/**
 * Rhino 3DM Exporter
 * Uses rhino3dm (McNeel's official JS library) loaded from CDN to write .3dm files
 */
export class RhinoExporter {
  private async loadRhino3dm() {
    return loadRhinoModule();
  }

  async parse(root: THREE.Object3D): Promise<ArrayBuffer> {
    const rhino = await this.loadRhino3dm();

    const file = new rhino.File3dm();

    // Default layer
    file.Layers().Add("Default", [0, 0, 0], 0);

    const meshes: THREE.Mesh[] = [];
    root.traverse((child) => {
      if (child.isMesh) {
        meshes.push(child as THREE.Mesh);
      }
    });

    for (const mesh of meshes) {
      const geometry = mesh.geometry;
      const position = geometry.getAttribute("position");
      const normal = geometry.getAttribute("normal");
      const index = geometry.getIndex();

      if (!position) continue;

      const rhinoMesh = new rhino.Mesh();

      // Add vertices
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const y = position.getY(i);
        const z = position.getZ(i);
        rhinoMesh.Vertices.Add(x, y, z);
      }

      // Add normals if available
      if (normal) {
        for (let i = 0; i < normal.count; i++) {
          const nx = normal.getX(i);
          const ny = normal.getY(i);
          const nz = normal.getZ(i);
          rhinoMesh.Normals.SetNormal(i, nx, ny, nz);
        }
        rhinoMesh.Normals.ComputeNormals();
      }

      // Add faces
      if (index) {
        for (let i = 0; i < index.count; i += 3) {
          const a = index.getX(i);
          const b = index.getX(i + 1);
          const c = index.getX(i + 2);
          rhinoMesh.Faces.AddFace(a, b, c);
        }
      } else {
        // Non-indexed
        for (let i = 0; i < position.count; i += 3) {
          rhinoMesh.Faces.AddFace(i, i + 1, i + 2);
        }
      }

      // Material/color
      if (mesh.material) {
        const mat = Array.isArray(mesh.material)
          ? mesh.material[0]
          : mesh.material;
        if (mat instanceof THREE.MeshStandardMaterial) {
          const color = mat.color;
          const rhinoColor = rhino.Color.FromArgb(
            255,
            Math.round(color.r * 255),
            Math.round(color.g * 255),
            Math.round(color.b * 255)
          );
          const materialIndex = file.Materials().Add();
          const rhinoMat = file.Materials().Get(materialIndex);
          rhinoMat.DiffuseColor = rhinoColor;
          const objectAttr = new rhino.ObjectAttributes();
          objectAttr.MaterialSource = rhino.ObjectMaterialSource.MaterialFromObject;
          objectAttr.MaterialIndex = materialIndex;
          file.Objects.AddMesh(rhinoMesh, objectAttr);
        } else {
          file.Objects.AddMesh(rhinoMesh);
        }
      } else {
        file.Objects.AddMesh(rhinoMesh);
      }
    }

    // Write to byte array
    const bytes = file.ToByteArray();
    return bytes.buffer;
  }
}