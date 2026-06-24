import * as THREE from "three";

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

// ── Format-specific loaders (all use async dynamic import) ─────

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

async function loadPLY(file: File): Promise<THREE.Group> {
  const buffer = await readAsArrayBuffer(file);
  const { PLYLoader } = await import("three/examples/jsm/loaders/PLYLoader.js");
  try {
    const parsed = new PLYLoader().parse(buffer);
    const group = new THREE.Group();

    if ((parsed as THREE.BufferGeometry).isBufferGeometry) {
      const geometry = parsed as THREE.BufferGeometry;
      if (!geometry.getAttribute("normal")) {
        geometry.computeVertexNormals();
      }
      group.add(
        new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({ side: THREE.DoubleSide })
        )
      );
    } else if (parsed instanceof THREE.Object3D) {
      group.add(parsed);
    } else {
      throw new Error("PLYLoader returned an unsupported object type.");
    }

    return group;
  } catch (err) {
    if (err instanceof Error && err.message.includes("unsupported object type")) {
      throw err;
    }
    throw new Error("Failed to parse PLY file.");
  }
}

async function load3MF(file: File): Promise<THREE.Group> {
  const buffer = await readAsArrayBuffer(file);
  const { ThreeMFLoader } = await import(
    "three/examples/jsm/loaders/3MFLoader.js"
  );
  try {
    return new ThreeMFLoader().parse(buffer) as THREE.Group;
  } catch {
    throw new Error("Failed to parse 3MF file.");
  }
}

async function loadOFF(file: File): Promise<THREE.Group> {
  const text = await readAsText(file);
  const { OFFLoader } = await import("@/src/lib/converters/OFFLoader");
  const geo = new OFFLoader().parse(text);
  geo.computeVertexNormals();
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo));
  return group;
}

async function loadIFC(file: File): Promise<THREE.Group> {
  const { loadIFC: loadIFCFile } = await import("./ifcLoader");
  return (await loadIFCFile(file)) as THREE.Group;
}

// ── Hub & Spoke entry point ───────────────────────────────────────────────────

/**
 * Reads the file extension and dispatches to the correct parser.
 * Always resolves to a THREE.Group — all parsing is 100% client-side.
 *
 * CAD formats (.step, .stp, .iges, .igs) are routed to cadLoader which
 * uses occt-import-js (OpenCascade compiled to WASM) and runs in a Web Worker.
 */
async function loadCAD(file: File): Promise<THREE.Group> {
  const { loadCADFile } = await import("./cadLoader");
  return loadCADFile(file);
}

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

    case "ply":
      return loadPLY(file);

    case "3mf":
      return load3MF(file);

    case "off":
      return loadOFF(file);

    case "ifc":
      return (await loadIFC(file)) as THREE.Group;

    case "step":
    case "stp":
    case "iges":
    case "igs":
      return loadCAD(file);

    default:
      throw new Error(`Unsupported format: .${ext}`);
  }
}