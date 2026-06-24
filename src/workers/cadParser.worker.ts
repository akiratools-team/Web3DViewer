/// <reference lib="webworker" />

import occtimportjs from "occt-import-js";
import { readCadFileWithOcct } from "@/src/lib/converters/cadFormats";

type WorkerRequest = {
  buffer: ArrayBuffer;
  ext: string;
};

/** Lightweight mesh payload — geometry lives in transferred ArrayBuffers. */
type PackedMeshPayload = {
  name: string;
  color?: [number, number, number];
  brep_faces?: Array<{
    first: number;
    last: number;
    color: [number, number, number] | null;
  }>;
  matrix?: number[];
  transform?: number[];
  location?: number[] | { matrix?: number[]; transform?: number[] };
  position?: number[] | { x?: number; y?: number; z?: number };
  rotation?: number[] | { x?: number; y?: number; z?: number; order?: string };
  quaternion?: number[] | { x?: number; y?: number; z?: number; w?: number };
  scale?: number[] | number | { x?: number; y?: number; z?: number };
  positionBuffer: ArrayBuffer;
  normalBuffer?: ArrayBuffer;
  indexBuffer: ArrayBuffer;
};

type PackedOcctResult = {
  success: boolean;
  root: {
    name: string;
    meshes: number[];
    children: PackedOcctResult["root"][];
    matrix?: number[];
    transform?: number[];
    location?: number[] | { matrix?: number[]; transform?: number[] };
    position?: number[] | { x?: number; y?: number; z?: number };
    rotation?: number[] | { x?: number; y?: number; z?: number; order?: string };
    quaternion?: number[] | { x?: number; y?: number; z?: number; w?: number };
    scale?: number[] | number | { x?: number; y?: number; z?: number };
  };
  meshes: PackedMeshPayload[];
};

type WorkerResponse =
  | { type: "result"; result: PackedOcctResult }
  | { type: "error"; message: string };

type RawOcctMesh = {
  name?: string;
  color?: [number, number, number];
  brep_faces?: PackedMeshPayload["brep_faces"];
  attributes?: {
    position?: { array: number[] };
    normal?: { array: number[] };
  };
  index?: { array: number[] };
  matrix?: number[];
  transform?: number[];
  location?: PackedMeshPayload["location"];
  position?: PackedMeshPayload["position"];
  rotation?: PackedMeshPayload["rotation"];
  quaternion?: PackedMeshPayload["quaternion"];
  scale?: PackedMeshPayload["scale"];
};

type RawOcctResult = {
  success: boolean;
  root: PackedOcctResult["root"];
  meshes: RawOcctMesh[];
};

function copyTransformFields(
  source: RawOcctMesh,
  target: PackedMeshPayload
): void {
  if (source.matrix) target.matrix = source.matrix;
  if (source.transform) target.transform = source.transform;
  if (source.location !== undefined) target.location = source.location;
  if (source.position !== undefined) target.position = source.position;
  if (source.rotation !== undefined) target.rotation = source.rotation;
  if (source.quaternion !== undefined) target.quaternion = source.quaternion;
  if (source.scale !== undefined) target.scale = source.scale;
}

function packMesh(
  mesh: RawOcctMesh
): { packed: PackedMeshPayload; transferables: ArrayBuffer[] } | null {
  const posArr = mesh.attributes?.position?.array;
  const idxArr = mesh.index?.array;
  if (!posArr?.length || !idxArr?.length) return null;

  const positions = new Float32Array(posArr);
  const indices = new Uint32Array(idxArr);
  const transferables: ArrayBuffer[] = [positions.buffer, indices.buffer];

  const packed: PackedMeshPayload = {
    name: mesh.name ?? "",
    color: mesh.color,
    brep_faces: mesh.brep_faces,
    positionBuffer: positions.buffer,
    indexBuffer: indices.buffer,
  };

  copyTransformFields(mesh, packed);

  const normalArr = mesh.attributes?.normal?.array;
  if (normalArr?.length) {
    const normals = new Float32Array(normalArr);
    packed.normalBuffer = normals.buffer;
    transferables.push(normals.buffer);
  }

  return { packed, transferables };
}

function packResult(raw: RawOcctResult): {
  result: PackedOcctResult;
  transferables: Transferable[];
} {
  const meshes: PackedMeshPayload[] = [];
  const transferables: Transferable[] = [];

  for (const mesh of raw.meshes) {
    const packed = packMesh(mesh);
    if (!packed) continue;
    meshes.push(packed.packed);
    transferables.push(...packed.transferables);
  }

  return {
    result: {
      success: raw.success,
      root: raw.root,
      meshes,
    },
    transferables,
  };
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  try {
    const { buffer, ext } = event.data;

    const occt = await occtimportjs({
      locateFile: (path: string) =>
        path.endsWith(".wasm") ? "/occt-import-js.wasm" : path,
    });

    const raw = readCadFileWithOcct(occt, buffer, ext) as RawOcctResult;

    if (!raw?.success) {
      throw new Error("Failed to parse CAD file. The file might be corrupted.");
    }

    if (!raw.meshes?.length) {
      throw new Error("Failed to import model. The model doesn't contain any meshes.");
    }

    const { result, transferables } = packResult(raw);

    if (!result.meshes.length) {
      throw new Error("Failed to import model. The model doesn't contain any meshes.");
    }

    const response: WorkerResponse = { type: "result", result };
    self.postMessage(response, transferables);
  } catch (err) {
    const response: WorkerResponse = {
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
