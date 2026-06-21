import toast from "react-hot-toast";

/** Default message when no specific pattern matches. */
export const MODEL_ERROR_FALLBACK =
  "Failed to import model. The file might be corrupted or unsupported.";

export const MODEL_ERROR_TIMEOUT =
  "The file took too long to load. It might be too large or complex. Try a smaller file.";

export const MODEL_ERROR_FBX_VERSION =
  "Failed to import model. The FBX file version is unsupported or corrupted.";

export const MODEL_ERROR_NO_MESHES =
  "Failed to import model. The model doesn't contain any meshes.";

const LOAD_TIMEOUT_CODE = "LOAD_TIMEOUT";

/** Pull a readable string from any thrown loader value. */
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.trim();
  }

  if (typeof error === "string") {
    return error.trim();
  }

  if (error && typeof error === "object") {
    const record = error as { message?: unknown; reason?: unknown; type?: unknown };

    if (typeof record.message === "string" && record.message.trim()) {
      return record.message.trim();
    }

    if (typeof record.reason === "string" && record.reason.trim()) {
      return record.reason.trim();
    }

    if (record.type === "error" || record.type === "abort") {
      return "";
    }
  }

  return "";
}

/**
 * Maps raw Three.js / loader errors to short, user-facing copy.
 */
export function parseModelError(error: unknown): string {
  if (error instanceof Error && error.message === LOAD_TIMEOUT_CODE) {
    return MODEL_ERROR_TIMEOUT;
  }

  const raw = extractErrorMessage(error);
  if (!raw) return MODEL_ERROR_FALLBACK;

  const lower = raw.toLowerCase();

  // Timeout (already normalized upstream)
  if (
    lower.includes("took too long") ||
    lower.includes("load_timeout") ||
    lower === MODEL_ERROR_TIMEOUT.toLowerCase()
  ) {
    return MODEL_ERROR_TIMEOUT;
  }

  // FBX version / header corruption
  if (
    lower.includes("version number") ||
    lower.includes("fbx version") ||
    lower.includes("invalid fbx") ||
    (lower.includes("fbx") && lower.includes("unsupported"))
  ) {
    return MODEL_ERROR_FBX_VERSION;
  }

  // Empty or mesh-less models
  if (
    lower.includes("no meshes") ||
    lower.includes("no renderable") ||
    lower.includes("no renderable elements") ||
    lower.includes("doesn't contain any mesh") ||
    lower.includes("does not contain any mesh") ||
    lower.includes("no geometry") ||
    lower.includes("empty mesh") ||
    lower.includes("contains no meshes")
  ) {
    return MODEL_ERROR_NO_MESHES;
  }

  // Preserve friendly validation from extension checks
  if (/^unsupported format:/i.test(raw)) {
    return raw;
  }

  // Already user-facing copy from a prior parse pass
  if (
    raw === MODEL_ERROR_FALLBACK ||
    raw === MODEL_ERROR_TIMEOUT ||
    raw === MODEL_ERROR_FBX_VERSION ||
    raw === MODEL_ERROR_NO_MESHES
  ) {
    return raw;
  }

  // Strip raw THREE.*Loader stack traces — never show library internals
  if (
    /^error:\s*three\./i.test(raw) ||
    lower.includes("three.fbxloader") ||
    lower.includes("three.gltfloader") ||
    lower.includes("three.stlloader") ||
    lower.includes("three.objloader")
  ) {
    if (lower.includes("version")) return MODEL_ERROR_FBX_VERSION;
    return MODEL_ERROR_FALLBACK;
  }

  // Short, curated loader messages from our hub
  if (/^failed to parse/i.test(raw) || /^failed to read/i.test(raw)) {
    return MODEL_ERROR_FALLBACK;
  }

  if (/^bim file/i.test(raw) || /^not a valid off/i.test(raw)) {
    return MODEL_ERROR_FALLBACK;
  }

  return MODEL_ERROR_FALLBACK;
}

/** Parse error and show a toast — returns the friendly message. */
export function notifyModelError(error: unknown): string {
  const message = parseModelError(error);
  toast.error(message, { id: "model-load-error" });
  return message;
}
