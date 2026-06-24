import { CAD_FILE_EXTENSIONS } from "@/src/lib/converters/cadFormats";



/** Default model material colour (neutral steel-blue). */

export const DEFAULT_MATERIAL_COLOR = "#8b9bb4";



/** Numeric hex for Three.js `Color` constructors. */

export const DEFAULT_MATERIAL_COLOR_NUM = 0x8b9bb4;



/** Camera fit padding multiplier when auto-framing a loaded model. */

export const FIT_PADDING = 1.5;



/** Yield before heavy parsing so the loader UI can paint (ms). */

export const PARSE_YIELD_MS = 50;



/** Maximum time allowed for parsing a single file (ms). */

export const MODEL_LOAD_TIMEOUT_MS = 45_000;



/** Default export format in the toolbar dropdown. */

export const DEFAULT_EXPORT_FORMAT = "glb" as const;

/** File extensions accepted for import (dropzone validation and file picker). */

export const ACCEPTED_FILE_EXTENSIONS = [

  ".stl",

  ".obj",

  ".fbx",

  ".gltf",

  ".glb",

  ".ply",

  ".off",

  ...CAD_FILE_EXTENSIONS,

  ".3mf",
  ".ifc",
] as const;



/** Alias for validation modules — lowercase canonical forms. */

export const ACCEPTED_EXTENSIONS = ACCEPTED_FILE_EXTENSIONS;



/** Extract a lowercase dotted extension from a filename — e.g. "Part.IGS" → ".igs". */

export function fileExtensionFromName(fileName: string): string {

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  return ext ? `.${ext}` : "";

}



/** Comma-separated list for HTML `<input accept>` (lowercase + uppercase variants). */

export const ACCEPTED_FILE_EXTENSIONS_ATTR = [

  ...ACCEPTED_FILE_EXTENSIONS.flatMap((ext) => [ext, ext.toUpperCase()]),

].join(",");


