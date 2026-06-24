import { CAD_TESSELLATION_PARAMS } from "@/src/lib/converters/cadTessellation";

/** Canonical CAD import extensions (lowercase, with leading dot). */
export const CAD_FILE_EXTENSIONS = [".step", ".stp", ".iges", ".igs"] as const;

export type CadExtension = "step" | "stp" | "iges" | "igs";

type OcctCadReader = {
  ReadStepFile: (
    content: Uint8Array,
    params: typeof CAD_TESSELLATION_PARAMS
  ) => unknown;
  ReadIgesFile: (
    content: Uint8Array,
    params: typeof CAD_TESSELLATION_PARAMS
  ) => unknown;
};

/** Strip leading dot and normalize to lowercase — e.g. ".IGS" → "igs". */
export function normalizeCadExtension(ext: string): CadExtension | null {
  const normalized = ext.startsWith(".") ? ext.slice(1).toLowerCase() : ext.toLowerCase();

  switch (normalized) {
    case "step":
    case "stp":
    case "iges":
    case "igs":
      return normalized;
    default:
      return null;
  }
}

/** Extract normalized extension from a filename — e.g. "Part.IGES" → "iges". */
export function cadExtensionFromFileName(fileName: string): CadExtension | null {
  const ext = fileName.split(".").pop() ?? "";
  return normalizeCadExtension(ext);
}

export function isCadExtension(ext: string): boolean {
  return normalizeCadExtension(ext) !== null;
}

/**
 * Wrap a transferred ArrayBuffer as Uint8Array for occt-import-js.
 * STEP and IGES share this identical buffer preparation path.
 */
export function toCadFileBuffer(buffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(buffer);
}

/**
 * Dispatch to ReadStepFile or ReadIgesFile with shared tessellation params.
 * Both formats receive the same Uint8Array wrapping and parsing options.
 */
export function readCadFileWithOcct(
  occt: OcctCadReader,
  buffer: ArrayBuffer,
  ext: string
): unknown {
  const cadExt = normalizeCadExtension(ext);
  if (!cadExt) {
    throw new Error(`Unsupported CAD format: .${ext}`);
  }

  const fileBuffer = toCadFileBuffer(buffer);

  switch (cadExt) {
    case "step":
    case "stp":
      return occt.ReadStepFile(fileBuffer, CAD_TESSELLATION_PARAMS);
    case "iges":
    case "igs":
      return occt.ReadIgesFile(fileBuffer, CAD_TESSELLATION_PARAMS);
  }
}
