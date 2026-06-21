"use client";

import * as THREE from "three";

// ── Local types for occt-import-js ───────────────────────────────────────────
//
// Core schema (always present):
//   name, meshes[], children[] on nodes
//   attributes.position / index / optional normal on meshes
//
// Optional transform fields — not emitted by occt-import-js v0.0.23, but
// checked and applied when present (future library versions, forks, or
// extended payloads).  Without these fields STEP files still receive
// world-space vertices baked in by OpenCascade at tessellation time.

type TransformCarrier = {
  matrix?: ArrayLike<number>;
  transform?: ArrayLike<number>;
  location?: ArrayLike<number> | { matrix?: ArrayLike<number>; transform?: ArrayLike<number> };
  position?: ArrayLike<number> | { x?: number; y?: number; z?: number };
  rotation?: ArrayLike<number> | { x?: number; y?: number; z?: number; order?: string };
  quaternion?: ArrayLike<number> | { x?: number; y?: number; z?: number; w?: number };
  scale?: ArrayLike<number> | { x?: number; y?: number; z?: number } | number;
};

type OcctNode = TransformCarrier & {
  name: string;
  meshes: number[];
  children: OcctNode[];
};

type OcctMeshData = TransformCarrier & {
  name: string;
  color?: [number, number, number];
  brep_faces?: Array<{
    first: number;
    last: number;
    color: [number, number, number] | null;
  }>;
  /** Legacy JSON arrays (unused when loading via worker transferables). */
  attributes?: {
    position: { array: number[] };
    normal?: { array: number[] };
  };
  index?: { array: number[] };
  /** Zero-copy geometry buffers transferred from the worker. */
  positionBuffer?: ArrayBuffer;
  normalBuffer?: ArrayBuffer;
  indexBuffer?: ArrayBuffer;
};

type OcctResult = {
  success: boolean;
  root: OcctNode;
  meshes: OcctMeshData[];
};

// ── Worker wire types ─────────────────────────────────────────────────────────

type WorkerRequest = {
  buffer: ArrayBuffer;
  ext: string;
};

type WorkerResponse =
  | { type: "result"; result: OcctResult }
  | { type: "error"; message: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Read a File into a raw ArrayBuffer.
 *
 * We return ArrayBuffer (not Uint8Array) so it can be transferred to the
 * worker with zero copy via the Transferable[] argument of postMessage.
 * Once transferred, the buffer is detached in the main thread — the worker
 * wraps it in a Uint8Array on its side.
 */
function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target!.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsArrayBuffer(file);
  });
}

// ── Transform extraction & application ───────────────────────────────────────

function toNumberArray(value: unknown): number[] | null {
  if (value == null) return null;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return value.map((v) => Number(v));
  }
  if (ArrayBuffer.isView(value)) {
    return Array.from(value as ArrayLike<number>);
  }
  return null;
}

function readVector3(value: unknown): THREE.Vector3 | null {
  const arr = toNumberArray(value);
  if (arr && arr.length >= 3) {
    return new THREE.Vector3(arr[0], arr[1], arr[2]);
  }
  if (
    value &&
    typeof value === "object" &&
    !ArrayBuffer.isView(value) &&
    !Array.isArray(value)
  ) {
    const obj = value as { x?: number; y?: number; z?: number };
    if (
      typeof obj.x === "number" &&
      typeof obj.y === "number" &&
      typeof obj.z === "number"
    ) {
      return new THREE.Vector3(obj.x, obj.y, obj.z);
    }
  }
  return null;
}

function readQuaternion(value: unknown): THREE.Quaternion | null {
  const arr = toNumberArray(value);
  if (arr && arr.length >= 4) {
    return new THREE.Quaternion(arr[0], arr[1], arr[2], arr[3]).normalize();
  }
  if (value && typeof value === "object") {
    const obj = value as { x?: number; y?: number; z?: number; w?: number };
    if (
      typeof obj.x === "number" &&
      typeof obj.y === "number" &&
      typeof obj.z === "number" &&
      typeof obj.w === "number"
    ) {
      return new THREE.Quaternion(obj.x, obj.y, obj.z, obj.w).normalize();
    }
  }
  return null;
}

function readEuler(value: unknown): THREE.Euler | null {
  const arr = toNumberArray(value);
  if (arr && arr.length >= 3) {
    const order =
      value && typeof value === "object" && "order" in value
        ? String((value as { order?: string }).order ?? "XYZ")
        : "XYZ";
    return new THREE.Euler(arr[0], arr[1], arr[2], order as THREE.EulerOrder);
  }
  if (value && typeof value === "object") {
    const obj = value as {
      x?: number;
      y?: number;
      z?: number;
      order?: string;
    };
    if (
      typeof obj.x === "number" &&
      typeof obj.y === "number" &&
      typeof obj.z === "number"
    ) {
      return new THREE.Euler(
        obj.x,
        obj.y,
        obj.z,
        (obj.order ?? "XYZ") as THREE.EulerOrder
      );
    }
  }
  return null;
}

/**
 * Reads a 4×4 column-major matrix or TRS components from an occt node/mesh
 * record.  Returns null when no transform data is present.
 */
function extractTransformMatrix(source: TransformCarrier): THREE.Matrix4 | null {
  for (const key of ["matrix", "transform"] as const) {
    const raw = toNumberArray(source[key]);
    if (raw && raw.length >= 16) {
      const matrix = new THREE.Matrix4().fromArray(raw.slice(0, 16));
      if (!isNaN(matrix.elements[0])) return matrix;
    }
  }

  const location = source.location;
  if (location != null) {
    if (typeof location === "object" && !ArrayBuffer.isView(location) && !Array.isArray(location)) {
      const locObj = location as {
        matrix?: ArrayLike<number>;
        transform?: ArrayLike<number>;
      };
      for (const key of ["matrix", "transform"] as const) {
        const raw = toNumberArray(locObj[key]);
        if (raw && raw.length >= 16) {
          const matrix = new THREE.Matrix4().fromArray(raw.slice(0, 16));
          if (!isNaN(matrix.elements[0])) return matrix;
        }
      }
    } else {
      const raw = toNumberArray(location);
      if (raw && raw.length >= 16) {
        const matrix = new THREE.Matrix4().fromArray(raw.slice(0, 16));
        if (!isNaN(matrix.elements[0])) return matrix;
      }
    }
  }

  const position = readVector3(source.position);
  const quaternion =
    readQuaternion(source.quaternion) ??
    (() => {
      const euler = readEuler(source.rotation);
      return euler ? new THREE.Quaternion().setFromEuler(euler) : null;
    })();

  let scale = readVector3(source.scale);
  if (typeof source.scale === "number") {
    scale = new THREE.Vector3(source.scale, source.scale, source.scale);
  }
  if (!scale) {
    scale = new THREE.Vector3(1, 1, 1);
  }

  if (position || quaternion) {
    const matrix = new THREE.Matrix4();
    matrix.compose(
      position ?? new THREE.Vector3(),
      quaternion ?? new THREE.Quaternion(),
      scale
    );
    return matrix;
  }

  return null;
}

/** Apply a local transform matrix directly to a Three.js object. */
function applyTransformToObject(
  object: THREE.Object3D,
  matrix: THREE.Matrix4
): void {
  object.matrix.copy(matrix);
  object.matrix.decompose(object.position, object.quaternion, object.scale);
  object.matrixAutoUpdate = false;
  object.updateMatrix();
}

/** Walk the occt node tree to see if any transform metadata is present. */
function resultHasTransforms(result: OcctResult): boolean {
  const checkCarrier = (carrier: TransformCarrier): boolean =>
    extractTransformMatrix(carrier) !== null;

  const walkNode = (node: OcctNode): boolean => {
    if (checkCarrier(node)) return true;
    for (const idx of node.meshes) {
      const meshData = result.meshes[idx];
      if (meshData && checkCarrier(meshData)) return true;
    }
    return node.children.some(walkNode);
  };

  return (
    result.meshes.some(checkCarrier) ||
    walkNode(result.root)
  );
}

/**
 * Build a THREE.Mesh from raw occt-import-js mesh data.
 *
 * When the mesh record carries a transform matrix the geometry is assumed to
 * be in LOCAL part space and the matrix is applied to the mesh object.
 * When no transform is present, vertices are treated as already positioned in
 * assembly/world space (the default for occt-import-js v0.0.23 STEP output).
 */
/**
 * Build a THREE.Mesh from worker-packed transferable buffers or legacy JSON arrays.
 */
function buildMesh(meshData: OcctMeshData): THREE.Mesh | null {
  const geometry = new THREE.BufferGeometry();

  if (meshData.positionBuffer && meshData.indexBuffer) {
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(meshData.positionBuffer), 3)
    );
    geometry.setIndex(
      new THREE.BufferAttribute(new Uint32Array(meshData.indexBuffer), 1)
    );

    if (meshData.normalBuffer) {
      geometry.setAttribute(
        "normal",
        new THREE.BufferAttribute(new Float32Array(meshData.normalBuffer), 3)
      );
    } else {
      geometry.computeVertexNormals();
    }
  } else {
    const pos = meshData.attributes?.position?.array;
    const idx = meshData.index?.array;
    if (!pos?.length || !idx?.length) return null;

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(pos, 3)
    );
    geometry.setIndex(new THREE.BufferAttribute(Uint32Array.from(idx), 1));

    const normals = meshData.attributes?.normal?.array;
    if (normals?.length) {
      geometry.setAttribute(
        "normal",
        new THREE.Float32BufferAttribute(normals, 3)
      );
    } else {
      geometry.computeVertexNormals();
    }
  }

  if (geometry.attributes.position.count === 0) return null;

  geometry.name = meshData.name ?? "";

  const mesh = new THREE.Mesh(geometry);
  mesh.name = meshData.name ?? "";

  // Every CAD mesh gets its own MeshStandardMaterial here — unconditionally.
  // Setting hasLoaderMaterial = true tells SceneModel in ThreeViewer.tsx to
  // PRESERVE this material instead of replacing it with the generic fallback,
  // which would silently discard the critical CAD rendering properties:
  //
  //   flatShading: false  — smooth shading reads the analytical per-vertex
  //     normals emitted by OpenCascade above, producing correctly curved
  //     surfaces and sharp silhouette edges on fillets, cylinders, etc.
  //
  //   side: THREE.DoubleSide  — renders both faces of every triangle so
  //     that any residual winding inconsistency from IGES tessellation
  //     never produces a "see-through" hole on curved surfaces.
  //
  // Color: use the per-body color emitted by OpenCascade (linear 0–1 floats).
  // When the file provides no color (common in plain IGES files) fall back to
  // the same neutral steel-blue used as the viewer's DEFAULT_COLOR so the mesh
  // is still visible before the user activates the color-override picker.
  const cadColor = meshData.color
    ? new THREE.Color(meshData.color[0], meshData.color[1], meshData.color[2])
    : new THREE.Color(0x8b9bb4);

  mesh.material = new THREE.MeshStandardMaterial({
    color: cadColor,
    roughness: 0.45,
    metalness: 0.35,
    side: THREE.DoubleSide,
    flatShading: false,
  });
  mesh.userData.hasLoaderMaterial = true;

  const meshMatrix = extractTransformMatrix(meshData);
  if (meshMatrix) {
    applyTransformToObject(mesh, meshMatrix);
  }

  return mesh;
}

/**
 * Recursively walk the node hierarchy and build a matching THREE.Group tree.
 *
 * Node-level transforms are applied to each Group so child meshes inherit the
 * correct assembly placement.  Mesh-level transforms (when present on the flat
 * mesh record) are applied inside buildMesh().
 */
function buildNodeGroup(
  node: OcctNode,
  allMeshes: OcctMeshData[]
): THREE.Group {
  const group = new THREE.Group();
  group.name = node.name ?? "";

  const nodeMatrix = extractTransformMatrix(node);
  if (nodeMatrix) {
    applyTransformToObject(group, nodeMatrix);
  }

  for (const meshIndex of node.meshes) {
    const meshData = allMeshes[meshIndex];
    if (!meshData) continue;
    const mesh = buildMesh(meshData);
    if (mesh) group.add(mesh);
  }

  for (const child of node.children) {
    group.add(buildNodeGroup(child, allMeshes));
  }

  return group;
}

/**
 * Convert the occt-import-js result into a THREE.Group.
 *
 * When transform metadata is present on any node or mesh, the full assembly
 * tree is reconstructed so node-level matrices position sub-assemblies
 * correctly and mesh-level matrices position individual parts.
 *
 * When no transforms are present (occt-import-js v0.0.23 default), vertices
 * are already in world/assembly space — meshes are added flat to a single
 * root group, matching the official occt-import-js three.js reference viewer.
 */
function buildGroupFromResult(result: OcctResult): THREE.Group {
  if (resultHasTransforms(result)) {
    return buildNodeGroup(result.root, result.meshes);
  }

  const root = new THREE.Group();

  for (const meshData of result.meshes) {
    const mesh = buildMesh(meshData);
    if (mesh) root.add(mesh);
  }

  if (root.children.length > 0) {
    return root;
  }

  // Hierarchy-only payload — walk the tree even without explicit transforms.
  return buildNodeGroup(result.root, result.meshes);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parses a STEP (.step / .stp) or IGES (.iges / .igs) file entirely
 * client-side using occt-import-js (OpenCascade compiled to WASM).
 *
 * The heavy WASM work runs inside a dedicated Web Worker so the main thread
 * (and therefore the UI) stays responsive throughout parsing.
 *
 * Architecture
 * ────────────
 * 1. Read the File into an ArrayBuffer on the main thread.
 * 2. Spin up cadParser.worker.ts, transfer the ArrayBuffer (zero-copy).
 * 3. The worker initialises occt-import-js, runs Read{Step,Iges}File with tuned
 *    tessellation, packs mesh buffers, and posts them back as Transferables.
 * 4. On the main thread we construct BufferGeometry views over the transferred
 *    ArrayBuffers (zero-copy) and build the THREE.Group.
 * 5. The worker is always terminated after use to free its memory.
 *
 * The WASM binary must be served from /public/occt-import-js.wasm.
 */
export async function loadCADFile(file: File): Promise<THREE.Group> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  // Read the file before spawning the worker so that any FileReader error
  // surfaces as a normal Promise rejection rather than a worker error.
  const buffer = await readAsArrayBuffer(file);

  return new Promise<THREE.Group>((resolve, reject) => {
    // new URL(…, import.meta.url) is the webpack 5 / Turbopack idiom for
    // worker entry points.  The bundler replaces this with the compiled
    // worker chunk URL at build time — no runtime path resolution needed.
    const worker = new Worker(
      new URL("../../workers/cadParser.worker.ts", import.meta.url)
    );

    const cleanup = () => worker.terminate();

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      cleanup();
      const msg = event.data;

      if (msg.type === "error") {
        reject(new Error(msg.message));
        return;
      }

      try {
        resolve(buildGroupFromResult(msg.result));
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };

    worker.onerror = (err: ErrorEvent) => {
      cleanup();
      reject(
        new Error(
          `CAD parser worker crashed: ${err.message ?? "unknown error"}`
        )
      );
    };

    // Transfer the ArrayBuffer — the browser moves ownership to the worker
    // without copying.  The main-thread `buffer` reference becomes detached.
    const request: WorkerRequest = { buffer, ext };
    worker.postMessage(request, [buffer]);
  });
}
