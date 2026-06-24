import * as THREE from "three";
import { loadModel } from "./loaderHub";
import { parseModelError } from "@/src/utils/errorHandler";
import { MODEL_LOAD_TIMEOUT_MS } from "@/src/config/constants";

const LOAD_TIMEOUT_CODE = "LOAD_TIMEOUT";

/** Release GPU memory for a loaded model tree. */
export function disposeModel(object: THREE.Object3D): void {
  const ifcLoader = object.userData?.ifcLoader as
    | { ifcManager?: { close: (modelID: number) => void } }
    | undefined;
  const ifcModelID = object.userData?.ifcModelID as number | undefined;

  if (ifcLoader?.ifcManager?.close && ifcModelID !== undefined) {
    try {
      ifcLoader.ifcManager.close(ifcModelID);
    } catch {
      // IFC model may already be closed.
    }
  }

  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;

    mesh.geometry?.dispose();

    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    materials.forEach((material) => {
      if (!material) return;
      material.dispose();
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) {
          value.dispose();
        }
      }
    });
  });
}

function createTimeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error(LOAD_TIMEOUT_CODE)), ms);
  });
}

/**
 * Loads a model with a strict timeout and normalized error output.
 */
export async function loadModelWithTimeout(
  file: File,
  timeoutMs: number = MODEL_LOAD_TIMEOUT_MS
): Promise<THREE.Group> {
  try {
    return await Promise.race([loadModel(file), createTimeoutPromise(timeoutMs)]);
  } catch (error) {
    throw new Error(parseModelError(error));
  }
}
