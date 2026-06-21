import * as THREE from "three";

/**
 * Loads rhino3dm from CDN via a script tag.
 * This completely bypasses Webpack — no import() statement touches
 * the rhino3dm package, so the Emscripten `require("ws")` is never parsed.
 */
async function loadRhinoModule(): Promise<any> {
  const w = window as any;
  if (w.__rhino3dmPromise) return w.__rhino3dmPromise;

  w.__rhino3dmPromise = new Promise((resolve, reject) => {
    // If already loaded (e.g. a previous call completed), reuse it
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
 * Rhino 3DM Loader
 * Uses rhino3dm (McNeel's official JS library) loaded from CDN to read .3dm files
 */
export async function loadRhinoFile(file: File): Promise<THREE.Group> {
  const buffer = await file.arrayBuffer();
  const rhino = await loadRhinoModule();

  const rhinoFile = rhino.File3dm.FromByteArray(new Uint8Array(buffer));
  if (!rhinoFile) {
    throw new Error("Failed to parse 3DM file");
  }

  const group = new THREE.Group();

  // Iterate through objects
  const objectCount = rhinoFile.Objects().Count();
  for (let i = 0; i < objectCount; i++) {
    const rhinoObj = rhinoFile.Objects().Get(i);
    if (!rhinoObj) continue;

    const geometry = rhinoObj.Geometry();
    if (!geometry) continue;

    // Handle different geometry types
    if (geometry.ObjectType === rhino.ObjectType.Mesh) {
      const rhinoMesh = geometry as any;
      const threeMesh = convertRhinoMesh(rhinoMesh, rhino);
      if (threeMesh) {
        threeMesh.name = rhinoObj.Name() || `Mesh_${i}`;
        group.add(threeMesh);
      }
    } else if (geometry.ObjectType === rhino.ObjectType.Brep) {
      // For BREP, we'd need to mesh it first
      const rhinoBrep = geometry as any;
      const meshes = rhino.Mesh.CreateFromBrep(
        rhinoBrep,
        rhino.MeshingParameters.Default()
      );
      if (meshes && meshes.length > 0) {
        for (let j = 0; j < meshes.length; j++) {
          const threeMesh = convertRhinoMesh(meshes[j], rhino);
          if (threeMesh) {
            threeMesh.name = `${rhinoObj.Name() || `Brep_${i}`}_${j}`;
            group.add(threeMesh);
          }
        }
      }
    }
  }

  return group;
}

function convertRhinoMesh(rhinoMesh: any, rhino: any): THREE.Mesh | null {
  const vertexCount = rhinoMesh.Vertices.Count();
  if (vertexCount === 0) return null;

  const geometry = new THREE.BufferGeometry();

  // Vertices
  const positions = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) {
    const v = rhinoMesh.Vertices.Get(i);
    positions[i * 3] = v.X;
    positions[i * 3 + 1] = v.Y;
    positions[i * 3 + 2] = v.Z;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  // Normals
  if (rhinoMesh.Normals.Count() > 0) {
    const normals = new Float32Array(vertexCount * 3);
    for (let i = 0; i < vertexCount; i++) {
      const n = rhinoMesh.Normals.Get(i);
      normals[i * 3] = n.X;
      normals[i * 3 + 1] = n.Y;
      normals[i * 3 + 2] = n.Z;
    }
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  }

  // Faces (triangles)
  const faceCount = rhinoMesh.Faces.Count();
  if (faceCount > 0) {
    const indices = new Uint32Array(faceCount * 3);
    for (let i = 0; i < faceCount; i++) {
      const face = rhinoMesh.Faces.GetFace(i);
      indices[i * 3] = face.A;
      indices[i * 3 + 1] = face.B;
      indices[i * 3 + 2] = face.C;
    }
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  } else {
    // Generate triangles from vertices if no faces
    const indices: number[] = [];
    for (let i = 0; i < vertexCount; i += 3) {
      if (i + 2 < vertexCount) {
        indices.push(i, i + 1, i + 2);
      }
    }
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
  }

  if (!rhinoMesh.Normals.Count()) {
    geometry.computeVertexNormals();
  }

  // Material
  const material = new THREE.MeshStandardMaterial({
    color: 0x8b9bb4,
    roughness: 0.45,
    metalness: 0.35,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geometry, material);
}