import * as THREE from "three";
import { resolveClass } from "./resolveExport";

// ── FileReader promise helpers ────────────────────────────────────────────────

function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target!.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsArrayBuffer(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target!.result as string);
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsText(file);
  });
}

// ── Format-specific loaders (all use async dynamic import + resolveExport) ─────

async function loadSTL(file: File): Promise<THREE.Group> {
  const buffer = await readAsArrayBuffer(file);
  const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
  try {
    const geo = new STLLoader().parse(buffer);
    geo.computeVertexNormals();
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geo));
    return group;
  } catch {
    throw new Error("Failed to parse STL file.");
  }
}

async function loadOBJ(file: File): Promise<THREE.Group> {
  const text = await readAsText(file);
  const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
  try {
    return new OBJLoader().parse(text);
  } catch {
    throw new Error("Failed to parse OBJ file.");
  }
}

async function loadFBX(file: File): Promise<THREE.Group> {
  const buffer = await readAsArrayBuffer(file);
  const { FBXLoader } = await import("three/examples/jsm/loaders/FBXLoader.js");
  try {
    return new FBXLoader().parse(buffer, "") as THREE.Group;
  } catch {
    throw new Error("Failed to parse FBX file.");
  }
}

async function loadGLTF(file: File): Promise<THREE.Group> {
  const buffer = await readAsArrayBuffer(file);
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  return new Promise<THREE.Group>((resolve, reject) => {
    new GLTFLoader().parse(
      buffer,
      "",
      (gltf) => resolve(gltf.scene),
      (err) => reject(new Error(`Failed to parse GLTF/GLB file. ${err}`))
    );
  });
}

async function load3DS(file: File): Promise<THREE.Group> {
  const buffer = await readAsArrayBuffer(file);
  const { TDSLoader } = await import("three/examples/jsm/loaders/TDSLoader.js");
  try {
    return new TDSLoader().parse(buffer) as THREE.Group;
  } catch {
    throw new Error("Failed to parse 3DS file.");
  }
}

async function loadPLY(file: File): Promise<THREE.Group> {
  const buffer = await readAsArrayBuffer(file);
  const { PLYLoader } = await import("three/examples/jsm/loaders/PLYLoader.js");
  try {
    return new PLYLoader().parse(buffer) as THREE.Group;
  } catch {
    throw new Error("Failed to parse PLY file.");
  }
}

async function loadOFF(file: File): Promise<THREE.Group> {
  const text = await readAsText(file);
  const mod = await import("@/src/lib/converters/OFFLoader");
  const OFFLoader = resolveClass<typeof OFFLoader>(mod, "OFFLoader");
  const geo = new OFFLoader().parse(text);
  geo.computeVertexNormals();
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo));
  return group;
}

async function loadDAE(file: File): Promise<THREE.Group> {
  const text = await readAsText(file);
  const { ColladaLoader } = await import("three/examples/jsm/loaders/ColladaLoader.js");
  try {
    const result = new ColladaLoader().parse(text);
    return result.scene;
  } catch {
    throw new Error("Failed to parse DAE/Collada file.");
  }
}

async function loadWRL(file: File): Promise<THREE.Group> {
  const text = await readAsText(file);
  const { VRMLLoader } = await import("three/examples/jsm/loaders/VRMLLoader.js");
  try {
    return new VRMLLoader().parse(text) as THREE.Group;
  } catch {
    throw new Error("Failed to parse WRL/VRML file.");
  }
}

async function loadIFCA(file: File): Promise<THREE.Group> {
  // IFC would need a proper loader - for now delegate to a generic loader
  // This is a placeholder - IFC support requires a dedicated library
  throw new Error("IFC format not yet supported. Please convert to STEP/GLTF first.");
}

// ── Hub & Spoke entry point ───────────────────────────────────────────────────

/**
 * Reads the file extension and dispatches to the correct parser.
 * Always resolves to a THREE.Group — all parsing is 100% client-side.
 *
 * CAD formats (.step, .stp, .iges, .igs) are routed to cadLoader which
 * uses occt-import-js (OpenCascade compiled to WASM) and runs in a Web Worker.
 */
export async function loadModel(file: File): Promise<THREE.Group> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  switch (ext) {
    case "stl":
      return loadSTL(file);

    case "obj":
      return loadOBJ(file);

    case "fbx":
      return loadFBX(file);

    case "gltf":
    case "glb":
      return loadGLTF(file);

    case "3ds":
      return load3DS(file);

    case "ply":
      return loadPLY(file);

    case "off":
      return loadOFF(file);

    case "dae":
      return loadDAE(file);

    case "wrl":
    case "vrml":
      return loadWRL(file);

    case "ifc":
      return loadIFCA(file);

    case "step":
    case "stp":
    case "iges":
    case "igs": {
      // Dynamic import — cadLoader + its WASM dependency load on demand
      const { loadCADFile } = await import("./cadLoader");
      return loadCADFile(file);
    }

    // 3DM is handled by Rhino loader
    case "3dm": {
      const { loadRhinoFile } = await import("./rhinoLoader");
      return loadRhinoFile(file);
    }

    case "bim": {
      const { loadBIMFile } = await import("./BIMLoader");
      return loadBIMFile(file);
    }

    default:
      throw new Error(`Unsupported format: .${ext}`);
  }
}